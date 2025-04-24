import { TextEditor } from 'atom';
import type * as atomIde from 'atom-ide-base';
import type * as sym from 'symbols-view';
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
    private getScoreBoost;
    /**
     * If the `symbols-view` package is installed, this package will use the
     * user's configured ranking of various providers.
     */
    private getSelectedProviders;
    /**
     * Asks its various providers for symbols, then assembles them into an outline.
     *
     * Will typically be a flat list, but some heuristics are used to infer
     * hierarchy based on metadata.
     *
     * @param  editor A text editor.
     * @returns An `Outline` data structure or `null`.
     */
    getOutline(editor: TextEditor): Promise<atomIde.Outline | null>;
}
export default SymbolProviderWrapper;
