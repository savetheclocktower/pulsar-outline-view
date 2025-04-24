"use strict";
/** @jsx etch.dom */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const atom_1 = require("atom");
const classnames_1 = __importDefault(require("classnames"));
const etch_1 = __importDefault(require("etch"));
const OUTLINE_VIEW_URI = 'atom://pulsar-outline-view';
let nextInstanceId = 1;
let symbolId = 1;
function isDock(item) {
    if (item === null || typeof item !== 'object')
        return false;
    return item.constructor.name === 'Dock';
}
function interpretTokenizedText(tokenizedText) {
    let result = [];
    for (let token of tokenizedText) {
        result.push(token.value);
    }
    return result.join('');
}
function getOctocatIconForOutlineIcon(outlineIcon) {
    switch (outlineIcon) {
        case 'type-function':
            return 'icon-gear';
        case 'type-method':
            return 'icon-gear';
        case 'type-namespace':
            return 'icon-tag';
        case 'type-variable':
            return 'icon-code';
        case 'type-class':
            return 'icon-package';
        case 'type-constant':
            return 'icon-primitive-square';
        case 'type-property':
            return 'icon-primitive-dot';
        case 'type-interface':
            return 'icon-key';
        case 'type-constructor':
            return 'icon-tools';
        case 'type-module':
            return 'icon-database';
        default:
            if (!(outlineIcon === null || outlineIcon === void 0 ? void 0 : outlineIcon.startsWith('icon-'))) {
                console.warn('[pulsar-outline-view] Unmapped icon:', outlineIcon);
            }
            if (outlineIcon === null || outlineIcon === void 0 ? void 0 : outlineIcon.startsWith('type-')) {
                // Fallback for all other icon types from `atom-ide-outline`.
                return 'icon-dash';
            }
            return outlineIcon !== null && outlineIcon !== void 0 ? outlineIcon : null;
    }
}
function titleForSymbol(symbol) {
    let kindTag = '';
    if (symbol.kind) {
        kindTag = ` (${symbol.kind})`;
    }
    else if (symbol.icon) {
        kindTag = ` (${symbol.icon})`;
    }
    return `${symbol.name}${kindTag}`;
}
class OutlineView {
    constructor(broker, _state) {
        var _a;
        this.id = nextInstanceId++;
        this.broker = broker;
        this.editorSymbolsList = new Map();
        this.symbolEntryToRefTable = new Map();
        this.refToSymbolEntryTable = new Map();
        this.disposables = new atom_1.CompositeDisposable();
        this.emitter = new atom_1.Emitter();
        this.activeEditor = null;
        this.config = atom.config.get('pulsar-outline-view');
        etch_1.default.initialize(this);
        etch_1.default.setScheduler(atom.views);
        (_a = this.element) === null || _a === void 0 ? void 0 : _a.addEventListener('click', (event) => {
            var _a, _b;
            if (!this.activeEditor)
                return;
            if (this.isClickOnCaret(event)) {
                let target = (_a = event.target) === null || _a === void 0 ? void 0 : _a.closest('li.outline-view-entry');
                if (!target)
                    return;
                return this.collapseEntry(target);
            }
            let target = (_b = event.target) === null || _b === void 0 ? void 0 : _b.closest('li.outline-view-entry');
            if (!target)
                return;
            let ref = target.dataset.id;
            if (!ref)
                return;
            let symbol = this.refToSymbolEntryTable.get(ref);
            if (!symbol)
                return;
            this.moveEditorToSymbol(symbol);
        });
        this.handleEvents();
        let editor = atom.workspace.getActiveTextEditor();
        if (editor) {
            this.switchToEditor(editor);
        }
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            this.disposables.dispose();
            this.emitter.emit('did-destroy');
            yield etch_1.default.destroy(this);
        });
    }
    onDidDestroy(callback) {
        return this.emitter.on('did-destroy', callback);
    }
    getTitle() {
        return "Outline";
    }
    getURI() {
        return OUTLINE_VIEW_URI;
    }
    getIconName() {
        return 'list-unordered';
    }
    getAllowedLocations() {
        // When the workspace chooses a dock location for an item, it'll choose the
        // first one indicated in this array.
        if (this.config.showOnRightSide) {
            return ['right', 'left'];
        }
        return ['left', 'right'];
    }
    isPermanentDockItem() {
        return false;
    }
    getPreferredWidth() {
        if (!this.refs || !this.refs.list)
            return;
        this.refs.list.style.width = 'min-content';
        let result = this.refs.list.offsetWidth;
        this.refs.list.style.width = '';
        return result;
    }
    handleEvents() {
        this.disposables.add(atom.config.onDidChange('pulsar-outline-view', ({ newValue }) => {
            this.config = newValue;
            this.update();
        }), atom.workspace.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                // If the new active item isn't a TextEditor, we won't replace the
                // previous text editor, because the outline view will still show
                // that editor's symbols.
                this.activeEditor;
                this.switchToEditor(editor);
            }
        }));
        if (this.element) {
            this.disposables.add(atom.commands.add(this.element, {
                'core:move-up': (e) => this.moveUp(e),
                'core:move-down': (e) => this.moveDown(e),
                'core:move-to-top': (e) => this.moveToTop(e),
                'core:move-to-bottom': (e) => this.moveToBottom(e),
                'pulsar-outline-view:collapse-selected-entry': () => this.collapseSelectedEntry(),
                'pulsar-outline-view:activate-selected-entry': () => this.activateSelectedEntry()
            }));
            this.element.addEventListener('focus', () => {
                var _a;
                if (!this.selectedRef) {
                    this.moveToIndex(0);
                }
                (_a = this.selectedRef) === null || _a === void 0 ? void 0 : _a.focus();
            });
        }
    }
    isFocused() {
        if (!this.element)
            return false;
        let active = document.activeElement;
        return this.element === active || this.element.contains(active);
    }
    /**
     * Move the selection up to the previous item.
     * @param event Command event.
     */
    moveUp(event) {
        return this.moveDelta(event, -1);
    }
    /**
     * Move the selection down to the next item.
     * @param event Command event.
     */
    moveDown(event) {
        return this.moveDelta(event, 1);
    }
    moveDelta(event, delta) {
        event.stopImmediatePropagation();
        let items = this.getVisibleListItems();
        let symbol = this.getSelectedSymbol();
        if (!symbol)
            return;
        let element = this.elementForSymbol(symbol);
        if (!element)
            return;
        let index = items.indexOf(element);
        if (index === -1)
            return;
        let newIndex = index + delta;
        if (newIndex >= items.length)
            newIndex = items.length - 1;
        if (newIndex < 0)
            newIndex = 0;
        return this.moveToIndex(newIndex, items);
    }
    /**
     * Move to a symbol with a specific index in the flat list of visible symbols.
     * @param index The index to move to.
     * @param items An optional array of nodes in case you've already done the
     *   work.
     */
    moveToIndex(index, items) {
        var _a;
        if (!items) {
            items = this.getVisibleListItems();
        }
        if (items.length === 0)
            return;
        if (index < 0) {
            index = items.length + index;
        }
        let symbol = this.symbolForElement(items[index]);
        if (!symbol)
            return;
        this.setSelectedSymbol(symbol);
        if ((_a = this.config) === null || _a === void 0 ? void 0 : _a.visitEntriesOnKeyboardMovement) {
            this.activateSelectedEntry();
        }
    }
    moveToTop(event) {
        event.stopImmediatePropagation();
        this.moveToIndex(0);
    }
    moveToBottom(event) {
        event.stopImmediatePropagation();
        this.moveToIndex(-1);
    }
    collapseSelectedEntry() {
        if (!this.selectedSymbol)
            return;
        let element = this.elementForSymbol(this.selectedSymbol);
        if (!(element === null || element === void 0 ? void 0 : element.classList.contains('list-nested-item')))
            return;
        return this.collapseEntry(element);
    }
    collapseEntry(element) {
        let childrenGroup = element.querySelector('.list-tree');
        if (!childrenGroup)
            return;
        let isCollapsed = element.classList.contains('collapsed');
        if (isCollapsed) {
            childrenGroup.classList.remove('hidden');
            element.classList.remove('collapsed');
        }
        else {
            childrenGroup.classList.add('hidden');
            element.classList.add('collapsed');
        }
    }
    activateSelectedEntry() {
        if (!this.selectedSymbol)
            return;
        this.moveEditorToSymbol(this.selectedSymbol);
    }
    moveEditorToSymbol(symbol) {
        if (symbol && this.activeEditor) {
            this.activeEditor.setCursorBufferPosition(symbol.range.start, { autoscroll: false });
            this.activeEditor.scrollToCursorPosition({ center: true });
        }
    }
    get element() {
        var _a, _b;
        return (_b = (_a = this.refs) === null || _a === void 0 ? void 0 : _a.root) !== null && _b !== void 0 ? _b : null;
    }
    elementForSymbol(symbol) {
        var _a, _b;
        let ref = this.symbolEntryToRefTable.get(symbol);
        if (!ref)
            return null;
        return (_b = (_a = this.refs) === null || _a === void 0 ? void 0 : _a[ref]) !== null && _b !== void 0 ? _b : null;
    }
    symbolForElement(element) {
        var _a;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let ref = element.dataset.id;
        if (!ref)
            return null;
        return (_a = this.refToSymbolEntryTable.get(ref)) !== null && _a !== void 0 ? _a : null;
    }
    handleEditorEvents() {
        let editor = this.activeEditor;
        let disposables = this.activeEditorDisposables;
        if (!editor || !disposables)
            return;
        disposables.add(editor.onDidStopChanging(() => {
            if (!editor)
                return;
            this.populateForEditor(editor);
        }), editor.onDidChangeCursorPosition(() => {
            let symbol = this.getActiveSymbolForEditor(editor);
            if (!symbol)
                return;
            this.setSelectedSymbol(symbol);
        }));
    }
    switchToEditor(editor) {
        var _a, _b;
        (_a = this.activeEditorDisposables) === null || _a === void 0 ? void 0 : _a.dispose();
        this.selectedSymbol = null;
        this.selectedRef = null;
        if (!editor) {
            this.activeEditorDisposables = null;
            this.setSymbols([]);
            return;
        }
        else {
            this.activeEditor = editor;
            this.activeEditorDisposables = new atom_1.CompositeDisposable();
            let newSymbols = [];
            if (this.editorSymbolsList.has(editor)) {
                newSymbols = (_b = this.editorSymbolsList.get(editor)) !== null && _b !== void 0 ? _b : [];
            }
            else {
                this.populateForEditor(editor);
            }
            this.setSymbols(newSymbols);
            this.handleEditorEvents();
        }
    }
    populateForEditor(editor) {
        return __awaiter(this, void 0, void 0, function* () {
            let symbols = yield this.getSymbols();
            if (!symbols || !editor)
                return;
            this.setSymbols(symbols, editor);
        });
    }
    toggle() {
        return atom.workspace.toggle(this);
    }
    show() {
        return __awaiter(this, void 0, void 0, function* () {
            yield atom.workspace.open(this, {
                searchAllPanes: true,
                activatePane: false,
                activateItem: false
            });
            this.activate();
        });
    }
    activate() {
        let container = atom.workspace.paneContainerForURI(this.getURI());
        if (!isDock(container))
            return;
        container.show();
        container.getActivePane().activateItemForURI(this.getURI());
        container.activate();
    }
    hide() {
        atom.workspace.hide(this);
    }
    focus() {
        var _a;
        (_a = this.refs) === null || _a === void 0 ? void 0 : _a.root.focus();
    }
    unfocus() {
        let center = atom.workspace.getCenter();
        center.getActivePane().activate();
    }
    setSymbols(symbols, editor) {
        this.symbols = symbols;
        if (editor && editor !== this.activeEditor)
            return;
        if (this.activeEditor) {
            this.editorSymbolsList.set(this.activeEditor, symbols);
        }
        return this.update()
            .then(() => {
            let symbol = this.getActiveSymbolForEditor(this.activeEditor);
            if (!symbol)
                return;
            this.setSelectedSymbol(symbol);
        });
    }
    getActiveSymbolForEditor(editor, flatSymbols) {
        editor !== null && editor !== void 0 ? editor : (editor = this.activeEditor);
        if (!editor)
            return null;
        let cursor = editor.getLastCursor();
        let position = cursor.getBufferPosition();
        let allSymbols = flatSymbols !== null && flatSymbols !== void 0 ? flatSymbols : this.getFlatSymbols();
        let candidate = null;
        for (let symbol of allSymbols) {
            let range = symbol.range;
            let { row } = position;
            if ((range.start.row !== row) && (range.end.row !== row)) {
                continue;
            }
            if (range.containsPoint(position)) {
                if (!candidate || !candidate.range.containsPoint(position) || range.compare(candidate.range) > 0) {
                    // Prefer whichever range is smaller, or else whichever one actually
                    // lies in the symbol's range instead of just touching the same row.
                    candidate = symbol;
                }
            }
            else if (!candidate) {
                // Even if it's not an exact match, use it if it happens to touch the
                // same row as the cursor.
                candidate = symbol;
            }
        }
        return candidate;
    }
    setSelectedSymbol(newSymbol) {
        if (this.selectedRef) {
            this.toggleRef(this.selectedRef, false);
        }
        this.selectedSymbol = null;
        this.selectedRef = null;
        if (!newSymbol)
            return;
        let newElement = this.getClosestVisibleElementForSymbol(newSymbol);
        if (!newElement) {
            console.error("[pulsar-outline-view] Could not find element for symbol:", newSymbol);
            return;
        }
        this.selectedSymbol = newSymbol;
        this.selectedRef = newElement;
        this.toggleRef(this.selectedRef, true);
        this.scrollSelectedEntryIntoViewIfNeeded();
    }
    scrollSelectedEntryIntoViewIfNeeded() {
        if (!this.selectedRef || !this.element)
            return;
        let element = this.selectedRef;
        if (element === null || element === void 0 ? void 0 : element.classList.contains('list-nested-item')) {
            element = element.querySelector('.list-item');
        }
        if (!element)
            return;
        let rect = element.getBoundingClientRect();
        let containerRect = this.element.getBoundingClientRect();
        if (rect.bottom > (containerRect.height - 50) || rect.top < 50) {
            this.selectedRef.scrollIntoView();
            this.element.scrollLeft = 0;
        }
    }
    getSelectedSymbol() {
        return this.selectedSymbol;
    }
    getClosestVisibleElementForSymbol(symbol) {
        var _a;
        let newElement = this.elementForSymbol(symbol);
        if (!newElement)
            return null;
        while (((_a = newElement === null || newElement === void 0 ? void 0 : newElement.offsetHeight) !== null && _a !== void 0 ? _a : 1) === 0) {
            let parentNode = newElement === null || newElement === void 0 ? void 0 : newElement.parentNode;
            if (!parentNode)
                return null;
            newElement = parentNode.closest('li');
        }
        return newElement !== null && newElement !== void 0 ? newElement : null;
    }
    revealInOutlineView(editor) {
        let symbol = this.getActiveSymbolForEditor(editor);
        if (!symbol)
            return;
        let element = this.elementForSymbol(symbol);
        if (!element)
            return;
        while (element.offsetHeight === 0) {
            let nearestCollapsedNode = element.closest('.collapsed');
            if (!nearestCollapsedNode)
                break;
            this.collapseEntry(nearestCollapsedNode);
        }
        this.setSelectedSymbol(symbol);
    }
    getSymbols() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.activeEditor)
                return null;
            let provider = this.broker.chooseProviderForEditor(this.activeEditor);
            if (!provider)
                return null;
            let outline = yield provider.getOutline(this.activeEditor);
            if (!outline)
                return null;
            return this.consumeOutline(outline);
        });
    }
    consumeOutline(outline) {
        this.outline = outline;
        let symbols = [];
        function consumeSymbol(symbol) {
            var _a, _b;
            let { icon, kind, plainText, tokenizedText, representativeName, startPosition, endPosition, children } = symbol;
            let range = new atom_1.Range(startPosition, endPosition !== null && endPosition !== void 0 ? endPosition : startPosition);
            let untokenizedText = undefined;
            if (tokenizedText) {
                untokenizedText = interpretTokenizedText(tokenizedText);
            }
            let result = {
                icon,
                kind,
                name: (_b = (_a = untokenizedText !== null && untokenizedText !== void 0 ? untokenizedText : plainText) !== null && _a !== void 0 ? _a : representativeName) !== null && _b !== void 0 ? _b : '',
                range
            };
            if (children && children.length > 0) {
                result.children = children.map(consumeSymbol);
            }
            return result;
        }
        for (let symbol of outline.outlineTrees) {
            symbols.push(consumeSymbol(symbol));
        }
        this.setSymbols(symbols);
        return symbols;
    }
    update() {
        return etch_1.default.update(this);
    }
    renderSymbol(symbol) {
        if (this.shouldIgnoreSymbol(symbol))
            return null;
        let children = null;
        let id = symbolId++;
        this.symbolEntryToRefTable.set(symbol, String(id));
        this.refToSymbolEntryTable.set(String(id), symbol);
        if (symbol.children) {
            children = symbol.children.map(sym => this.renderSymbol(sym));
            children = children.filter(c => c !== null && c !== void 0 ? c : false);
        }
        let childMenu = null;
        if (children && children.length > 0) {
            childMenu = (etch_1.default.dom("ul", { className: 'outline-list list-tree' }, children));
        }
        let nameClasses = (0, classnames_1.default)('name', getOctocatIconForOutlineIcon(symbol.icon));
        if (children && children.length > 0) {
            return (etch_1.default.dom("li", { className: "list-nested-item outline-view-entry", dataset: { id: String(id) }, ref: String(id) },
                etch_1.default.dom("div", { className: "outline-view-option list-item", tabIndex: -1 },
                    etch_1.default.dom("div", { className: nameClasses },
                        etch_1.default.dom("div", { className: "name-inner", title: titleForSymbol(symbol) }, symbol.name))),
                childMenu));
        }
        else {
            return (etch_1.default.dom("li", { className: "outline-view-entry outline-view-option list-item", tabIndex: -1, dataset: { id: String(id) }, ref: String(id) },
                etch_1.default.dom("div", { className: nameClasses },
                    etch_1.default.dom("div", { className: "name-inner", title: titleForSymbol(symbol) }, symbol.name))));
        }
    }
    render() {
        var _a;
        this.symbolEntryToRefTable.clear();
        this.refToSymbolEntryTable.clear();
        symbolId = 1;
        let symbols = (_a = this.symbols) !== null && _a !== void 0 ? _a : [];
        let symbolElements = symbols.map(sym => this.renderSymbol(sym));
        let rootClasses = (0, classnames_1.default)('tool-panel', 'outline-view', {
            'with-ellipsis-strategy': this.config.nameOverflowStrategy === 'ellipsis'
        });
        let contents = (etch_1.default.dom("ul", { className: 'background-message', style: { display: 'block' } },
            etch_1.default.dom("li", null, "No Symbols")));
        if (symbolElements.length > 0) {
            contents = (etch_1.default.dom("ul", { className: 'outline-list outline-list-root full-menu focusable-panel list-tree has-collapsable-children', ref: 'list' }, symbolElements));
        }
        return (etch_1.default.dom("div", { className: rootClasses, tabIndex: -1, ref: 'root' }, contents));
    }
    toggleRef(ref, add) {
        if (!ref)
            return;
        let item = ref;
        if (!item)
            return;
        if (add) {
            item.classList.add('selected');
        }
        else {
            item.classList.remove('selected');
        }
    }
    shouldIgnoreSymbol(symbol) {
        let { ignoredSymbolTypes } = this.config;
        if (symbol.kind && ignoredSymbolTypes.includes(symbol.kind))
            return true;
        if (symbol.icon && ignoredSymbolTypes.includes(symbol.icon))
            return true;
        return false;
    }
    getFlatSymbols() {
        if (!this.symbols)
            return [];
        let results = [];
        let processSymbols = (item) => {
            if (this.shouldIgnoreSymbol(item))
                return;
            results.push(item);
            if (item.children) {
                for (let child of item.children) {
                    processSymbols(child);
                }
            }
        };
        for (let symbol of this.symbols) {
            processSymbols(symbol);
        }
        return results;
    }
    isClickOnCaret(event) {
        var _a;
        let element = event.target;
        if (element === null || element === void 0 ? void 0 : element.matches('.name'))
            return false;
        // The caret comes from generated content in a `::before` CSS rule. We
        // can't detect whether it was clicked on, but we can measure the amount of
        // space allocated to the caret on the left side, and then ascertain that
        // the mouse was in that zone.
        let elRect = element.getBoundingClientRect();
        let nameRect = (_a = element.querySelector('.name')) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
        if (!nameRect)
            return false;
        let distance = nameRect.left - elRect.left;
        return event.offsetX < distance;
    }
    getVisibleListItems() {
        if (!this.element)
            return [];
        let choices = this.element.querySelectorAll('li.list-item, li.list-nested-item');
        if (!choices || choices.length === 0)
            return [];
        return Array.from(choices).filter(choice => {
            if (!('offsetHeight' in choice))
                return false;
            return choice.offsetHeight > 0;
        });
    }
}
exports.default = OutlineView;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0bGluZS12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vbGliL291dGxpbmUtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLG9CQUFvQjs7Ozs7Ozs7Ozs7Ozs7QUFFcEIsK0JBT2M7QUFFZCw0REFBb0M7QUFDcEMsZ0RBQXdCO0FBa0J4QixNQUFNLGdCQUFnQixHQUFHLDRCQUE0QixDQUFDO0FBQ3RELElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQztBQUN2QixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFFakIsU0FBUyxNQUFNLENBQUMsSUFBYTtJQUMzQixJQUFJLElBQUksS0FBSyxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzVELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDO0FBQzFDLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLGFBQW9DO0lBQ2xFLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNoQixLQUFLLElBQUksS0FBSyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQ2hDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDekIsQ0FBQztBQUVELFNBQVMsNEJBQTRCLENBQUMsV0FBb0I7SUFDeEQsUUFBUSxXQUFXLEVBQUUsQ0FBQztRQUNwQixLQUFLLGVBQWU7WUFDbEIsT0FBTyxXQUFXLENBQUM7UUFDckIsS0FBSyxhQUFhO1lBQ2hCLE9BQU8sV0FBVyxDQUFDO1FBQ3JCLEtBQUssZ0JBQWdCO1lBQ25CLE9BQU8sVUFBVSxDQUFDO1FBQ3BCLEtBQUssZUFBZTtZQUNsQixPQUFPLFdBQVcsQ0FBQztRQUNyQixLQUFLLFlBQVk7WUFDZixPQUFPLGNBQWMsQ0FBQztRQUN4QixL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QUksQ0FBQyxPQUFPO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDN0IsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ2pGLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDaEQsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUN6QyxJQUFJLENBQUMsQ0FBQyxjQUFjLElBQUksTUFBTSxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBQzlDLE9BQVEsTUFBc0IsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBQ2xELENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBRUQsa0JBQWUsV0FBVyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqIEBqc3ggZXRjaC5kb20gKi9cblxuaW1wb3J0IHtcbiAgQ29tcG9zaXRlRGlzcG9zYWJsZSxcbiAgRG9jayxcbiAgRW1pdHRlcixcbiAgUmFuZ2UsXG4gIFRleHRFZGl0b3IsXG4gIFdvcmtzcGFjZUNlbnRlclxufSBmcm9tICdhdG9tJztcbmltcG9ydCB0eXBlICogYXMgYXRvbUlkZSBmcm9tICdhdG9tLWlkZS1iYXNlJztcbmltcG9ydCBDbGFzc05hbWVzIGZyb20gJ2NsYXNzbmFtZXMnO1xuaW1wb3J0IGV0Y2ggZnJvbSAnZXRjaCc7XG5pbXBvcnQgUHJvdmlkZXJCcm9rZXIgZnJvbSAnLi9wcm92aWRlci1icm9rZXInO1xuXG5leHBvcnQgdHlwZSBTeW1ib2xFbnRyeSA9IHtcbiAgbmFtZTogc3RyaW5nLFxuICBpY29uPzogc3RyaW5nLFxuICBraW5kPzogc3RyaW5nLFxuICByYW5nZTogUmFuZ2UsXG4gIGNoaWxkcmVuPzogU3ltYm9sRW50cnlbXVxufTtcblxudHlwZSBPdXRsaW5lVmlld0NvbmZpZyA9IHtcbiAgdmlzaXRFbnRyaWVzT25LZXlib2FyZE1vdmVtZW50OiBib29sZWFuLFxuICBzaG93T25SaWdodFNpZGU6IGJvb2xlYW4sXG4gIG5hbWVPdmVyZmxvd1N0cmF0ZWd5OiAnc2Nyb2xsJyB8ICdlbGxpcHNpcycsXG4gIGlnbm9yZWRTeW1ib2xUeXBlczogc3RyaW5nW11cbn07XG5cbmNvbnN0IE9VVExJTkVfVklFV19VUkkgPSAnYXRvbTovL3B1bHNhci1vdXRsaW5lLXZpZXcnO1xubGV0IG5leHRJbnN0YW5jZUlkID0gMTtcbmxldCBzeW1ib2xJZCA9IDE7XG5cbmZ1bmN0aW9uIGlzRG9jayhpdGVtOiB1bmtub3duKTogaXRlbSBpcyBEb2NrIHtcbiAgaWYgKGl0ZW0gPT09IG51bGwgfHwgdHlwZW9mIGl0ZW0gIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBpdGVtLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdEb2NrJztcbn1cblxuZnVuY3Rpb24gaW50ZXJwcmV0VG9rZW5pemVkVGV4dCh0b2tlbml6ZWRUZXh0OiBhdG9tSWRlLlRva2VuaXplZFRleHQpOiBzdHJpbmcge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGZvciAobGV0IHRva2VuIG9mIHRva2VuaXplZFRleHQpIHtcbiAgICByZXN1bHQucHVzaCh0b2tlbi52YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdC5qb2luKCcnKTtcbn1cblxuZnVuY3Rpb24gZ2V0T2N0b2NhdEljb25Gb3JPdXRsaW5lSWNvbihvdXRsaW5lSWNvbj86IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICBzd2l0Y2ggKG91dGxpbmVJY29uKSB7XG4gICAgY2FzZSAndHlwZS1mdW5jdGlvbic6XG4gICAgICByZXR1cm4gJ2ljb24tZ2Vhcic7XG4gICAgY2FzZSAndHlwZS1tZXRob2QnOlxuICAgICAgcmV0dXJuICdpY29uLWdlYXInO1xuICAgIGNhc2UgJ3R5cGUtbmFtZXNwYWNlJzpcbiAgICAgIHJldHVybiAnaWNvbi10YWcnO1xuICAgIGNhc2UgJ3R5cGUtdmFyaWFibGUnOlxuICAgICAgcmV0dXJuICdpY29uLWNvZGUnO1xuICAgIGNhc2UgJ3R5cGUtY2xhc3MnOlxuICAgICAgcmV0dXJuICdpY29uLXBhY2thZ2UnO1xuICAgIGNhc2UgJ3R5cGUtY29uc3RhbnQnOlxuICAgICAgcmV0dXJuICdpY29uLXByaW1pdGl2ZS1zcXVhcmUnO1xuICAgIGNhc2UgJ3R5cGUtcHJvcGVydHknOlxuICAgICAgcmV0dXJuICdpY29uLXByaW1pdGl2ZS1kb3QnO1xuICAgIGNhc2UgJ3R5cGUtaW50ZXJmYWNlJzpcbiAgICAgIHJldHVybiAnaWNvbi1rZXknO1xuICAgIGNhc2UgJ3R5cGUtY29uc3RydWN0b3InOlxuICAgICAgcmV0dXJuICdpY29uLXRvb2xzJztcbiAgICBjYXNlICd0eXBlLW1vZHVsZSc6XG4gICAgICByZXR1cm4gJ2ljb24tZGF0YWJhc2UnO1xuICAgIGRlZmF1bHQ6XG4gICAgICBpZiAoIW91dGxpbmVJY29uPy5zdGFydHNXaXRoKCdpY29uLScpKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW3B1bHNhci1vdXRsaW5lLXZpZXddIFVubWFwcGVkIGljb246Jywgb3V0bGluZUljb24pO1xuICAgICAgfVxuICAgICAgaWYgKG91dGxpbmVJY29uPy5zdGFydHNXaXRoKCd0eXBlLScpKSB7XG4gICAgICAgIC8vIEZhbGxiYWNrIGZvciBhbGwgb3RoZXIgaWNvbiB0eXBlcyBmcm9tIGBhdG9tLWlkZS1vdXRsaW5lYC5cbiAgICAgICAgcmV0dXJuICdpY29uLWRhc2gnO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG91dGxpbmVJY29uID8/IG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gdGl0bGVGb3JTeW1ib2woc3ltYm9sOiBTeW1ib2xFbnRyeSkge1xuICBsZXQga2luZFRhZyA9ICcnO1xuICBpZiAoc3ltYm9sLmtpbmQpIHtcbiAgICBraW5kVGFnID0gYCAoJHtzeW1ib2wua2luZH0pYDtcbiAgfSBlbHNlIGlmIChzeW1ib2wuaWNvbikge1xuICAgIGtpbmRUYWcgPSBgICgke3N5bWJvbC5pY29ufSlgO1xuICB9XG4gIHJldHVybiBgJHtzeW1ib2wubmFtZX0ke2tpbmRUYWd9YDtcbn1cblxuY2xhc3MgT3V0bGluZVZpZXcge1xuICBwcm90ZWN0ZWQgaWQ6IG51bWJlcjtcbiAgcHJvdGVjdGVkIHJlZnM/OiB7IFtrZXk6IHN0cmluZ106IEhUTUxFbGVtZW50IH07XG4gIHByb3RlY3RlZCBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZTtcbiAgcHJvdGVjdGVkIGVtaXR0ZXI6IEVtaXR0ZXI7XG4gIHByb3RlY3RlZCBicm9rZXI6IFByb3ZpZGVyQnJva2VyO1xuICBwcm90ZWN0ZWQgc3ltYm9scz86IFN5bWJvbEVudHJ5W10gfCBudWxsO1xuICBwcm90ZWN0ZWQgc2VsZWN0ZWRTeW1ib2w/OiBTeW1ib2xFbnRyeSB8IG51bGw7XG4gIHByb3RlY3RlZCBvdXRsaW5lPzogYXRvbUlkZS5PdXRsaW5lIHwgbnVsbDtcbiAgcHJvdGVjdGVkIGFjdGl2ZUVkaXRvcj86IFRleHRFZGl0b3IgfCBudWxsO1xuICBwcm90ZWN0ZWQgYWN0aXZlRWRpdG9yRGlzcG9zYWJsZXM/OiBDb21wb3NpdGVEaXNwb3NhYmxlIHwgbnVsbDtcbiAgcHJvdGVjdGVkIHN5bWJvbEVudHJ5VG9SZWZUYWJsZTogTWFwPFN5bWJvbEVudHJ5LCBzdHJpbmc+O1xuICBwcm90ZWN0ZWQgcmVmVG9TeW1ib2xFbnRyeVRhYmxlOiBNYXA8c3RyaW5nLCBTeW1ib2xFbnRyeT47XG4gIHByb3RlY3RlZCBzZWxlY3RlZFJlZj86IEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgcHJvdGVjdGVkIGNvbmZpZzogT3V0bGluZVZpZXdDb25maWc7XG5cbiAgcHJvdGVjdGVkIGVkaXRvclN5bWJvbHNMaXN0OiBXZWFrTWFwPFRleHRFZGl0b3IsIFN5bWJvbEVudHJ5W10+O1xuXG4gIGNvbnN0cnVjdG9yKGJyb2tlcjogUHJvdmlkZXJCcm9rZXIsIF9zdGF0ZT86IHVua25vd24pIHtcbiAgICB0aGlzLmlkID0gbmV4dEluc3RhbmNlSWQrKztcbiAgICB0aGlzLmJyb2tlciA9IGJyb2tlcjtcblxuICAgIHRoaXMuZWRpdG9yU3ltYm9sc0xpc3QgPSBuZXcgTWFwKCk7XG4gICAgdGhpcy5zeW1ib2xFbnRyeVRvUmVmVGFibGUgPSBuZXcgTWFwKCk7XG4gICAgdGhpcy5yZWZUb1N5bWJvbEVudHJ5VGFibGUgPSBuZXcgTWFwKCk7XG4gICAgdGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKCk7XG4gICAgdGhpcy5lbWl0dGVyID0gbmV3IEVtaXR0ZXIoKTtcbiAgICB0aGlzLmFjdGl2ZUVkaXRvciA9IG51bGw7XG4gICAgdGhpcy5jb25maWcgPSBhdG9tLmNvbmZpZy5nZXQoJ3B1bHNhci1vdXRsaW5lLXZpZXcnKTtcblxuICAgIGV0Y2guaW5pdGlhbGl6ZSh0aGlzKTtcbiAgICBldGNoLnNldFNjaGVkdWxlcihhdG9tLnZpZXdzKTtcblxuICAgIHRoaXMuZWxlbWVudD8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgICAgIGlmICghdGhpcy5hY3RpdmVFZGl0b3IpIHJldHVybjtcbiAgICAgIGlmICh0aGlzLmlzQ2xpY2tPbkNhcmV0KGV2ZW50KSkge1xuICAgICAgICBsZXQgdGFyZ2V0ID0gKGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCk/LmNsb3Nlc3QoJ2xpLm91dGxpbmUtdmlldy1lbnRyeScpO1xuICAgICAgICBpZiAoIXRhcmdldCkgcmV0dXJuO1xuICAgICAgICByZXR1cm4gdGhpcy5jb2xsYXBzZUVudHJ5KHRhcmdldCk7XG4gICAgICB9XG5cbiAgICAgIGxldCB0YXJnZXQgPSAoZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uY2xvc2VzdCgnbGkub3V0bGluZS12aWV3LWVudHJ5Jyk7XG4gICAgICBpZiAoIXRhcmdldCkgcmV0dXJuO1xuXG4gICAgICBsZXQgcmVmID0gKHRhcmdldCBhcyBIVE1MRWxlbWVudCkuZGF0YXNldC5pZDtcbiAgICAgIGlmICghcmVmKSByZXR1cm47XG5cbiAgICAgIGxldCBzeW1ib2wgPSB0aGlzLnJlZlRvU3ltYm9sRW50cnlUYWJsZS5nZXQocmVmKTtcbiAgICAgIGlmICghc3ltYm9sKSByZXR1cm47XG5cbiAgICAgIHRoaXMubW92ZUVkaXRvclRvU3ltYm9sKHN5bWJvbCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmhhbmRsZUV2ZW50cygpO1xuXG4gICAgbGV0IGVkaXRvciA9IGF0b20ud29ya3NwYWNlLmdldEFjdGl2ZVRleHRFZGl0b3IoKTtcbiAgICBpZiAoZWRpdG9yKSB7XG4gICAgICB0aGlzLnN3aXRjaFRvRWRpdG9yKGVkaXRvcik7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZGVzdHJveSgpIHtcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcbiAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnZGlkLWRlc3Ryb3knKTtcbiAgICBhd2FpdCBldGNoLmRlc3Ryb3kodGhpcyk7XG4gIH1cblxuICBvbkRpZERlc3Ryb3koY2FsbGJhY2s6ICgpID0+IHZvaWQpIHtcbiAgICByZXR1cm4gdGhpcy5lbWl0dGVyLm9uKCdkaWQtZGVzdHJveScsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIGdldFRpdGxlKCkge1xuICAgIHJldHVybiBcIk91dGxpbmVcIjtcbiAgfVxuXG4gIGdldFVSSSgpIHtcbiAgICByZXR1cm4gT1VUTElORV9WSUVXX1VSSTtcbiAgfVxuXG4gIGdldEljb25OYW1lKCkge1xuICAgIHJldHVybiAnbGlzdC11bm9yZGVyZWQnO1xuICB9XG5cbiAgZ2V0QWxsb3dlZExvY2F0aW9ucygpIHtcbiAgICAvLyBXaGVuIHRoZSB3b3Jrc3BhY2UgY2hvb3NlcyBhIGRvY2sgbG9jYXRpb24gZm9yIGFuIGl0ZW0sIGl0J2xsIGNob29zZSB0aGVcbiAgICAvLyBmaXJzdCBvbmUgaW5kaWNhdGVkIGluIHRoaXMgYXJyYXkuXG4gICAgaWYgKHRoaXMuY29uZmlnLnNob3dPblJpZ2h0U2lkZSkge1xuICAgICAgcmV0dXJuIFsncmlnaHQnLCAnbGVmdCddO1xuICAgIH1cbiAgICByZXR1cm4gWydsZWZ0JywgJ3JpZ2h0J107XG4gIH1cblxuICBpc1Blcm1hbmVudERvY2tJdGVtKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGdldFByZWZlcnJlZFdpZHRoKCkge1xuICAgIGlmICghdGhpcy5yZWZzIHx8ICF0aGlzLnJlZnMubGlzdCkgcmV0dXJuO1xuICAgIHRoaXMucmVmcy5saXN0LnN0eWxlLndpZHRoID0gJ21pbi1jb250ZW50JztcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5yZWZzLmxpc3Qub2Zmc2V0V2lkdGg7XG4gICAgdGhpcy5yZWZzLmxpc3Quc3R5bGUud2lkdGggPSAnJztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaGFuZGxlRXZlbnRzKCkge1xuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKFxuICAgICAgYXRvbS5jb25maWcub25EaWRDaGFuZ2UoJ3B1bHNhci1vdXRsaW5lLXZpZXcnLCAoeyBuZXdWYWx1ZSB9KSA9PiB7XG4gICAgICAgIHRoaXMuY29uZmlnID0gbmV3VmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICB9KSxcbiAgICAgIGF0b20ud29ya3NwYWNlLm9uRGlkQ2hhbmdlQWN0aXZlVGV4dEVkaXRvcihlZGl0b3IgPT4ge1xuICAgICAgICBpZiAoZWRpdG9yKSB7XG4gICAgICAgICAgLy8gSWYgdGhlIG5ldyBhY3RpdmUgaXRlbSBpc24ndCBhIFRleHRFZGl0b3IsIHdlIHdvbid0IHJlcGxhY2UgdGhlXG4gICAgICAgICAgLy8gcHJldmlvdXMgdGV4dCBlZGl0b3IsIGJlY2F1c2UgdGhlIG91dGxpbmUgdmlldyB3aWxsIHN0aWxsIHNob3dcbiAgICAgICAgICAvLyB0aGF0IGVkaXRvcidzIHN5bWJvbHMuXG4gICAgICAgICAgdGhpcy5hY3RpdmVFZGl0b3I7XG4gICAgICAgICAgdGhpcy5zd2l0Y2hUb0VkaXRvcihlZGl0b3IpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgaWYgKHRoaXMuZWxlbWVudCkge1xuICAgICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoXG4gICAgICAgIGF0b20uY29tbWFuZHMuYWRkKFxuICAgICAgICAgIHRoaXMuZWxlbWVudCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICAnY29yZTptb3ZlLXVwJzogKGUpID0+IHRoaXMubW92ZVVwKGUpLFxuICAgICAgICAgICAgJ2NvcmU6bW92ZS1kb3duJzogKGUpID0+IHRoaXMubW92ZURvd24oZSksXG4gICAgICAgICAgICAnY29yZTptb3ZlLXRvLXRvcCc6IChlKSA9PiB0aGlzLm1vdmVUb1RvcChlKSxcbiAgICAgICAgICAgICdjb3JlOm1vdmUtdG8tYm90dG9tJzogKGUpID0+IHRoaXMubW92ZVRvQm90dG9tKGUpLFxuICAgICAgICAgICAgJ3B1bHNhci1vdXRsaW5lLXZpZXc6Y29sbGFwc2Utc2VsZWN0ZWQtZW50cnknOiAoKSA9PiB0aGlzLmNvbGxhcHNlU2VsZWN0ZWRFbnRyeSgpLFxuICAgICAgICAgICAgJ3B1bHNhci1vdXRsaW5lLXZpZXc6YWN0aXZhdGUtc2VsZWN0ZWQtZW50cnknOiAoKSA9PiB0aGlzLmFjdGl2YXRlU2VsZWN0ZWRFbnRyeSgpXG4gICAgICAgICAgfVxuICAgICAgICApXG4gICAgICApO1xuXG4gICAgICB0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXMnLCAoKSA9PiB7XG4gICAgICAgIGlmICghdGhpcy5zZWxlY3RlZFJlZikge1xuICAgICAgICAgIHRoaXMubW92ZVRvSW5kZXgoMCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zZWxlY3RlZFJlZj8uZm9jdXMoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGlzRm9jdXNlZCgpIHtcbiAgICBpZiAoIXRoaXMuZWxlbWVudCkgcmV0dXJuIGZhbHNlO1xuICAgIGxldCBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICAgIHJldHVybiB0aGlzLmVsZW1lbnQgPT09IGFjdGl2ZSB8fCB0aGlzLmVsZW1lbnQuY29udGFpbnMoYWN0aXZlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlIHRoZSBzZWxlY3Rpb24gdXAgdG8gdGhlIHByZXZpb3VzIGl0ZW0uXG4gICAqIEBwYXJhbSBldmVudCBDb21tYW5kIGV2ZW50LlxuICAgKi9cbiAgbW92ZVVwKGV2ZW50OiBFdmVudCkge1xuICAgIHJldHVybiB0aGlzLm1vdmVEZWx0YShldmVudCwgLTEpO1xuICB9XG5cbiAgLyoqXG4gICAqIE1vdmUgdGhlIHNlbGVjdGlvbiBkb3duIHRvIHRoZSBuZXh0IGl0ZW0uXG4gICAqIEBwYXJhbSBldmVudCBDb21tYW5kIGV2ZW50LlxuICAgKi9cbiAgbW92ZURvd24oZXZlbnQ6IEV2ZW50KSB7XG4gICAgcmV0dXJuIHRoaXMubW92ZURlbHRhKGV2ZW50LCAxKTtcbiAgfVxuXG4gIG1vdmVEZWx0YShldmVudDogRXZlbnQsIGRlbHRhOiBudW1iZXIpIHtcbiAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICBsZXQgaXRlbXMgPSB0aGlzLmdldFZpc2libGVMaXN0SXRlbXMoKTtcblxuICAgIGxldCBzeW1ib2wgPSB0aGlzLmdldFNlbGVjdGVkU3ltYm9sKCk7XG4gICAgaWYgKCFzeW1ib2wpIHJldHVybjtcblxuICAgIGxldCBlbGVtZW50ID0gdGhpcy5lbGVtZW50Rm9yU3ltYm9sKHN5bWJvbCk7XG4gICAgaWYgKCFlbGVtZW50KSByZXR1cm47XG5cbiAgICBsZXQgaW5kZXggPSBpdGVtcy5pbmRleE9mKGVsZW1lbnQpO1xuICAgIGlmIChpbmRleCA9PT0gLTEpIHJldHVybjtcblxuICAgIGxldCBuZXdJbmRleCA9IGluZGV4ICsgZGVsdGE7XG4gICAgaWYgKG5ld0luZGV4ID49IGl0ZW1zLmxlbmd0aCkgbmV3SW5kZXggPSBpdGVtcy5sZW5ndGggLSAxO1xuICAgIGlmIChuZXdJbmRleCA8IDApIG5ld0luZGV4ID0gMDtcblxuICAgIHJldHVybiB0aGlzLm1vdmVUb0luZGV4KG5ld0luZGV4LCBpdGVtcyk7XG4gIH1cblxuICAvKipcbiAgICogTW92ZSB0byBhIHN5bWJvbCB3aXRoIGEgc3BlY2lmaWMgaW5kZXggaW4gdGhlIGZsYXQgbGlzdCBvZiB2aXNpYmxlIHN5bWJvbHMuXG4gICAqIEBwYXJhbSBpbmRleCBUaGUgaW5kZXggdG8gbW92ZSB0by5cbiAgICogQHBhcmFtIGl0ZW1zIEFuIG9wdGlvbmFsIGFycmF5IG9mIG5vZGVzIGluIGNhc2UgeW91J3ZlIGFscmVhZHkgZG9uZSB0aGVcbiAgICogICB3b3JrLlxuICAgKi9cbiAgbW92ZVRvSW5kZXgoaW5kZXg6IG51bWJlciwgaXRlbXM/OiBFbGVtZW50W10pOiB2b2lkIHtcbiAgICBpZiAoIWl0ZW1zKSB7XG4gICAgICBpdGVtcyA9IHRoaXMuZ2V0VmlzaWJsZUxpc3RJdGVtcygpO1xuICAgIH1cbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICBpbmRleCA9IGl0ZW1zLmxlbmd0aCArIGluZGV4O1xuICAgIH1cblxuICAgIGxldCBzeW1ib2wgPSB0aGlzLnN5bWJvbEZvckVsZW1lbnQoaXRlbXNbaW5kZXhdIGFzIEhUTUxFbGVtZW50KTtcbiAgICBpZiAoIXN5bWJvbCkgcmV0dXJuO1xuXG4gICAgdGhpcy5zZXRTZWxlY3RlZFN5bWJvbChzeW1ib2wpO1xuICAgIGlmICh0aGlzLmNvbmZpZz8udmlzaXRFbnRyaWVzT25LZXlib2FyZE1vdmVtZW50KSB7XG4gICAgICB0aGlzLmFjdGl2YXRlU2VsZWN0ZWRFbnRyeSgpO1xuICAgIH1cbiAgfVxuXG4gIG1vdmVUb1RvcChldmVudDogRXZlbnQpIHtcbiAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLm1vdmVUb0luZGV4KDApO1xuICB9XG5cbiAgbW92ZVRvQm90dG9tKGV2ZW50OiBFdmVudCkge1xuICAgIGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMubW92ZVRvSW5kZXgoLTEpO1xuICB9XG5cbiAgY29sbGFwc2VTZWxlY3RlZEVudHJ5KCkge1xuICAgIGlmICghdGhpcy5zZWxlY3RlZFN5bWJvbCkgcmV0dXJuO1xuICAgIGxldCBlbGVtZW50ID0gdGhpcy5lbGVtZW50Rm9yU3ltYm9sKHRoaXMuc2VsZWN0ZWRTeW1ib2wpO1xuICAgIGlmICghZWxlbWVudD8uY2xhc3NMaXN0LmNvbnRhaW5zKCdsaXN0LW5lc3RlZC1pdGVtJykpIHJldHVybjtcblxuICAgIHJldHVybiB0aGlzLmNvbGxhcHNlRW50cnkoZWxlbWVudCk7XG4gIH1cblxuICBjb2xsYXBzZUVudHJ5KGVsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgICBsZXQgY2hpbGRyZW5Hcm91cCA9IGVsZW1lbnQucXVlcnlTZWxlY3RvcignLmxpc3QtdHJlZScpO1xuICAgIGlmICghY2hpbGRyZW5Hcm91cCkgcmV0dXJuO1xuXG4gICAgbGV0IGlzQ29sbGFwc2VkID0gZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbGxhcHNlZCcpO1xuICAgIGlmIChpc0NvbGxhcHNlZCkge1xuICAgICAgY2hpbGRyZW5Hcm91cC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcbiAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnY29sbGFwc2VkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNoaWxkcmVuR3JvdXAuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2NvbGxhcHNlZCcpO1xuICAgIH1cbiAgfVxuXG4gIGFjdGl2YXRlU2VsZWN0ZWRFbnRyeSgpIHtcbiAgICBpZiAoIXRoaXMuc2VsZWN0ZWRTeW1ib2wpIHJldHVybjtcbiAgICB0aGlzLm1vdmVFZGl0b3JUb1N5bWJvbCh0aGlzLnNlbGVjdGVkU3ltYm9sKTtcbiAgfVxuXG4gIG1vdmVFZGl0b3JUb1N5bWJvbChzeW1ib2w6IFN5bWJvbEVudHJ5KSB7XG4gICAgaWYgKHN5bWJvbCAmJiB0aGlzLmFjdGl2ZUVkaXRvcikge1xuICAgICAgdGhpcy5hY3RpdmVFZGl0b3Iuc2V0Q3Vyc29yQnVmZmVyUG9zaXRpb24oXG4gICAgICAgIHN5bWJvbC5yYW5nZS5zdGFydCxcbiAgICAgICAgeyBhdXRvc2Nyb2xsOiBmYWxzZSB9XG4gICAgICApO1xuICAgICAgdGhpcy5hY3RpdmVFZGl0b3Iuc2Nyb2xsVG9DdXJzb3JQb3NpdGlvbih7IGNlbnRlcjogdHJ1ZSB9KTtcbiAgICB9XG4gIH1cblxuICBnZXQgZWxlbWVudCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlZnM/LnJvb3QgPz8gbnVsbDtcbiAgfVxuXG4gIGVsZW1lbnRGb3JTeW1ib2woc3ltYm9sOiBTeW1ib2xFbnRyeSk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gICAgbGV0IHJlZiA9IHRoaXMuc3ltYm9sRW50cnlUb1JlZlRhYmxlLmdldChzeW1ib2wpO1xuICAgIGlmICghcmVmKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gdGhpcy5yZWZzPy5bcmVmXSA/PyBudWxsO1xuICB9XG5cbiAgc3ltYm9sRm9yRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCk6IFN5bWJvbEVudHJ5IHwgbnVsbCB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBsZXQgcmVmID0gKGVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpLmRhdGFzZXQuaWQ7XG4gICAgaWYgKCFyZWYpIHJldHVybiBudWxsO1xuICAgIHJldHVybiB0aGlzLnJlZlRvU3ltYm9sRW50cnlUYWJsZS5nZXQocmVmKSA/PyBudWxsO1xuICB9XG5cbiAgaGFuZGxlRWRpdG9yRXZlbnRzKCkge1xuICAgIGxldCBlZGl0b3IgPSB0aGlzLmFjdGl2ZUVkaXRvcjtcbiAgICBsZXQgZGlzcG9zYWJsZXMgPSB0aGlzLmFjdGl2ZUVkaXRvckRpc3Bvc2FibGVzO1xuICAgIGlmICghZWRpdG9yIHx8ICFkaXNwb3NhYmxlcykgcmV0dXJuO1xuXG4gICAgZGlzcG9zYWJsZXMuYWRkKFxuICAgICAgZWRpdG9yLm9uRGlkU3RvcENoYW5naW5nKCgpID0+IHtcbiAgICAgICAgaWYgKCFlZGl0b3IpIHJldHVybjtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZUZvckVkaXRvcihlZGl0b3IpO1xuICAgICAgfSksXG4gICAgICBlZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbigoKSA9PiB7XG4gICAgICAgIGxldCBzeW1ib2wgPSB0aGlzLmdldEFjdGl2ZVN5bWJvbEZvckVkaXRvcihlZGl0b3IpO1xuICAgICAgICBpZiAoIXN5bWJvbCkgcmV0dXJuO1xuICAgICAgICB0aGlzLnNldFNlbGVjdGVkU3ltYm9sKHN5bWJvbCk7XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICBzd2l0Y2hUb0VkaXRvcihlZGl0b3I6IFRleHRFZGl0b3IpIHtcbiAgICB0aGlzLmFjdGl2ZUVkaXRvckRpc3Bvc2FibGVzPy5kaXNwb3NlKCk7XG4gICAgdGhpcy5zZWxlY3RlZFN5bWJvbCA9IG51bGw7XG4gICAgdGhpcy5zZWxlY3RlZFJlZiA9IG51bGw7XG5cbiAgICBpZiAoIWVkaXRvcikge1xuICAgICAgdGhpcy5hY3RpdmVFZGl0b3JEaXNwb3NhYmxlcyA9IG51bGw7XG4gICAgICB0aGlzLnNldFN5bWJvbHMoW10pO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFjdGl2ZUVkaXRvciA9IGVkaXRvcjtcbiAgICAgIHRoaXMuYWN0aXZlRWRpdG9yRGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpO1xuXG4gICAgICBsZXQgbmV3U3ltYm9sczogU3ltYm9sRW50cnlbXSA9IFtdO1xuICAgICAgaWYgKHRoaXMuZWRpdG9yU3ltYm9sc0xpc3QuaGFzKGVkaXRvcikpIHtcbiAgICAgICAgbmV3U3ltYm9scyA9IHRoaXMuZWRpdG9yU3ltYm9sc0xpc3QuZ2V0KGVkaXRvcikgPz8gW107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnBvcHVsYXRlRm9yRWRpdG9yKGVkaXRvcik7XG4gICAgICB9XG4gICAgICB0aGlzLnNldFN5bWJvbHMobmV3U3ltYm9scyk7XG4gICAgICB0aGlzLmhhbmRsZUVkaXRvckV2ZW50cygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHBvcHVsYXRlRm9yRWRpdG9yKGVkaXRvcjogVGV4dEVkaXRvcikge1xuICAgIGxldCBzeW1ib2xzID0gYXdhaXQgdGhpcy5nZXRTeW1ib2xzKCk7XG4gICAgaWYgKCFzeW1ib2xzIHx8ICFlZGl0b3IpIHJldHVybjtcbiAgICB0aGlzLnNldFN5bWJvbHMoc3ltYm9scywgZWRpdG9yKTtcbiAgfVxuXG4gIHRvZ2dsZSgpIHtcbiAgICByZXR1cm4gYXRvbS53b3Jrc3BhY2UudG9nZ2xlKHRoaXMpO1xuICB9XG5cbiAgYXN5bmMgc2hvdygpIHtcbiAgICBhd2FpdCBhdG9tLndvcmtzcGFjZS5vcGVuKHRoaXMsIHtcbiAgICAgIHNlYXJjaEFsbFBhbmVzOiB0cnVlLFxuICAgICAgYWN0aXZhdGVQYW5lOiBmYWxzZSxcbiAgICAgIGFjdGl2YXRlSXRlbTogZmFsc2VcbiAgICB9KTtcbiAgICB0aGlzLmFjdGl2YXRlKCk7XG4gIH1cblxuICBhY3RpdmF0ZSgpIHtcbiAgICBsZXQgY29udGFpbmVyID0gYXRvbS53b3Jrc3BhY2UucGFuZUNvbnRhaW5lckZvclVSSSh0aGlzLmdldFVSSSgpKTtcbiAgICBpZiAoIWlzRG9jayhjb250YWluZXIpKSByZXR1cm47XG4gICAgY29udGFpbmVyLnNob3coKTtcbiAgICBjb250YWluZXIuZ2V0QWN0aXZlUGFuZSgpLmFjdGl2YXRlSXRlbUZvclVSSSh0aGlzLmdldFVSSSgpKTtcbiAgICBjb250YWluZXIuYWN0aXZhdGUoKTtcbiAgfVxuXG4gIGhpZGUoKSB7XG4gICAgYXRvbS53b3Jrc3BhY2UuaGlkZSh0aGlzKTtcbiAgfVxuXG4gIGZvY3VzKCkge1xuICAgIHRoaXMucmVmcz8ucm9vdC5mb2N1cygpO1xuICB9XG5cbiAgdW5mb2N1cygpIHtcbiAgICBsZXQgY2VudGVyOiBXb3Jrc3BhY2VDZW50ZXIgPSBhdG9tLndvcmtzcGFjZS5nZXRDZW50ZXIoKTtcbiAgICBjZW50ZXIuZ2V0QWN0aXZlUGFuZSgpLmFjdGl2YXRlKCk7XG4gIH1cblxuICBzZXRTeW1ib2xzKHN5bWJvbHM6IFN5bWJvbEVudHJ5W10sIGVkaXRvcj86IFRleHRFZGl0b3IpIHtcbiAgICB0aGlzLnN5bWJvbHMgPSBzeW1ib2xzO1xuICAgIGlmIChlZGl0b3IgJiYgZWRpdG9yICE9PSB0aGlzLmFjdGl2ZUVkaXRvcikgcmV0dXJuO1xuICAgIGlmICh0aGlzLmFjdGl2ZUVkaXRvcikge1xuICAgICAgdGhpcy5lZGl0b3JTeW1ib2xzTGlzdC5zZXQodGhpcy5hY3RpdmVFZGl0b3IsIHN5bWJvbHMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy51cGRhdGUoKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICBsZXQgc3ltYm9sID0gdGhpcy5nZXRBY3RpdmVTeW1ib2xGb3JFZGl0b3IodGhpcy5hY3RpdmVFZGl0b3IpO1xuICAgICAgICBpZiAoIXN5bWJvbCkgcmV0dXJuO1xuICAgICAgICB0aGlzLnNldFNlbGVjdGVkU3ltYm9sKHN5bWJvbCk7XG4gICAgICB9KTtcbiAgfVxuXG4gIGdldEFjdGl2ZVN5bWJvbEZvckVkaXRvcihlZGl0b3I/OiBUZXh0RWRpdG9yIHwgbnVsbCwgZmxhdFN5bWJvbHM/OiBTeW1ib2xFbnRyeVtdKTogU3ltYm9sRW50cnkgfCBudWxsIHtcbiAgICBlZGl0b3IgPz89IHRoaXMuYWN0aXZlRWRpdG9yO1xuICAgIGlmICghZWRpdG9yKSByZXR1cm4gbnVsbDtcblxuICAgIGxldCBjdXJzb3IgPSBlZGl0b3IuZ2V0TGFzdEN1cnNvcigpO1xuICAgIGxldCBwb3NpdGlvbiA9IGN1cnNvci5nZXRCdWZmZXJQb3NpdGlvbigpO1xuXG4gICAgbGV0IGFsbFN5bWJvbHMgPSBmbGF0U3ltYm9scyA/PyB0aGlzLmdldEZsYXRTeW1ib2xzKCk7XG4gICAgbGV0IGNhbmRpZGF0ZSA9IG51bGw7XG4gICAgZm9yIChsZXQgc3ltYm9sIG9mIGFsbFN5bWJvbHMpIHtcbiAgICAgIGxldCByYW5nZSA9IHN5bWJvbC5yYW5nZTtcbiAgICAgIGxldCB7IHJvdyB9ID0gcG9zaXRpb247XG4gICAgICBpZiAoKHJhbmdlLnN0YXJ0LnJvdyAhPT0gcm93KSAmJiAocmFuZ2UuZW5kLnJvdyAhPT0gcm93KSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZS5jb250YWluc1BvaW50KHBvc2l0aW9uKSkge1xuICAgICAgICBpZiAoIWNhbmRpZGF0ZSB8fCAhY2FuZGlkYXRlLnJhbmdlLmNvbnRhaW5zUG9pbnQocG9zaXRpb24pIHx8IHJhbmdlLmNvbXBhcmUoY2FuZGlkYXRlLnJhbmdlKSA+IDApIHtcbiAgICAgICAgICAvLyBQcmVmZXIgd2hpY2hldmVyIHJhbmdlIGlzIHNtYWxsZXIsIG9yIGVsc2Ugd2hpY2hldmVyIG9uZSBhY3R1YWxseVxuICAgICAgICAgIC8vIGxpZXMgaW4gdGhlIHN5bWJvbCdzIHJhbmdlIGluc3RlYWQgb2YganVzdCB0b3VjaGluZyB0aGUgc2FtZSByb3cuXG4gICAgICAgICAgY2FuZGlkYXRlID0gc3ltYm9sO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFjYW5kaWRhdGUpIHtcbiAgICAgICAgLy8gRXZlbiBpZiBpdCdzIG5vdCBhbiBleGFjdCBtYXRjaCwgdXNlIGl0IGlmIGl0IGhhcHBlbnMgdG8gdG91Y2ggdGhlXG4gICAgICAgIC8vIHNhbWUgcm93IGFzIHRoZSBjdXJzb3IuXG4gICAgICAgIGNhbmRpZGF0ZSA9IHN5bWJvbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY2FuZGlkYXRlO1xuICB9XG5cbiAgc2V0U2VsZWN0ZWRTeW1ib2wobmV3U3ltYm9sOiBTeW1ib2xFbnRyeSB8IG51bGwpIHtcbiAgICBpZiAodGhpcy5zZWxlY3RlZFJlZikge1xuICAgICAgdGhpcy50b2dnbGVSZWYodGhpcy5zZWxlY3RlZFJlZiwgZmFsc2UpO1xuICAgIH1cblxuICAgIHRoaXMuc2VsZWN0ZWRTeW1ib2wgPSBudWxsO1xuICAgIHRoaXMuc2VsZWN0ZWRSZWYgPSBudWxsO1xuXG4gICAgaWYgKCFuZXdTeW1ib2wpIHJldHVybjtcblxuICAgIGxldCBuZXdFbGVtZW50ID0gdGhpcy5nZXRDbG9zZXN0VmlzaWJsZUVsZW1lbnRGb3JTeW1ib2wobmV3U3ltYm9sKTtcbiAgICBpZiAoIW5ld0VsZW1lbnQpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbcHVsc2FyLW91dGxpbmUtdmlld10gQ291bGQgbm90IGZpbmQgZWxlbWVudCBmb3Igc3ltYm9sOlwiLCBuZXdTeW1ib2wpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc2VsZWN0ZWRTeW1ib2wgPSBuZXdTeW1ib2w7XG4gICAgdGhpcy5zZWxlY3RlZFJlZiA9IG5ld0VsZW1lbnQ7XG4gICAgdGhpcy50b2dnbGVSZWYodGhpcy5zZWxlY3RlZFJlZiwgdHJ1ZSk7XG4gICAgdGhpcy5zY3JvbGxTZWxlY3RlZEVudHJ5SW50b1ZpZXdJZk5lZWRlZCgpO1xuICB9XG5cbiAgc2Nyb2xsU2VsZWN0ZWRFbnRyeUludG9WaWV3SWZOZWVkZWQoKSB7XG4gICAgaWYgKCF0aGlzLnNlbGVjdGVkUmVmIHx8ICF0aGlzLmVsZW1lbnQpIHJldHVybjtcbiAgICBsZXQgZWxlbWVudCA9IHRoaXMuc2VsZWN0ZWRSZWYgYXMgKEhUTUxFbGVtZW50IHwgbnVsbCk7XG4gICAgaWYgKGVsZW1lbnQ/LmNsYXNzTGlzdC5jb250YWlucygnbGlzdC1uZXN0ZWQtaXRlbScpKSB7XG4gICAgICBlbGVtZW50ID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcubGlzdC1pdGVtJyk7XG4gICAgfVxuICAgIGlmICghZWxlbWVudCkgcmV0dXJuO1xuXG4gICAgbGV0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGxldCBjb250YWluZXJSZWN0ID0gdGhpcy5lbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgaWYgKHJlY3QuYm90dG9tID4gKGNvbnRhaW5lclJlY3QuaGVpZ2h0IC0gNTApIHx8IHJlY3QudG9wIDwgNTApIHtcbiAgICAgIHRoaXMuc2VsZWN0ZWRSZWYuc2Nyb2xsSW50b1ZpZXcoKTtcbiAgICAgIHRoaXMuZWxlbWVudC5zY3JvbGxMZWZ0ID0gMDtcbiAgICB9XG4gIH1cblxuICBnZXRTZWxlY3RlZFN5bWJvbCgpIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RlZFN5bWJvbDtcbiAgfVxuXG4gIGdldENsb3Nlc3RWaXNpYmxlRWxlbWVudEZvclN5bWJvbChzeW1ib2w6IFN5bWJvbEVudHJ5KTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgICBsZXQgbmV3RWxlbWVudCA9IHRoaXMuZWxlbWVudEZvclN5bWJvbChzeW1ib2wpO1xuICAgIGlmICghbmV3RWxlbWVudCkgcmV0dXJuIG51bGw7XG5cbiAgICB3aGlsZSAoKG5ld0VsZW1lbnQ/Lm9mZnNldEhlaWdodCA/PyAxKSA9PT0gMCkge1xuICAgICAgbGV0IHBhcmVudE5vZGUgPSBuZXdFbGVtZW50Py5wYXJlbnROb2RlIGFzIEhUTUxFbGVtZW50O1xuICAgICAgaWYgKCFwYXJlbnROb2RlKSByZXR1cm4gbnVsbDtcbiAgICAgIG5ld0VsZW1lbnQgPSBwYXJlbnROb2RlLmNsb3Nlc3QoJ2xpJyk7XG4gICAgfVxuICAgIHJldHVybiBuZXdFbGVtZW50ID8/IG51bGw7XG4gIH1cblxuICByZXZlYWxJbk91dGxpbmVWaWV3KGVkaXRvcjogVGV4dEVkaXRvcikge1xuICAgIGxldCBzeW1ib2wgPSB0aGlzLmdldEFjdGl2ZVN5bWJvbEZvckVkaXRvcihlZGl0b3IpO1xuICAgIGlmICghc3ltYm9sKSByZXR1cm47XG5cbiAgICBsZXQgZWxlbWVudCA9IHRoaXMuZWxlbWVudEZvclN5bWJvbChzeW1ib2wpO1xuICAgIGlmICghZWxlbWVudCkgcmV0dXJuO1xuXG4gICAgd2hpbGUgKGVsZW1lbnQub2Zmc2V0SGVpZ2h0ID09PSAwKSB7XG4gICAgICBsZXQgbmVhcmVzdENvbGxhcHNlZE5vZGUgPSBlbGVtZW50LmNsb3Nlc3QoJy5jb2xsYXBzZWQnKTtcbiAgICAgIGlmICghbmVhcmVzdENvbGxhcHNlZE5vZGUpIGJyZWFrO1xuICAgICAgdGhpcy5jb2xsYXBzZUVudHJ5KG5lYXJlc3RDb2xsYXBzZWROb2RlKTtcbiAgICB9XG5cbiAgICB0aGlzLnNldFNlbGVjdGVkU3ltYm9sKHN5bWJvbCk7XG4gIH1cblxuICBhc3luYyBnZXRTeW1ib2xzKCk6IFByb21pc2U8U3ltYm9sRW50cnlbXSB8IG51bGw+IHtcbiAgICBpZiAoIXRoaXMuYWN0aXZlRWRpdG9yKSByZXR1cm4gbnVsbDtcblxuICAgIGxldCBwcm92aWRlciA9IHRoaXMuYnJva2VyLmNob29zZVByb3ZpZGVyRm9yRWRpdG9yKHRoaXMuYWN0aXZlRWRpdG9yKTtcbiAgICBpZiAoIXByb3ZpZGVyKSByZXR1cm4gbnVsbDtcblxuICAgIGxldCBvdXRsaW5lID0gYXdhaXQgcHJvdmlkZXIuZ2V0T3V0bGluZSh0aGlzLmFjdGl2ZUVkaXRvcik7XG4gICAgaWYgKCFvdXRsaW5lKSByZXR1cm4gbnVsbDtcblxuICAgIHJldHVybiB0aGlzLmNvbnN1bWVPdXRsaW5lKG91dGxpbmUpO1xuICB9XG5cbiAgY29uc3VtZU91dGxpbmUob3V0bGluZTogYXRvbUlkZS5PdXRsaW5lKTogU3ltYm9sRW50cnlbXSB7XG4gICAgdGhpcy5vdXRsaW5lID0gb3V0bGluZTtcbiAgICBsZXQgc3ltYm9sczogU3ltYm9sRW50cnlbXSA9IFtdO1xuICAgIGZ1bmN0aW9uIGNvbnN1bWVTeW1ib2woc3ltYm9sOiBhdG9tSWRlLk91dGxpbmVUcmVlKSB7XG4gICAgICBsZXQge1xuICAgICAgICBpY29uLFxuICAgICAgICBraW5kLFxuICAgICAgICBwbGFpblRleHQsXG4gICAgICAgIHRva2VuaXplZFRleHQsXG4gICAgICAgIHJlcHJlc2VudGF0aXZlTmFtZSxcbiAgICAgICAgc3RhcnRQb3NpdGlvbixcbiAgICAgICAgZW5kUG9zaXRpb24sXG4gICAgICAgIGNoaWxkcmVuXG4gICAgICB9ID0gc3ltYm9sO1xuXG4gICAgICBsZXQgcmFuZ2UgPSBuZXcgUmFuZ2UoXG4gICAgICAgIHN0YXJ0UG9zaXRpb24sXG4gICAgICAgIGVuZFBvc2l0aW9uID8/IHN0YXJ0UG9zaXRpb25cbiAgICAgICk7XG5cbiAgICAgIGxldCB1bnRva2VuaXplZFRleHQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgIGlmICh0b2tlbml6ZWRUZXh0KSB7XG4gICAgICAgIHVudG9rZW5pemVkVGV4dCA9IGludGVycHJldFRva2VuaXplZFRleHQodG9rZW5pemVkVGV4dCk7XG4gICAgICB9XG5cbiAgICAgIGxldCByZXN1bHQ6IFN5bWJvbEVudHJ5ID0ge1xuICAgICAgICBpY29uLFxuICAgICAgICBraW5kLFxuICAgICAgICBuYW1lOiB1bnRva2VuaXplZFRleHQgPz8gcGxhaW5UZXh0ID8/IHJlcHJlc2VudGF0aXZlTmFtZSA/PyAnJyxcbiAgICAgICAgcmFuZ2VcbiAgICAgIH07XG5cbiAgICAgIGlmIChjaGlsZHJlbiAmJiBjaGlsZHJlbi5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJlc3VsdC5jaGlsZHJlbiA9IGNoaWxkcmVuLm1hcChjb25zdW1lU3ltYm9sKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgc3ltYm9sIG9mIG91dGxpbmUub3V0bGluZVRyZWVzKSB7XG4gICAgICBzeW1ib2xzLnB1c2goY29uc3VtZVN5bWJvbChzeW1ib2wpKTtcbiAgICB9XG5cbiAgICB0aGlzLnNldFN5bWJvbHMoc3ltYm9scyk7XG4gICAgcmV0dXJuIHN5bWJvbHM7XG4gIH1cblxuICB1cGRhdGUoKSB7XG4gICAgcmV0dXJuIGV0Y2gudXBkYXRlKHRoaXMpO1xuICB9XG5cbiAgcmVuZGVyU3ltYm9sKHN5bWJvbDogU3ltYm9sRW50cnkpIHtcbiAgICBpZiAodGhpcy5zaG91bGRJZ25vcmVTeW1ib2woc3ltYm9sKSkgcmV0dXJuIG51bGw7XG4gICAgbGV0IGNoaWxkcmVuID0gbnVsbDtcbiAgICBsZXQgaWQgPSBzeW1ib2xJZCsrO1xuICAgIHRoaXMuc3ltYm9sRW50cnlUb1JlZlRhYmxlLnNldChzeW1ib2wsIFN0cmluZyhpZCkpO1xuICAgIHRoaXMucmVmVG9TeW1ib2xFbnRyeVRhYmxlLnNldChTdHJpbmcoaWQpLCBzeW1ib2wpO1xuICAgIGlmIChzeW1ib2wuY2hpbGRyZW4pIHtcbiAgICAgIGNoaWxkcmVuID0gc3ltYm9sLmNoaWxkcmVuLm1hcChzeW0gPT4gdGhpcy5yZW5kZXJTeW1ib2woc3ltKSk7XG4gICAgICBjaGlsZHJlbiA9IGNoaWxkcmVuLmZpbHRlcihjID0+IGMgPz8gZmFsc2UpO1xuICAgIH1cbiAgICBsZXQgY2hpbGRNZW51ID0gbnVsbDtcbiAgICBpZiAoY2hpbGRyZW4gJiYgY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgY2hpbGRNZW51ID0gKFxuICAgICAgICA8dWwgY2xhc3NOYW1lPSdvdXRsaW5lLWxpc3QgbGlzdC10cmVlJz5cbiAgICAgICAgICB7Y2hpbGRyZW59XG4gICAgICAgIDwvdWw+XG4gICAgICApO1xuICAgIH1cblxuICAgIGxldCBuYW1lQ2xhc3NlcyA9IENsYXNzTmFtZXMoXG4gICAgICAnbmFtZScsXG4gICAgICBnZXRPY3RvY2F0SWNvbkZvck91dGxpbmVJY29uKHN5bWJvbC5pY29uKVxuICAgICk7XG5cbiAgICBpZiAoY2hpbGRyZW4gJiYgY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGxpXG4gICAgICAgICAgY2xhc3NOYW1lPVwibGlzdC1uZXN0ZWQtaXRlbSBvdXRsaW5lLXZpZXctZW50cnlcIlxuICAgICAgICAgIGRhdGFzZXQ9eyB7IGlkOiBTdHJpbmcoaWQpIH0gfVxuICAgICAgICAgIHJlZj17U3RyaW5nKGlkKX1cbiAgICAgICAgPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwib3V0bGluZS12aWV3LW9wdGlvbiBsaXN0LWl0ZW1cIiB0YWJJbmRleD17LTF9PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e25hbWVDbGFzc2VzfSA+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibmFtZS1pbm5lclwiIHRpdGxlPXt0aXRsZUZvclN5bWJvbChzeW1ib2wpfT57c3ltYm9sLm5hbWV9PC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB7Y2hpbGRNZW51fVxuICAgICAgICA8L2xpPlxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGxpXG4gICAgICAgICAgY2xhc3NOYW1lPVwib3V0bGluZS12aWV3LWVudHJ5IG91dGxpbmUtdmlldy1vcHRpb24gbGlzdC1pdGVtXCJcbiAgICAgICAgICB0YWJJbmRleD17LTF9XG4gICAgICAgICAgZGF0YXNldD17IHsgaWQ6IFN0cmluZyhpZCkgfSB9XG4gICAgICAgICAgcmVmPXtTdHJpbmcoaWQpfVxuICAgICAgICA+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9e25hbWVDbGFzc2VzfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibmFtZS1pbm5lclwiIHRpdGxlPXt0aXRsZUZvclN5bWJvbChzeW1ib2wpfT57c3ltYm9sLm5hbWV9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvbGk+XG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHJlbmRlcigpIHtcbiAgICB0aGlzLnN5bWJvbEVudHJ5VG9SZWZUYWJsZS5jbGVhcigpO1xuICAgIHRoaXMucmVmVG9TeW1ib2xFbnRyeVRhYmxlLmNsZWFyKCk7XG4gICAgc3ltYm9sSWQgPSAxO1xuICAgIGxldCBzeW1ib2xzID0gdGhpcy5zeW1ib2xzID8/IFtdO1xuICAgIGxldCBzeW1ib2xFbGVtZW50cyA9IHN5bWJvbHMubWFwKFxuICAgICAgc3ltID0+IHRoaXMucmVuZGVyU3ltYm9sKHN5bSlcbiAgICApO1xuICAgIGxldCByb290Q2xhc3NlcyA9IENsYXNzTmFtZXMoXG4gICAgICAndG9vbC1wYW5lbCcsXG4gICAgICAnb3V0bGluZS12aWV3JyxcbiAgICAgIHtcbiAgICAgICAgJ3dpdGgtZWxsaXBzaXMtc3RyYXRlZ3knOiB0aGlzLmNvbmZpZy5uYW1lT3ZlcmZsb3dTdHJhdGVneSA9PT0gJ2VsbGlwc2lzJ1xuICAgICAgfVxuICAgICk7XG5cbiAgICBsZXQgY29udGVudHMgPSAoXG4gICAgICA8dWwgY2xhc3NOYW1lPSdiYWNrZ3JvdW5kLW1lc3NhZ2UnIHN0eWxlPXt7IGRpc3BsYXk6ICdibG9jaycgfX0+XG4gICAgICAgIDxsaT5ObyBTeW1ib2xzPC9saT5cbiAgICAgIDwvdWw+XG4gICAgKTtcbiAgICBpZiAoc3ltYm9sRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgY29udGVudHMgPSAoXG4gICAgICAgIDx1bCBjbGFzc05hbWU9J291dGxpbmUtbGlzdCBvdXRsaW5lLWxpc3Qtcm9vdCBmdWxsLW1lbnUgZm9jdXNhYmxlLXBhbmVsIGxpc3QtdHJlZSBoYXMtY29sbGFwc2FibGUtY2hpbGRyZW4nIHJlZj0nbGlzdCc+XG4gICAgICAgICAge3N5bWJvbEVsZW1lbnRzfVxuICAgICAgICA8L3VsPlxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9e3Jvb3RDbGFzc2VzfSB0YWJJbmRleD17LTF9IHJlZj0ncm9vdCc+XG4gICAgICAgIHtjb250ZW50c31cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHRvZ2dsZVJlZihyZWY6IEVsZW1lbnQsIGFkZDogYm9vbGVhbikge1xuICAgIGlmICghcmVmKSByZXR1cm47XG4gICAgbGV0IGl0ZW06IEVsZW1lbnQgfCBudWxsID0gcmVmO1xuICAgIGlmICghaXRlbSkgcmV0dXJuO1xuICAgIGlmIChhZGQpIHtcbiAgICAgIGl0ZW0uY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaXRlbS5jbGFzc0xpc3QucmVtb3ZlKCdzZWxlY3RlZCcpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc2hvdWxkSWdub3JlU3ltYm9sKHN5bWJvbDogU3ltYm9sRW50cnkpOiBib29sZWFuIHtcbiAgICBsZXQgeyBpZ25vcmVkU3ltYm9sVHlwZXMgfSA9IHRoaXMuY29uZmlnO1xuICAgIGlmIChzeW1ib2wua2luZCAmJiBpZ25vcmVkU3ltYm9sVHlwZXMuaW5jbHVkZXMoc3ltYm9sLmtpbmQpKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoc3ltYm9sLmljb24gJiYgaWdub3JlZFN5bWJvbFR5cGVzLmluY2x1ZGVzKHN5bWJvbC5pY29uKSkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRGbGF0U3ltYm9scygpOiBTeW1ib2xFbnRyeVtdIHtcbiAgICBpZiAoIXRoaXMuc3ltYm9scykgcmV0dXJuIFtdO1xuICAgIGxldCByZXN1bHRzOiBTeW1ib2xFbnRyeVtdID0gW107XG4gICAgbGV0IHByb2Nlc3NTeW1ib2xzID0gKGl0ZW06IFN5bWJvbEVudHJ5KSA9PiB7XG4gICAgICBpZiAodGhpcy5zaG91bGRJZ25vcmVTeW1ib2woaXRlbSkpIHJldHVybjtcbiAgICAgIHJlc3VsdHMucHVzaChpdGVtKTtcbiAgICAgIGlmIChpdGVtLmNoaWxkcmVuKSB7XG4gICAgICAgIGZvciAobGV0IGNoaWxkIG9mIGl0ZW0uY2hpbGRyZW4pIHtcbiAgICAgICAgICBwcm9jZXNzU3ltYm9scyhjaGlsZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICAgIGZvciAobGV0IHN5bWJvbCBvZiB0aGlzLnN5bWJvbHMpIHtcbiAgICAgIHByb2Nlc3NTeW1ib2xzKHN5bWJvbCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0NsaWNrT25DYXJldChldmVudDogTW91c2VFdmVudCkge1xuICAgIGxldCBlbGVtZW50ID0gZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuICAgIGlmIChlbGVtZW50Py5tYXRjaGVzKCcubmFtZScpKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBUaGUgY2FyZXQgY29tZXMgZnJvbSBnZW5lcmF0ZWQgY29udGVudCBpbiBhIGA6OmJlZm9yZWAgQ1NTIHJ1bGUuIFdlXG4gICAgLy8gY2FuJ3QgZGV0ZWN0IHdoZXRoZXIgaXQgd2FzIGNsaWNrZWQgb24sIGJ1dCB3ZSBjYW4gbWVhc3VyZSB0aGUgYW1vdW50IG9mXG4gICAgLy8gc3BhY2UgYWxsb2NhdGVkIHRvIHRoZSBjYXJldCBvbiB0aGUgbGVmdCBzaWRlLCBhbmQgdGhlbiBhc2NlcnRhaW4gdGhhdFxuICAgIC8vIHRoZSBtb3VzZSB3YXMgaW4gdGhhdCB6b25lLlxuICAgIGxldCBlbFJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGxldCBuYW1lUmVjdCA9IGVsZW1lbnQucXVlcnlTZWxlY3RvcignLm5hbWUnKT8uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgaWYgKCFuYW1lUmVjdCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgbGV0IGRpc3RhbmNlID0gbmFtZVJlY3QubGVmdCAtIGVsUmVjdC5sZWZ0O1xuICAgIHJldHVybiBldmVudC5vZmZzZXRYIDwgZGlzdGFuY2U7XG4gIH1cblxuICBwcml2YXRlIGdldFZpc2libGVMaXN0SXRlbXMoKSB7XG4gICAgaWYgKCF0aGlzLmVsZW1lbnQpIHJldHVybiBbXTtcbiAgICBsZXQgY2hvaWNlcyA9IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCdsaS5saXN0LWl0ZW0sIGxpLmxpc3QtbmVzdGVkLWl0ZW0nKTtcbiAgICBpZiAoIWNob2ljZXMgfHwgY2hvaWNlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShjaG9pY2VzKS5maWx0ZXIoY2hvaWNlID0+IHtcbiAgICAgIGlmICghKCdvZmZzZXRIZWlnaHQnIGluIGNob2ljZSkpIHJldHVybiBmYWxzZTtcbiAgICAgIHJldHVybiAoY2hvaWNlIGFzIEhUTUxFbGVtZW50KS5vZmZzZXRIZWlnaHQgPiAwO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE91dGxpbmVWaWV3O1xuIl19