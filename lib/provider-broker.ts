import { TextEditor } from 'atom';
import SymbolProviderWrapper from './symbol-provider-wrapper';
import type * as atomIde from 'atom-ide-base';
import type * as symbol from 'symbols-view-redux';

class ProviderBroker {
  protected providers: atomIde.OutlineProvider[];
  protected symbolProviderWrapper: SymbolProviderWrapper;
  constructor() {
    this.providers = [];
    this.symbolProviderWrapper = new SymbolProviderWrapper();
  }

  addProviders(...providers: atomIde.OutlineProvider[]) {
    this.providers.push(...providers);
  }

  removeProviders(...providers: atomIde.OutlineProvider[]) {
    for (let provider of providers) {
      this.removeProviders(provider);
    }
  }

  addSymbolProviders(...providers: symbol.SymbolProvider[]) {
    console.debug('[pulsar-outline-view] Adding symbol providers:', providers);
    this.symbolProviderWrapper.addSymbolProvider(...providers);
    if (!this.providers.includes(this.symbolProviderWrapper)) {
      this.addProviders(this.symbolProviderWrapper);
    }
  }

  removeSymbolProviders(...providers: symbol.SymbolProvider[]) {
    this.symbolProviderWrapper.removeSymbolProvider(...providers);
    if (this.symbolProviderWrapper.providers.length === 0) {
      this.removeProvider(this.symbolProviderWrapper);
    }
  }

  removeProvider(provider: atomIde.OutlineProvider) {
    let index = this.providers.indexOf(provider);
    if (index > -1) {
      this.providers.splice(index, 1);
    }
  }

  chooseProviderForEditor(editor: TextEditor): atomIde.OutlineProvider | null {
    console.debug('[pulsar-outline-view] Choosing provider for editor:', editor);
    let baseScope = editor.getGrammar()?.scopeName;
    if (!baseScope) return null;

    let winner = null;
    for (let provider of this.providers) {
      if (
        !provider.grammarScopes.includes(baseScope) &&
        !provider.grammarScopes.includes('*')
      ) continue;
      if (!winner || winner.priority < provider.priority) {
        winner = provider;
      }
    }
    console.debug('[pulsar-outline-view] Winner is:', winner);
    return winner;
  }
}

export default ProviderBroker;
