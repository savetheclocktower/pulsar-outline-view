import { Range, TextEditor } from 'atom';
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

  addSymbolProvider(...providers: sym.SymbolProvider[]) {
    for (let provider of providers) {
      if (this.providers.includes(provider)) continue;
      this.providers.push(provider);
    }
  }

  removeSymbolProvider(...providers: sym.SymbolProvider[]) {
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

  getScoreBoost(name: string, packageName: string, preferredProviders: string[]) {
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
   * If the `symbols-view-redux` package is installed, this package will the
   * user's configured ranking of various providers.
   */
  async getSelectedProviders(meta: sym.SymbolMeta) {
    let exclusivesByScore = [];
    let selectedProviders = [];
    let preferredProviders = atom.config.get('symbols-view-redux.preferCertainProviders');

    let answers = this.providers.map(provider => {
      // TODO: This method can reluctantly go async because language clients
      // might have to ask their servers about capabilities. We must introduce
      // a timeout value here so that we don't wait indefinitely for providers
      // to respond.
      console.debug(`[pulsar-outline-view] Asking provider:`, provider.name, provider);
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

  async getOutline(editor: TextEditor) {
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
        rawSymbols.push(...symbols);
      });
    });

    await Promise.allSettled(symbolPromises);
    let results: atomIde.OutlineTree[] = [];

    let index = new Index();

    for (let symbol of rawSymbols) {
      let name = symbol.shortName ?? symbol.name;
      let range;
      if ('range' in symbol) {
        range = symbol.range;
      } else if ('position' in symbol) {
        range = new Range(symbol.position, symbol.position);
      } else {
        throw new Error(`Malformed symbol!`);
      }
      let tree = {
        icon: symbol.tag ? `type-${symbol.tag}` : undefined,
        kind: (LSP_KINDS.has(symbol.tag ?? '') ? symbol.tag : undefined) as atomIde.OutlineTreeKind,
        plainText: name,
        representativeName: name,
        startPosition: range.start,
        endPosition: range.end,
        children: []
      };
      if (symbol.context) {
        let entries = index.get(symbol.context);
        let last = entries[entries.length - 1];
        if (last) {
          entries[0].children.push(tree);
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
