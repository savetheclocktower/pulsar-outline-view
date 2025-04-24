import { Point, Range, TextEditor } from 'atom';
import { Index } from './util';
import type * as atomIde from 'atom-ide-base';
import type * as sym from 'symbols-view';

const LSP_KINDS = new Set([
  "file",
  "module",
  "namespace",
  "package",
  "class",
  "method",
  "property",
  "field",
  "constructor",
  "enum",
  "interface",
  "function",
  "variable",
  "constant",
  "string",
  "number",
  "boolean",
  "array"
]);

function getSymbolPosition(symbol: sym.FileSymbol): Point | null {
  if ('position' in symbol) return symbol.position;
  if ('range' in symbol) return symbol.range.start;
  return null;
}

function compareSymbols(a: sym.FileSymbol, b: sym.FileSymbol): number {
  let positionA = getSymbolPosition(a);
  let positionB = getSymbolPosition(b);
  if (!positionB && !positionA) return 0;
  if (!positionB) return -1;
  if (!positionA) return 1;
  return positionA.compare(positionB);
}

/**
 * Consumes the `symbol.provider` service and adapts its providers into an
 * outline provider. Designed to be chosen only when a more suitable outline
 * provider is not available.
 */
class SymbolProviderWrapper implements atomIde.OutlineProvider {
  name: string;
  priority: number;
  grammarScopes: string[];
  public providers: sym.SymbolProvider[];

  _abortController?: AbortController;

  constructor() {
    this.name = 'Symbol Provider';
    this.priority = 0.8;
    this.grammarScopes = ['*'];
    this.providers = [];
  }

  public addSymbolProvider(...providers: sym.SymbolProvider[]) {
    for (let provider of providers) {
      if (this.providers.includes(provider)) continue;
      this.providers.push(provider);
    }
  }

  public removeSymbolProvider(...providers: sym.SymbolProvider[]) {
    let indexesToRemove = [];
    for (let [index, provider] of this.providers.entries()) {
      if (providers.includes(provider)) {
        // Insert the indexes in backwards order. Later we'll iterate
        // back-to-front so that indexes don't shift as we remove entries.
        indexesToRemove.unshift(index);
      }
    }
    for (let index of indexesToRemove) {
      this.providers.splice(index, 1);
    }
  }

  private getScoreBoost(
    name: string,
    packageName: string,
    preferredProviders: string[]
  ): number {
    if (packageName === 'unknown') return 0;
    let index = preferredProviders.indexOf(packageName);
    if (index === -1) {
      index = preferredProviders.indexOf(name);
    }
    if (index === -1) return 0;
    let scoreBoost = preferredProviders.length - index;
    return scoreBoost;
  }

  /**
   * If the `symbols-view` package is installed, this package will use the
   * user's configured ranking of various providers.
   */
  private async getSelectedProviders(
    meta: sym.SymbolMeta
  ): Promise<sym.SymbolProvider[]> {
    let exclusivesByScore = [];
    let selectedProviders = [];
    let preferredProviders = atom.config.get('symbols-view.preferCertainProviders');

    let answers = this.providers.map(provider => {
      // TODO: This method can reluctantly go async because language clients
      // might have to ask their servers about capabilities. We must introduce
      // a timeout value here so that we don't wait indefinitely for providers
      // to respond.
      console.debug("[pulsar-outline-view] Asking provider:", provider.name, provider);
      return provider.canProvideSymbols(meta);
    });

    let outcomes = await Promise.allSettled(answers);

    for (let [index, provider] of this.providers.entries()) {
      let outcome = outcomes[index];
      if (outcome.status === 'rejected') continue;
      let { value: score } = outcome;
      let name = provider.name ?? 'unknown';
      let packageName = provider?.packageName ?? 'unknown';
      let isExclusive = provider?.isExclusive ?? false;

      if (!score) continue;

      if (score === true) score = 1;
      score += this.getScoreBoost(name, packageName, preferredProviders);

      if (isExclusive) {
        // “Exclusive” providers get put aside until the end. We'll pick the
        // _one_ that has the highest score.
        exclusivesByScore.push({ provider, score });
      } else {
        // Non-exclusive providers go into the pile because we know we'll be
        // using them all.
        selectedProviders.push(provider);
      }
    }

    if (exclusivesByScore.length > 0) {
      exclusivesByScore.sort((a, b) => b.score - a.score);
      let exclusive = exclusivesByScore[0].provider;
      selectedProviders.unshift(exclusive);
    }

    return selectedProviders;

  }

  /**
   * Asks its various providers for symbols, then assembles them into an outline.
   *
   * Will typically be a flat list, but some heuristics are used to infer
   * hierarchy based on metadata.
   *
   * @param  editor A text editor.
   * @returns An `Outline` data structure or `null`.
   */
  async getOutline(editor: TextEditor): Promise<atomIde.Outline | null> {
    this._abortController?.abort();
    this._abortController = new AbortController();

    let meta = {
      type: 'file' as const,
      editor,
      signal: this._abortController.signal
    };

    let selectedProviders = await this.getSelectedProviders(meta);
    if (selectedProviders.length === 0) return null;

    let rawSymbols: sym.FileSymbol[] = [];
    let symbolPromises = selectedProviders.map(provider => {
      let response = provider.getSymbols(meta);
      let result = response instanceof Promise ? response : Promise.resolve(response);

      return result.then((symbols) => {
        if (symbols === null) return;
        rawSymbols.push(...symbols);
        // Re-sort the list of symbols whenever we add new ones. The outline
        // should always be in document order.
        rawSymbols.sort(compareSymbols);
      });
    });

    await Promise.allSettled(symbolPromises);
    let results: atomIde.OutlineTree[] = [];

    let index = new Index();

    for (let symbol of rawSymbols) {
      let name = symbol.shortName ?? symbol.name;
      let range: Range;
      if ('range' in symbol) {
        range = symbol.range;
      } else if ('position' in symbol) {
        range = new Range(symbol.position, symbol.position);
      } else {
        throw new Error("Malformed symbol!");
      }
      let icon = symbol.icon;
      if (!icon && symbol.tag) {
        icon = `type-${symbol.tag}`;
      }
      let tree = {
        icon,
        kind: (LSP_KINDS.has(symbol.tag ?? '') ? symbol.tag : undefined) as atomIde.OutlineTreeKind,
        plainText: name,
        representativeName: name,
        startPosition: range.start,
        endPosition: range.end,
        children: []
      };
      if (symbol.context) {
        let entries = index.get(symbol.context);
        let last = Array.isArray(entries) ? entries[entries.length - 1] : null;
        if (last) {
          entries[0].children.push(tree);
        } else {
          if (last === null) {
            console.warn('[pulsar-outline-view] Unknown context:', symbol.context);
          }
          results.push(tree);
        }
      } else {
        results.push(tree);
      }
      index.add(name, tree);
    }

    return { outlineTrees: results };
  }
}

export default SymbolProviderWrapper;
