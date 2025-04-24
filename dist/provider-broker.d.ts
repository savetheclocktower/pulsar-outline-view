import { TextEditor } from 'atom';
import SymbolProviderWrapper from './symbol-provider-wrapper';
import type * as atomIde from 'atom-ide-base';
import type * as symbol from 'symbols-view';
declare class ProviderBroker {
    protected providers: atomIde.OutlineProvider[];
    protected symbolProviderWrapper: SymbolProviderWrapper;
    constructor();
    addProviders(...providers: atomIde.OutlineProvider[]): void;
    removeProviders(...providers: atomIde.OutlineProvider[]): void;
    addSymbolProviders(...providers: symbol.SymbolProvider[]): void;
    removeSymbolProviders(...providers: symbol.SymbolProvider[]): void;
    removeProvider(provider: atomIde.OutlineProvider): void;
    chooseProviderForEditor(editor: TextEditor): atomIde.OutlineProvider | null;
}
export default ProviderBroker;
