/** @jsx etch.dom */
import { CompositeDisposable, Emitter, Range, TextEditor } from 'atom';
import type * as atomIde from 'atom-ide-base';
import etch from 'etch';
import ProviderBroker from './provider-broker';
export type SymbolEntry = {
    name: string;
    icon?: string;
    kind?: string;
    range: Range;
    children?: SymbolEntry[];
};
type OutlineViewConfig = {
    visitEntriesOnKeyboardMovement: boolean;
    showOnRightSide: boolean;
    nameOverflowStrategy: 'scroll' | 'ellipsis';
    ignoredSymbolTypes: string[];
};
declare class OutlineView {
    protected id: number;
    protected refs?: {
        [key: string]: HTMLElement;
    };
    protected disposables: CompositeDisposable;
    protected emitter: Emitter;
    protected broker: ProviderBroker;
    protected symbols?: SymbolEntry[] | null;
    protected selectedSymbol?: SymbolEntry | null;
    protected outline?: atomIde.Outline | null;
    protected activeEditor?: TextEditor | null;
    protected activeEditorDisposables?: CompositeDisposable | null;
    protected symbolEntryToRefTable: Map<SymbolEntry, string>;
    protected refToSymbolEntryTable: Map<string, SymbolEntry>;
    protected selectedRef?: HTMLElement | null;
    protected config: OutlineViewConfig;
    protected editorSymbolsList: WeakMap<TextEditor, SymbolEntry[]>;
    constructor(broker: ProviderBroker, _state?: unknown);
    destroy(): Promise<void>;
    onDidDestroy(callback: () => void): import("atom").Disposable;
    getTitle(): string;
    getURI(): string;
    getIconName(): string;
    getAllowedLocations(): string[];
    isPermanentDockItem(): boolean;
    getPreferredWidth(): number | undefined;
    handleEvents(): void;
    isFocused(): boolean;
    /**
     * Move the selection up to the previous item.
     * @param event Command event.
     */
    moveUp(event: Event): void;
    /**
     * Move the selection down to the next item.
     * @param event Command event.
     */
    moveDown(event: Event): void;
    moveDelta(event: Event, delta: number): void;
    /**
     * Move to a symbol with a specific index in the flat list of visible symbols.
     * @param index The index to move to.
     * @param items An optional array of nodes in case you've already done the
     *   work.
     */
    moveToIndex(index: number, items?: Element[]): void;
    moveToTop(event: Event): void;
    moveToBottom(event: Event): void;
    collapseSelectedEntry(): void;
    collapseEntry(element: Element): void;
    activateSelectedEntry(): void;
    moveEditorToSymbol(symbol: SymbolEntry): void;
    get element(): HTMLElement | null;
    elementForSymbol(symbol: SymbolEntry): HTMLElement | null;
    symbolForElement(element: HTMLElement): SymbolEntry | null;
    handleEditorEvents(): void;
    switchToEditor(editor: TextEditor): void;
    populateForEditor(editor: TextEditor): Promise<void>;
    toggle(): Promise<void>;
    show(): Promise<void>;
    activate(): void;
    hide(): void;
    focus(): void;
    unfocus(): void;
    setSymbols(symbols: SymbolEntry[], editor?: TextEditor): Promise<void> | undefined;
    getActiveSymbolForEditor(editor?: TextEditor | null, flatSymbols?: SymbolEntry[]): SymbolEntry | null;
    setSelectedSymbol(newSymbol: SymbolEntry | null): void;
    scrollSelectedEntryIntoViewIfNeeded(): void;
    getSelectedSymbol(): SymbolEntry | null | undefined;
    getClosestVisibleElementForSymbol(symbol: SymbolEntry): HTMLElement | null;
    revealInOutlineView(editor: TextEditor): void;
    getSymbols(): Promise<SymbolEntry[] | null>;
    consumeOutline(outline: atomIde.Outline): SymbolEntry[];
    update(): Promise<void>;
    renderSymbol(symbol: SymbolEntry): etch.EtchSVGElement<keyof SVGElementTagNameMap> | etch.EtchElement<etch.TagSpec> | {
        text: string | number;
    } | null;
    render(): etch.EtchJSXElement;
    private toggleRef;
    private shouldIgnoreSymbol;
    private getFlatSymbols;
    private isClickOnCaret;
    private getVisibleListItems;
}
export default OutlineView;
