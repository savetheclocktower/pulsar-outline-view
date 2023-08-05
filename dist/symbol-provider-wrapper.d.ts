import { TextEditor } from 'atom';
import type * as atomIde from 'atom-ide-base';
import type * as sym from 'symbols-view-redux';
/**
 * Consumes the `symbol.provider` service and adapts its providers into an
 * outline provider. Designed to be chosen only when a more suitable outline
 * provider is not available.
 */
declare class SymbolProviderWrapper implements atomIde.OutlineProvider {
    name: string;
    priority: number;
    grammarScopes: string[];
    providers: sym.SymbolProvider[];
    _abortController?: AbortController;
    constructor();
    addSymbolProvider(...providers: sym.SymbolProvider[]): void;
    removeSymbolProvider(...providers: sym.SymbolProvider[]): void;
    getScoreBoost(name: string, packageName: string, preferredProviders: string[]): number;
    /**
     * If the `symbols-view-redux` package is installed, this package will the
     * user's configured ranking of various providers.
     */
    getSelectedProviders(meta: sym.SymbolMeta): Promise<sym.SymbolProvider[]>;
    getOutline(editor: TextEditor): Promise<{
        outlineTrees: atomIde.OutlineTree[];
    } | null>;
}
export default SymbolProviderWrapper;
