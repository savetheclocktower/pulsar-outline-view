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
const etch_1 = __importDefault(require("etch"));
const atom_1 = require("atom");
const classnames_1 = __importDefault(require("classnames"));
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
            return 'icon-primitive-dot';
        case 'type-property':
            return 'icon-primitive-square';
        case 'type-interface':
            return 'icon-key';
        case 'type-constructor':
            return 'icon-tools';
        case 'type-module':
            return 'icon-database';
        default:
            console.warn('UNMAPPED:', outlineIcon);
            return 'icon-dash';
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
        return true;
    }
    getPreferredWidth() {
        if (!this.refs)
            return;
        this.refs.list.style.width === 'min-content';
        let result = this.refs.list.offsetWidth;
        this.refs.list.style.width === '';
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
        if (index === -1) {
            index = items.length - 1;
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
        this.getSymbols()
            .then(symbols => {
            if (!symbols || !editor)
                return;
            this.setSymbols(symbols, editor);
        });
    }
    toggle() {
        atom.workspace.toggle(this);
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
            console.error(`[pulsar-outline-view] Could not find element for symbol:`, newSymbol);
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
            let untokenizedText;
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
                    etch_1.default.dom("div", { className: "name-inner" }, symbol.name))));
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
        let contents = (etch_1.default.dom("ul", { className: 'background-message' },
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
        if (element === null || element === void 0 ? void 0 : element.webkitMatchesSelector('.name'))
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0bGluZS12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vbGliL291dGxpbmUtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLG9CQUFvQjs7Ozs7Ozs7Ozs7Ozs7QUFFcEIsZ0RBQXdCO0FBQ3hCLCtCQU9jO0FBQ2QsNERBQW9DO0FBbUJwQyxNQUFNLGdCQUFnQixHQUFHLDRCQUE0QixDQUFDO0FBQ3RELElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQztBQUN2QixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFHakIsU0FBUyxNQUFNLENBQUMsSUFBYTtJQUMzQixJQUFJLElBQUksS0FBSyxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzVELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDO0FBQzFDLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLGFBQW9DO0lBQ2xFLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNoQixLQUFLLElBQUksS0FBSyxJQUFJLGFBQWEsRUFBRTtRQUMvQixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUMxQjtJQUNELE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN6QixDQUFDO0FBRUQsU0FBUyw0QkFBNEIsQ0FBQyxXQUFvQjtJQUN4RCxRQUFRLFdBQVcsRUFBRTtRQUNuQixLQUFLLGVBQWU7WUFDbEIsT0FBTyxXQUFXLENBQUM7UUFDckIsS0FBSyxhQUFhO1lBQ2hCLE9BQU8sV0FBVyxDQUFDO1FBQ3JCLEtBQUssZ0JBQWdCO1lBQ25CLE9BQU8sVUFBVSxDQUFDO1FBQ3BCLEtBQUssZUFBZTtZQUNsQixPQUFPLFdBQVcsQ0FBQztRQUNyQixLQUFLLFlBQVk7WUFDZixPQUFPLGNBQWMsQ0FBQztRQUN4QixLQUFLLGVBQWU7WUFDbEIsT0FBTyxvQkFBb0IsQ0FBQztRQUM5QixLQUFLLGVBQWU7WUFDbEIsT0FBTyx1QkFBdUIsQ0FBQztRQUNqQyxLQUFLLGdCQUFnQjtZQUNuQixPQUFPLFVBQVUsQ0FBQztRQUNwQixLQUFLLGtCQUFrQjtZQUNyQixPQUFPLFlBQVksQ0FBQztRQUN0QixLQUFLLGFBQWE7WUFDaEIsT0FBTyxlQUFlLENBQUM7UUFDekI7WUFDRSxPQUFPLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUN2QyxPQUFPLFdBQVcsQ0FBQztLQUN0QjtBQUNILENBQUM7QUFFRCxTQUFTLGNBQWMsQ0FBQyxNQUFtQjtJQUN6QyxJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDakIsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFO1FBQ2YsT0FBTyxHQUFHLEtBQUssTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDO0tBQy9CO1NBQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFO1FBQ3RCLE9BQU8sR0FBRyxLQUFLLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQztLQUMvQjtJQUNELE9BQU8sR0FBRyxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sRUFBRSxDQUFDO0FBQ3BDLENBQUM7QUFFRCxNQUFNLFdBQVc7SUFrQmYsWUFBWSxNQUFzQixFQUFFLE1BQWdCOztRQUNsRCxJQUFJLENBQUMsRUFBRSxHQUFHLGNBQWMsRUFBRSxDQUFDO1FBQzNCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBRXJCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSwwQkFBbUIsRUFBRSxDQUFDO1FBQzdDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxjQUFPLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztRQUN6QixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFFckQsY0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QixjQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU5QixNQUFBLElBQUksQ0FBQyxPQUFPLDBDQUFFLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFOztZQUNoRCxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVk7Z0JBQUUsT0FBTztZQUMvQixJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQzlCLElBQUksTUFBTSxHQUFHLE1BQUMsS0FBSyxDQUFDLE1BQXNCLDBDQUFFLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO2dCQUM3RSxJQUFJLENBQUMsTUFBTTtvQkFBRSxPQUFPO2dCQUNwQixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDbkM7WUFFRCxJQUFJLE1BQU0sR0FBRyxNQUFDLEtBQUssQ0FBQyxNQUFzQiwwQ0FBRSxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQztZQUM3RSxJQUFJLENBQUMsTUFBTTtnQkFBRSxPQUFPO1lBRXBCLElBQUksR0FBRyxHQUFJLE1BQXNCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUM3QyxJQUFJLENBQUMsR0FBRztnQkFBRSxPQUFPO1lBRWpCLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDakQsSUFBSSxDQUFDLE1BQU07Z0JBQUUsT0FBTztZQUVwQixJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFcEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQ2xELElBQUksTUFBTSxFQUFFO1lBQ1YsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUM3QjtJQUNILENBQUM7SUFFSyxPQUFPOztZQUNYLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDakMsTUFBTSxjQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNCLENBQUM7S0FBQTtJQUVELFlBQVksQ0FBQyxRQUFvQjtRQUMvQixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRUQsUUFBUTtRQUNOLE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7SUFFRCxNQUFNO1FBQ0osT0FBTyxnQkFBZ0IsQ0FBQztJQUMxQixDQUFDO0lBRUQsV0FBVztRQUNULE9BQU8sZ0JBQWdCLENBQUM7SUFDMUIsQ0FBQztJQUVELG1CQUFtQjtRQUNqQiwyRUFBMkU7UUFDM0UscUNBQXFDO1FBQ3JDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUU7WUFDL0IsT0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztTQUMxQjtRQUNELE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDM0IsQ0FBQztJQUVELG1CQUFtQjtRQUNqQixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxpQkFBaUI7UUFDZixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssYUFBYSxDQUFDO1FBQzdDLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUNsQyxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBRUQsWUFBWTtRQUNWLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUNsQixJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTtZQUM5RCxJQUFJLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQztZQUN2QixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDaEIsQ0FBQyxDQUFDLEVBQ0YsSUFBSSxDQUFDLFNBQVMsQ0FBQywyQkFBMkIsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNsRCxJQUFJLE1BQU0sRUFBRTtnQkFDVixrRUFBa0U7Z0JBQ2xFLGlFQUFpRTtnQkFDakUseUJBQXlCO2dCQUN6QixJQUFJLENBQUMsWUFBWSxDQUFDO2dCQUNsQixJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQzdCO1FBQ0gsQ0FBQyxDQUFDLENBQ0gsQ0FBQztRQUVGLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNoQixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FDbEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQ2YsSUFBSSxDQUFDLE9BQU8sRUFDWjtnQkFDRSxjQUFjLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUNyQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pDLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDNUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNsRCw2Q0FBNkMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLEVBQUU7Z0JBQ2pGLDZDQUE2QyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRTthQUNsRixDQUNGLENBQ0YsQ0FBQztZQUVGLElBQUksQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRTs7Z0JBQzFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO29CQUNyQixJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUNyQjtnQkFDRCxNQUFBLElBQUksQ0FBQyxXQUFXLDBDQUFFLEtBQUssRUFBRSxDQUFDO1lBQzVCLENBQUMsQ0FBQyxDQUFDO1NBQ0o7SUFDSCxDQUFDO0lBRUQsU0FBUztRQUNQLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ2hDLElBQUksTUFBTSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUM7UUFDcEMsT0FBTyxJQUFJLENBQUMsT0FBTyxLQUFLLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLEtBQVk7UUFDakIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFRDs7O09BR0c7SUFDSCxRQUFRLENBQUMsS0FBWTtRQUNuQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxTQUFTLENBQUMsS0FBWSxFQUFFLEtBQWE7UUFDbkMsS0FBSyxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFDakMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFFdkMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDdEMsSUFBSSxDQUFDLE1BQU07WUFBRSxPQUFPO1FBRXBCLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QyxJQUFJLENBQUMsT0FBTztZQUFFLE9BQU87UUFFckIsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuQyxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUM7WUFBRSxPQUFPO1FBRXpCLElBQUksUUFBUSxHQUFHLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDN0IsSUFBSSxRQUFRLElBQUksS0FBSyxDQUFDLE1BQU07WUFBRSxRQUFRLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDMUQsSUFBSSxRQUFRLEdBQUcsQ0FBQztZQUFFLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFFL0IsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxXQUFXLENBQUMsS0FBYSxFQUFFLEtBQWlCOztRQUMxQyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1YsS0FBSyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1NBQ3BDO1FBQ0QsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUM7WUFBRSxPQUFPO1FBRS9CLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFO1lBQ2hCLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztTQUMxQjtRQUVELElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFnQixDQUFDLENBQUM7UUFDaEUsSUFBSSxDQUFDLE1BQU07WUFBRSxPQUFPO1FBRXBCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMvQixJQUFJLE1BQUEsSUFBSSxDQUFDLE1BQU0sMENBQUUsOEJBQThCLEVBQUU7WUFDL0MsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7U0FDOUI7SUFDSCxDQUFDO0lBRUQsU0FBUyxDQUFDLEtBQVk7UUFDcEIsS0FBSyxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFDakMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0QixDQUFDO0lBRUQsWUFBWSxDQUFDLEtBQVk7UUFDdkIsS0FBSyxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFDakMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxxQkFBcUI7UUFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjO1lBQUUsT0FBTztRQUNqQyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxDQUFBLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxTQUFTLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLENBQUE7WUFBRSxPQUFPO1FBRTdELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQsYUFBYSxDQUFDLE9BQWdCO1FBQzVCLElBQUksYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLGFBQWE7WUFBRSxPQUFPO1FBRTNCLElBQUksV0FBVyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzFELElBQUksV0FBVyxFQUFFO1lBQ2YsYUFBYSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDekMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDdkM7YUFBTTtZQUNMLGFBQWEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3RDLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQ3BDO0lBQ0gsQ0FBQztJQUVELHFCQUFxQjtRQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWM7WUFBRSxPQUFPO1FBQ2pDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELGtCQUFrQixDQUFDLE1BQW1CO1FBQ3BDLElBQUksTUFBTSxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDL0IsSUFBSSxDQUFDLFlBQVksQ0FBQyx1QkFBdUIsQ0FDdkMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQ2xCLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxDQUN0QixDQUFDO1lBQ0YsSUFBSSxDQUFDLFlBQVksQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQzVEO0lBQ0gsQ0FBQztJQUVELElBQUksT0FBTzs7UUFDVCxPQUFPLE1BQUEsTUFBQSxJQUFJLENBQUMsSUFBSSwwQ0FBRSxJQUFJLG1DQUFJLElBQUksQ0FBQztJQUNqQyxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsTUFBbUI7O1FBQ2xDLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLEdBQUc7WUFBRSxPQUFPLElBQUksQ0FBQztRQUN0QixPQUFPLE1BQUEsTUFBQSxJQUFJLENBQUMsSUFBSSwwQ0FBRyxHQUFHLENBQUMsbUNBQUksSUFBSSxDQUFDO0lBQ2xDLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxPQUFvQjs7UUFDbkMsOERBQThEO1FBQzlELElBQUksR0FBRyxHQUFJLE9BQXVCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUM5QyxJQUFJLENBQUMsR0FBRztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ3RCLE9BQU8sTUFBQSxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxtQ0FBSSxJQUFJLENBQUM7SUFDckQsQ0FBQztJQUVELGtCQUFrQjtRQUNoQixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQy9CLElBQUksV0FBVyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQztRQUMvQyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsV0FBVztZQUFFLE9BQU87UUFFcEMsV0FBVyxDQUFDLEdBQUcsQ0FDYixNQUFNLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFO1lBQzVCLElBQUksQ0FBQyxNQUFNO2dCQUFFLE9BQU87WUFDcEIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxFQUNGLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLEVBQUU7WUFDcEMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ25ELElBQUksQ0FBQyxNQUFNO2dCQUFFLE9BQU87WUFDcEIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0lBRUQsY0FBYyxDQUFDLE1BQWtCOztRQUMvQixNQUFBLElBQUksQ0FBQyx1QkFBdUIsMENBQUUsT0FBTyxFQUFFLENBQUM7UUFDeEMsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7UUFDM0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFFeEIsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNYLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUM7WUFDcEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNwQixPQUFPO1NBQ1I7YUFBTTtZQUNMLElBQUksQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDO1lBQzNCLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUM7WUFFekQsSUFBSSxVQUFVLEdBQWtCLEVBQUUsQ0FBQztZQUNuQyxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3RDLFVBQVUsR0FBRyxNQUFBLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLG1DQUFJLEVBQUUsQ0FBQzthQUN2RDtpQkFBTTtnQkFDTCxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDaEM7WUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzVCLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1NBQzNCO0lBQ0gsQ0FBQztJQUVELGlCQUFpQixDQUFDLE1BQWtCO1FBQ2xDLElBQUksQ0FBQyxVQUFVLEVBQUU7YUFDZCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDZCxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTTtnQkFBRSxPQUFPO1lBQ2hDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ25DLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVELE1BQU07UUFDSixJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUssSUFBSTs7WUFDUixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtnQkFDOUIsY0FBYyxFQUFFLElBQUk7Z0JBQ3BCLFlBQVksRUFBRSxLQUFLO2dCQUNuQixZQUFZLEVBQUUsS0FBSzthQUNwQixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbEIsQ0FBQztLQUFBO0lBRUQsUUFBUTtRQUNOLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDbEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7WUFBRSxPQUFPO1FBQy9CLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNqQixTQUFTLENBQUMsYUFBYSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDNUQsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxJQUFJO1FBQ0YsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVELEtBQUs7O1FBQ0gsTUFBQSxJQUFJLENBQUMsSUFBSSwwQ0FBRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVELE9BQU87UUFDTCxJQUFJLE1BQU0sR0FBb0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUN6RCxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDcEMsQ0FBQztJQUVELFVBQVUsQ0FBQyxPQUFzQixFQUFFLE1BQW1CO1FBQ3BELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksTUFBTSxJQUFJLE1BQU0sS0FBSyxJQUFJLENBQUMsWUFBWTtZQUFFLE9BQU87UUFDbkQsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3JCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxPQUFPLENBQUMsQ0FBQztTQUN4RDtRQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sRUFBRTthQUNqQixJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ1QsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUM5RCxJQUFJLENBQUMsTUFBTTtnQkFBRSxPQUFPO1lBQ3BCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqQyxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFRCx3QkFBd0IsQ0FBQyxNQUEwQixFQUFFLFdBQTJCO1FBQzlFLE1BQU0sYUFBTixNQUFNLGNBQU4sTUFBTSxJQUFOLE1BQU0sR0FBSyxJQUFJLENBQUMsWUFBWSxFQUFDO1FBQzdCLElBQUksQ0FBQyxNQUFNO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFekIsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3BDLElBQUksUUFBUSxHQUFHLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRTFDLElBQUksVUFBVSxHQUFHLFdBQVcsYUFBWCxXQUFXLGNBQVgsV0FBVyxHQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN0RCxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDckIsS0FBSyxJQUFJLE1BQU0sSUFBSSxVQUFVLEVBQUU7WUFDN0IsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQztZQUN6QixJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsUUFBUSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxFQUFFO2dCQUN4RCxTQUFTO2FBQ1Y7WUFDRCxJQUFJLEtBQUssQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQ2pDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7b0JBQ2hHLG9FQUFvRTtvQkFDcEUsb0VBQW9FO29CQUNwRSxTQUFTLEdBQUcsTUFBTSxDQUFDO2lCQUNwQjthQUNGO2lCQUFNLElBQUksQ0FBQyxTQUFTLEVBQUU7Z0JBQ3JCLHFFQUFxRTtnQkFDckUsMEJBQTBCO2dCQUMxQixTQUFTLEdBQUcsTUFBTSxDQUFDO2FBQ3BCO1NBQ0Y7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBRUQsaUJBQWlCLENBQUMsU0FBNkI7UUFDN0MsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ3BCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUN6QztRQUVELElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO1FBQzNCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBRXhCLElBQUksQ0FBQyxTQUFTO1lBQUUsT0FBTztRQUV2QixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsaUNBQWlDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbkUsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsMERBQTBELEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDckYsT0FBTztTQUNSO1FBRUQsSUFBSSxDQUFDLGNBQWMsR0FBRyxTQUFTLENBQUM7UUFDaEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxVQUFVLENBQUM7UUFDOUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxtQ0FBbUMsRUFBRSxDQUFDO0lBQzdDLENBQUM7SUFFRCxtQ0FBbUM7UUFDakMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTztZQUFFLE9BQU87UUFDL0MsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLFdBQW1DLENBQUM7UUFDdkQsSUFBSSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFO1lBQ25ELE9BQU8sR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1NBQy9DO1FBQ0QsSUFBSSxDQUFDLE9BQU87WUFBRSxPQUFPO1FBRXJCLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQzNDLElBQUksYUFBYSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUV6RCxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxFQUFFO1lBQzlELElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1NBQzdCO0lBQ0gsQ0FBQztJQUVELGlCQUFpQjtRQUNmLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQztJQUM3QixDQUFDO0lBRUQsaUNBQWlDLENBQUMsTUFBbUI7O1FBQ25ELElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsVUFBVTtZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRTdCLE9BQU8sQ0FBQyxNQUFBLFVBQVUsYUFBVixVQUFVLHVCQUFWLFVBQVUsQ0FBRSxZQUFZLG1DQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUM1QyxJQUFJLFVBQVUsR0FBRyxVQUFVLGFBQVYsVUFBVSx1QkFBVixVQUFVLENBQUUsVUFBeUIsQ0FBQztZQUN2RCxJQUFJLENBQUMsVUFBVTtnQkFBRSxPQUFPLElBQUksQ0FBQztZQUM3QixVQUFVLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN2QztRQUNELE9BQU8sVUFBVSxhQUFWLFVBQVUsY0FBVixVQUFVLEdBQUksSUFBSSxDQUFDO0lBQzVCLENBQUM7SUFFRCxtQkFBbUIsQ0FBQyxNQUFrQjtRQUNwQyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLE1BQU07WUFBRSxPQUFPO1FBRXBCLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QyxJQUFJLENBQUMsT0FBTztZQUFFLE9BQU87UUFFckIsT0FBTyxPQUFPLENBQUMsWUFBWSxLQUFLLENBQUMsRUFBRTtZQUNqQyxJQUFJLG9CQUFvQixHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDekQsSUFBSSxDQUFDLG9CQUFvQjtnQkFBRSxNQUFNO1lBQ2pDLElBQUksQ0FBQyxhQUFhLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUMxQztRQUVELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUssVUFBVTs7WUFDZCxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVk7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFFcEMsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDdEUsSUFBSSxDQUFDLFFBQVE7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFFM0IsSUFBSSxPQUFPLEdBQUcsTUFBTSxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUMzRCxJQUFJLENBQUMsT0FBTztnQkFBRSxPQUFPLElBQUksQ0FBQztZQUUxQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdEMsQ0FBQztLQUFBO0lBRUQsY0FBYyxDQUFDLE9BQXdCO1FBQ3JDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksT0FBTyxHQUFrQixFQUFFLENBQUM7UUFDaEMsU0FBUyxhQUFhLENBQUMsTUFBMkI7O1lBQ2hELElBQUksRUFDRixJQUFJLEVBQ0osSUFBSSxFQUNKLFNBQVMsRUFDVCxhQUFhLEVBQ2Isa0JBQWtCLEVBQ2xCLGFBQWEsRUFDYixXQUFXLEVBQ1gsUUFBUSxFQUNULEdBQUcsTUFBTSxDQUFDO1lBRVgsSUFBSSxLQUFLLEdBQUcsSUFBSSxZQUFLLENBQ25CLGFBQWEsRUFDYixXQUFXLGFBQVgsV0FBVyxjQUFYLFdBQVcsR0FBSSxhQUFhLENBQzdCLENBQUM7WUFFRixJQUFJLGVBQWUsQ0FBQztZQUNwQixJQUFJLGFBQWEsRUFBRTtnQkFDakIsZUFBZSxHQUFHLHNCQUFzQixDQUFDLGFBQWEsQ0FBQyxDQUFDO2FBQ3pEO1lBRUQsSUFBSSxNQUFNLEdBQWdCO2dCQUN4QixJQUFJO2dCQUNKLElBQUk7Z0JBQ0osSUFBSSxFQUFFLE1BQUEsTUFBQSxlQUFlLGFBQWYsZUFBZSxjQUFmLGVBQWUsR0FBSSxTQUFTLG1DQUFJLGtCQUFrQixtQ0FBSSxFQUFFO2dCQUM5RCxLQUFLO2FBQ04sQ0FBQztZQUVGLElBQUksUUFBUSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUNuQyxNQUFNLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7YUFDL0M7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBRUQsS0FBSyxJQUFJLE1BQU0sSUFBSSxPQUFPLENBQUMsWUFBWSxFQUFFO1lBQ3ZDLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7U0FDckM7UUFFRCxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3pCLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRCxNQUFNO1FBQ0osT0FBTyxjQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUFFRCxZQUFZLENBQUMsTUFBbUI7UUFDOUIsSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDakQsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3BCLElBQUksRUFBRSxHQUFHLFFBQVEsRUFBRSxDQUFDO1FBQ3BCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ25ELElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRTtZQUNuQixRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDOUQsUUFBUSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLGFBQUQsQ0FBQyxjQUFELENBQUMsR0FBSSxLQUFLLENBQUMsQ0FBQztTQUM3QztRQUNELElBQUksU0FBUyxHQUFHLElBQUksQ0FBQztRQUNyQixJQUFJLFFBQVEsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNuQyxTQUFTLEdBQUcsQ0FDViwyQkFBSSxTQUFTLEVBQUMsd0JBQXdCLElBQ25DLFFBQVEsQ0FDTixDQUNOLENBQUM7U0FDSDtRQUVELElBQUksV0FBVyxHQUFHLElBQUEsb0JBQVUsRUFDMUIsTUFBTSxFQUNOLDRCQUE0QixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FDMUMsQ0FBQztRQUVGLElBQUksUUFBUSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ25DLE9BQU8sQ0FDTCwyQkFDRSxTQUFTLEVBQUMscUNBQXFDLEVBQy9DLE9BQU8sRUFBRyxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFDNUIsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBRWYsNEJBQUssU0FBUyxFQUFDLCtCQUErQixFQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7b0JBQ3pELDRCQUFLLFNBQVMsRUFBRSxXQUFXO3dCQUN6Qiw0QkFBSyxTQUFTLEVBQUMsWUFBWSxFQUFDLEtBQUssRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUcsTUFBTSxDQUFDLElBQUksQ0FBTyxDQUMxRSxDQUNGO2dCQUNMLFNBQVMsQ0FDUCxDQUNOLENBQUM7U0FDSDthQUFNO1lBQ0wsT0FBTyxDQUNMLDJCQUNFLFNBQVMsRUFBQyxrREFBa0QsRUFDNUQsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUNaLE9BQU8sRUFBRyxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFDNUIsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBRWYsNEJBQUssU0FBUyxFQUFFLFdBQVc7b0JBQ3pCLDRCQUFLLFNBQVMsRUFBQyxZQUFZLElBQUUsTUFBTSxDQUFDLElBQUksQ0FBTyxDQUMzQyxDQUNILENBQ04sQ0FBQztTQUNIO0lBQ0gsQ0FBQztJQUVELE1BQU07O1FBQ0osSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2IsSUFBSSxPQUFPLEdBQUcsTUFBQSxJQUFJLENBQUMsT0FBTyxtQ0FBSSxFQUFFLENBQUM7UUFDakMsSUFBSSxjQUFjLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FDOUIsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUM5QixDQUFDO1FBQ0YsSUFBSSxXQUFXLEdBQUcsSUFBQSxvQkFBVSxFQUMxQixZQUFZLEVBQ1osY0FBYyxFQUNkO1lBQ0Usd0JBQXdCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsS0FBSyxVQUFVO1NBQzFFLENBQ0YsQ0FBQztRQUVGLElBQUksUUFBUSxHQUFHLENBQ2IsMkJBQUksU0FBUyxFQUFDLG9CQUFvQjtZQUNoQyw0Q0FBbUIsQ0FDaEIsQ0FDTixDQUFDO1FBQ0YsSUFBSSxjQUFjLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUM3QixRQUFRLEdBQUcsQ0FDVCwyQkFBSSxTQUFTLEVBQUMsNkZBQTZGLEVBQUMsR0FBRyxFQUFDLE1BQU0sSUFDbkgsY0FBYyxDQUNaLENBQ04sQ0FBQztTQUNIO1FBRUQsT0FBTyxDQUNMLDRCQUFLLFNBQVMsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBQyxNQUFNLElBQ2xELFFBQVEsQ0FDTCxDQUNQLENBQUM7SUFDSixDQUFDO0lBRU8sU0FBUyxDQUFDLEdBQVksRUFBRSxHQUFZO1FBQzFDLElBQUksQ0FBQyxHQUFHO1lBQUUsT0FBTztRQUNqQixJQUFJLElBQUksR0FBbUIsR0FBRyxDQUFDO1FBQy9CLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTztRQUNsQixJQUFJLEdBQUcsRUFBRTtZQUNQLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ2hDO2FBQU07WUFDTCxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNuQztJQUNILENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxNQUFtQjtRQUM1QyxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3pDLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ3pFLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ3pFLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVPLGNBQWM7UUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDN0IsSUFBSSxPQUFPLEdBQWtCLEVBQUUsQ0FBQztRQUNoQyxJQUFJLGNBQWMsR0FBRyxDQUFDLElBQWlCLEVBQUUsRUFBRTtZQUN6QyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUM7Z0JBQUUsT0FBTztZQUMxQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25CLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtnQkFDakIsS0FBSyxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFO29CQUMvQixjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3ZCO2FBQ0Y7UUFDSCxDQUFDLENBQUM7UUFDRixLQUFLLElBQUksTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDL0IsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ3hCO1FBQ0QsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztJQUVPLGNBQWMsQ0FBQyxLQUFpQjs7UUFDdEMsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDLE1BQXFCLENBQUM7UUFDMUMsSUFBSSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUscUJBQXFCLENBQUMsT0FBTyxDQUFDO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFFMUQsc0VBQXNFO1FBQ3RFLDJFQUEyRTtRQUMzRSx5RUFBeUU7UUFDekUsOEJBQThCO1FBQzlCLElBQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQzdDLElBQUksUUFBUSxHQUFHLE1BQUEsT0FBTyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsMENBQUUscUJBQXFCLEVBQUUsQ0FBQztRQUN2RSxJQUFJLENBQUMsUUFBUTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBRTVCLElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUMzQyxPQUFPLEtBQUssQ0FBQyxPQUFPLEdBQUcsUUFBUSxDQUFDO0lBQ2xDLENBQUM7SUFFTyxtQkFBbUI7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDN0IsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ2pGLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDaEQsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUN6QyxJQUFJLENBQUMsQ0FBQyxjQUFjLElBQUksTUFBTSxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBQzlDLE9BQVEsTUFBc0IsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBQ2xELENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBRUQsa0JBQWUsV0FBVyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqIEBqc3ggZXRjaC5kb20gKi9cblxuaW1wb3J0IGV0Y2ggZnJvbSAnZXRjaCc7XG5pbXBvcnQge1xuICBDb21wb3NpdGVEaXNwb3NhYmxlLFxuICBEb2NrLFxuICBFbWl0dGVyLFxuICBSYW5nZSxcbiAgVGV4dEVkaXRvcixcbiAgV29ya3NwYWNlQ2VudGVyXG59IGZyb20gJ2F0b20nO1xuaW1wb3J0IENsYXNzTmFtZXMgZnJvbSAnY2xhc3NuYW1lcyc7XG5pbXBvcnQgUHJvdmlkZXJCcm9rZXIgZnJvbSAnLi9wcm92aWRlci1icm9rZXInO1xuaW1wb3J0IHR5cGUgKiBhcyBhdG9tSWRlIGZyb20gJ2F0b20taWRlLWJhc2UnO1xuXG50eXBlIFN5bWJvbEVudHJ5ID0ge1xuICBuYW1lOiBzdHJpbmcsXG4gIGljb24/OiBzdHJpbmcsXG4gIGtpbmQ/OiBzdHJpbmcsXG4gIHJhbmdlOiBSYW5nZSxcbiAgY2hpbGRyZW4/OiBTeW1ib2xFbnRyeVtdXG59O1xuXG50eXBlIE91dGxpbmVWaWV3Q29uZmlnID0ge1xuICB2aXNpdEVudHJpZXNPbktleWJvYXJkTW92ZW1lbnQ6IGJvb2xlYW4sXG4gIHNob3dPblJpZ2h0U2lkZTogYm9vbGVhbixcbiAgbmFtZU92ZXJmbG93U3RyYXRlZ3k6ICdzY3JvbGwnIHwgJ2VsbGlwc2lzJyxcbiAgaWdub3JlZFN5bWJvbFR5cGVzOiBzdHJpbmdbXVxufTtcblxuY29uc3QgT1VUTElORV9WSUVXX1VSSSA9ICdhdG9tOi8vcHVsc2FyLW91dGxpbmUtdmlldyc7XG5sZXQgbmV4dEluc3RhbmNlSWQgPSAxO1xubGV0IHN5bWJvbElkID0gMTtcblxuXG5mdW5jdGlvbiBpc0RvY2soaXRlbTogdW5rbm93bik6IGl0ZW0gaXMgRG9jayB7XG4gIGlmIChpdGVtID09PSBudWxsIHx8IHR5cGVvZiBpdGVtICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gaXRlbS5jb25zdHJ1Y3Rvci5uYW1lID09PSAnRG9jayc7XG59XG5cbmZ1bmN0aW9uIGludGVycHJldFRva2VuaXplZFRleHQodG9rZW5pemVkVGV4dDogYXRvbUlkZS5Ub2tlbml6ZWRUZXh0KTogc3RyaW5nIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBmb3IgKGxldCB0b2tlbiBvZiB0b2tlbml6ZWRUZXh0KSB7XG4gICAgcmVzdWx0LnB1c2godG9rZW4udmFsdWUpO1xuICB9XG4gIHJldHVybiByZXN1bHQuam9pbignJyk7XG59XG5cbmZ1bmN0aW9uIGdldE9jdG9jYXRJY29uRm9yT3V0bGluZUljb24ob3V0bGluZUljb24/OiBzdHJpbmcpOiBzdHJpbmcge1xuICBzd2l0Y2ggKG91dGxpbmVJY29uKSB7XG4gICAgY2FzZSAndHlwZS1mdW5jdGlvbic6XG4gICAgICByZXR1cm4gJ2ljb24tZ2Vhcic7XG4gICAgY2FzZSAndHlwZS1tZXRob2QnOlxuICAgICAgcmV0dXJuICdpY29uLWdlYXInO1xuICAgIGNhc2UgJ3R5cGUtbmFtZXNwYWNlJzpcbiAgICAgIHJldHVybiAnaWNvbi10YWcnO1xuICAgIGNhc2UgJ3R5cGUtdmFyaWFibGUnOlxuICAgICAgcmV0dXJuICdpY29uLWNvZGUnO1xuICAgIGNhc2UgJ3R5cGUtY2xhc3MnOlxuICAgICAgcmV0dXJuICdpY29uLXBhY2thZ2UnO1xuICAgIGNhc2UgJ3R5cGUtY29uc3RhbnQnOlxuICAgICAgcmV0dXJuICdpY29uLXByaW1pdGl2ZS1kb3QnO1xuICAgIGNhc2UgJ3R5cGUtcHJvcGVydHknOlxuICAgICAgcmV0dXJuICdpY29uLXByaW1pdGl2ZS1zcXVhcmUnO1xuICAgIGNhc2UgJ3R5cGUtaW50ZXJmYWNlJzpcbiAgICAgIHJldHVybiAnaWNvbi1rZXknO1xuICAgIGNhc2UgJ3R5cGUtY29uc3RydWN0b3InOlxuICAgICAgcmV0dXJuICdpY29uLXRvb2xzJztcbiAgICBjYXNlICd0eXBlLW1vZHVsZSc6XG4gICAgICByZXR1cm4gJ2ljb24tZGF0YWJhc2UnO1xuICAgIGRlZmF1bHQ6XG4gICAgICBjb25zb2xlLndhcm4oJ1VOTUFQUEVEOicsIG91dGxpbmVJY29uKTtcbiAgICAgIHJldHVybiAnaWNvbi1kYXNoJztcbiAgfVxufVxuXG5mdW5jdGlvbiB0aXRsZUZvclN5bWJvbChzeW1ib2w6IFN5bWJvbEVudHJ5KSB7XG4gIGxldCBraW5kVGFnID0gJyc7XG4gIGlmIChzeW1ib2wua2luZCkge1xuICAgIGtpbmRUYWcgPSBgICgke3N5bWJvbC5raW5kfSlgO1xuICB9IGVsc2UgaWYgKHN5bWJvbC5pY29uKSB7XG4gICAga2luZFRhZyA9IGAgKCR7c3ltYm9sLmljb259KWA7XG4gIH1cbiAgcmV0dXJuIGAke3N5bWJvbC5uYW1lfSR7a2luZFRhZ31gO1xufVxuXG5jbGFzcyBPdXRsaW5lVmlldyB7XG4gIHByb3RlY3RlZCBpZDogbnVtYmVyO1xuICBwcm90ZWN0ZWQgcmVmcz86IHsgW2tleTogc3RyaW5nXTogSFRNTEVsZW1lbnQgfTtcbiAgcHJvdGVjdGVkIGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlO1xuICBwcm90ZWN0ZWQgZW1pdHRlcjogRW1pdHRlcjtcbiAgcHJvdGVjdGVkIGJyb2tlcjogUHJvdmlkZXJCcm9rZXI7XG4gIHByb3RlY3RlZCBzeW1ib2xzPzogU3ltYm9sRW50cnlbXSB8IG51bGw7XG4gIHByb3RlY3RlZCBzZWxlY3RlZFN5bWJvbD86IFN5bWJvbEVudHJ5IHwgbnVsbDtcbiAgcHJvdGVjdGVkIG91dGxpbmU/OiBhdG9tSWRlLk91dGxpbmUgfCBudWxsO1xuICBwcm90ZWN0ZWQgYWN0aXZlRWRpdG9yPzogVGV4dEVkaXRvciB8IG51bGw7XG4gIHByb3RlY3RlZCBhY3RpdmVFZGl0b3JEaXNwb3NhYmxlcz86IENvbXBvc2l0ZURpc3Bvc2FibGUgfCBudWxsO1xuICBwcm90ZWN0ZWQgc3ltYm9sRW50cnlUb1JlZlRhYmxlOiBNYXA8U3ltYm9sRW50cnksIHN0cmluZz47XG4gIHByb3RlY3RlZCByZWZUb1N5bWJvbEVudHJ5VGFibGU6IE1hcDxzdHJpbmcsIFN5bWJvbEVudHJ5PjtcbiAgcHJvdGVjdGVkIHNlbGVjdGVkUmVmPzogSFRNTEVsZW1lbnQgfCBudWxsO1xuICBwcm90ZWN0ZWQgY29uZmlnOiBPdXRsaW5lVmlld0NvbmZpZztcblxuICBwcm90ZWN0ZWQgZWRpdG9yU3ltYm9sc0xpc3Q6IFdlYWtNYXA8VGV4dEVkaXRvciwgU3ltYm9sRW50cnlbXT47XG5cbiAgY29uc3RydWN0b3IoYnJva2VyOiBQcm92aWRlckJyb2tlciwgX3N0YXRlPzogdW5rbm93bikge1xuICAgIHRoaXMuaWQgPSBuZXh0SW5zdGFuY2VJZCsrO1xuICAgIHRoaXMuYnJva2VyID0gYnJva2VyO1xuXG4gICAgdGhpcy5lZGl0b3JTeW1ib2xzTGlzdCA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLnN5bWJvbEVudHJ5VG9SZWZUYWJsZSA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLnJlZlRvU3ltYm9sRW50cnlUYWJsZSA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLmRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKTtcbiAgICB0aGlzLmVtaXR0ZXIgPSBuZXcgRW1pdHRlcigpO1xuICAgIHRoaXMuYWN0aXZlRWRpdG9yID0gbnVsbDtcbiAgICB0aGlzLmNvbmZpZyA9IGF0b20uY29uZmlnLmdldCgncHVsc2FyLW91dGxpbmUtdmlldycpO1xuXG4gICAgZXRjaC5pbml0aWFsaXplKHRoaXMpO1xuICAgIGV0Y2guc2V0U2NoZWR1bGVyKGF0b20udmlld3MpO1xuXG4gICAgdGhpcy5lbGVtZW50Py5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLmFjdGl2ZUVkaXRvcikgcmV0dXJuO1xuICAgICAgaWYgKHRoaXMuaXNDbGlja09uQ2FyZXQoZXZlbnQpKSB7XG4gICAgICAgIGxldCB0YXJnZXQgPSAoZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uY2xvc2VzdCgnbGkub3V0bGluZS12aWV3LWVudHJ5Jyk7XG4gICAgICAgIGlmICghdGFyZ2V0KSByZXR1cm47XG4gICAgICAgIHJldHVybiB0aGlzLmNvbGxhcHNlRW50cnkodGFyZ2V0KTtcbiAgICAgIH1cblxuICAgICAgbGV0IHRhcmdldCA9IChldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5jbG9zZXN0KCdsaS5vdXRsaW5lLXZpZXctZW50cnknKTtcbiAgICAgIGlmICghdGFyZ2V0KSByZXR1cm47XG5cbiAgICAgIGxldCByZWYgPSAodGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5kYXRhc2V0LmlkO1xuICAgICAgaWYgKCFyZWYpIHJldHVybjtcblxuICAgICAgbGV0IHN5bWJvbCA9IHRoaXMucmVmVG9TeW1ib2xFbnRyeVRhYmxlLmdldChyZWYpO1xuICAgICAgaWYgKCFzeW1ib2wpIHJldHVybjtcblxuICAgICAgdGhpcy5tb3ZlRWRpdG9yVG9TeW1ib2woc3ltYm9sKTtcbiAgICB9KTtcblxuICAgIHRoaXMuaGFuZGxlRXZlbnRzKCk7XG5cbiAgICBsZXQgZWRpdG9yID0gYXRvbS53b3Jrc3BhY2UuZ2V0QWN0aXZlVGV4dEVkaXRvcigpO1xuICAgIGlmIChlZGl0b3IpIHtcbiAgICAgIHRoaXMuc3dpdGNoVG9FZGl0b3IoZWRpdG9yKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkZXN0cm95KCkge1xuICAgIHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuICAgIHRoaXMuZW1pdHRlci5lbWl0KCdkaWQtZGVzdHJveScpO1xuICAgIGF3YWl0IGV0Y2guZGVzdHJveSh0aGlzKTtcbiAgfVxuXG4gIG9uRGlkRGVzdHJveShjYWxsYmFjazogKCkgPT4gdm9pZCkge1xuICAgIHJldHVybiB0aGlzLmVtaXR0ZXIub24oJ2RpZC1kZXN0cm95JywgY2FsbGJhY2spO1xuICB9XG5cbiAgZ2V0VGl0bGUoKSB7XG4gICAgcmV0dXJuIFwiT3V0bGluZVwiO1xuICB9XG5cbiAgZ2V0VVJJKCkge1xuICAgIHJldHVybiBPVVRMSU5FX1ZJRVdfVVJJO1xuICB9XG5cbiAgZ2V0SWNvbk5hbWUoKSB7XG4gICAgcmV0dXJuICdsaXN0LXVub3JkZXJlZCc7XG4gIH1cblxuICBnZXRBbGxvd2VkTG9jYXRpb25zKCkge1xuICAgIC8vIFdoZW4gdGhlIHdvcmtzcGFjZSBjaG9vc2VzIGEgZG9jayBsb2NhdGlvbiBmb3IgYW4gaXRlbSwgaXQnbGwgY2hvb3NlIHRoZVxuICAgIC8vIGZpcnN0IG9uZSBpbmRpY2F0ZWQgaW4gdGhpcyBhcnJheS5cbiAgICBpZiAodGhpcy5jb25maWcuc2hvd09uUmlnaHRTaWRlKSB7XG4gICAgICByZXR1cm4gWydyaWdodCcsICdsZWZ0J107XG4gICAgfVxuICAgIHJldHVybiBbJ2xlZnQnLCAncmlnaHQnXTtcbiAgfVxuXG4gIGlzUGVybWFuZW50RG9ja0l0ZW0oKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBnZXRQcmVmZXJyZWRXaWR0aCgpIHtcbiAgICBpZiAoIXRoaXMucmVmcykgcmV0dXJuO1xuICAgIHRoaXMucmVmcy5saXN0LnN0eWxlLndpZHRoID09PSAnbWluLWNvbnRlbnQnO1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnJlZnMubGlzdC5vZmZzZXRXaWR0aDtcbiAgICB0aGlzLnJlZnMubGlzdC5zdHlsZS53aWR0aCA9PT0gJyc7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGhhbmRsZUV2ZW50cygpIHtcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChcbiAgICAgIGF0b20uY29uZmlnLm9uRGlkQ2hhbmdlKCdwdWxzYXItb3V0bGluZS12aWV3JywgKHsgbmV3VmFsdWUgfSkgPT4ge1xuICAgICAgICB0aGlzLmNvbmZpZyA9IG5ld1ZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgfSksXG4gICAgICBhdG9tLndvcmtzcGFjZS5vbkRpZENoYW5nZUFjdGl2ZVRleHRFZGl0b3IoZWRpdG9yID0+IHtcbiAgICAgICAgaWYgKGVkaXRvcikge1xuICAgICAgICAgIC8vIElmIHRoZSBuZXcgYWN0aXZlIGl0ZW0gaXNuJ3QgYSBUZXh0RWRpdG9yLCB3ZSB3b24ndCByZXBsYWNlIHRoZVxuICAgICAgICAgIC8vIHByZXZpb3VzIHRleHQgZWRpdG9yLCBiZWNhdXNlIHRoZSBvdXRsaW5lIHZpZXcgd2lsbCBzdGlsbCBzaG93XG4gICAgICAgICAgLy8gdGhhdCBlZGl0b3IncyBzeW1ib2xzLlxuICAgICAgICAgIHRoaXMuYWN0aXZlRWRpdG9yO1xuICAgICAgICAgIHRoaXMuc3dpdGNoVG9FZGl0b3IoZWRpdG9yKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcblxuICAgIGlmICh0aGlzLmVsZW1lbnQpIHtcbiAgICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKFxuICAgICAgICBhdG9tLmNvbW1hbmRzLmFkZChcbiAgICAgICAgICB0aGlzLmVsZW1lbnQsXG4gICAgICAgICAge1xuICAgICAgICAgICAgJ2NvcmU6bW92ZS11cCc6IChlKSA9PiB0aGlzLm1vdmVVcChlKSxcbiAgICAgICAgICAgICdjb3JlOm1vdmUtZG93bic6IChlKSA9PiB0aGlzLm1vdmVEb3duKGUpLFxuICAgICAgICAgICAgJ2NvcmU6bW92ZS10by10b3AnOiAoZSkgPT4gdGhpcy5tb3ZlVG9Ub3AoZSksXG4gICAgICAgICAgICAnY29yZTptb3ZlLXRvLWJvdHRvbSc6IChlKSA9PiB0aGlzLm1vdmVUb0JvdHRvbShlKSxcbiAgICAgICAgICAgICdwdWxzYXItb3V0bGluZS12aWV3OmNvbGxhcHNlLXNlbGVjdGVkLWVudHJ5JzogKCkgPT4gdGhpcy5jb2xsYXBzZVNlbGVjdGVkRW50cnkoKSxcbiAgICAgICAgICAgICdwdWxzYXItb3V0bGluZS12aWV3OmFjdGl2YXRlLXNlbGVjdGVkLWVudHJ5JzogKCkgPT4gdGhpcy5hY3RpdmF0ZVNlbGVjdGVkRW50cnkoKVxuICAgICAgICAgIH1cbiAgICAgICAgKVxuICAgICAgKTtcblxuICAgICAgdGhpcy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgKCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuc2VsZWN0ZWRSZWYpIHtcbiAgICAgICAgICB0aGlzLm1vdmVUb0luZGV4KDApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2VsZWN0ZWRSZWY/LmZvY3VzKCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBpc0ZvY3VzZWQoKSB7XG4gICAgaWYgKCF0aGlzLmVsZW1lbnQpIHJldHVybiBmYWxzZTtcbiAgICBsZXQgYWN0aXZlID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgICByZXR1cm4gdGhpcy5lbGVtZW50ID09PSBhY3RpdmUgfHwgdGhpcy5lbGVtZW50LmNvbnRhaW5zKGFjdGl2ZSk7XG4gIH1cblxuICAvKipcbiAgICogTW92ZSB0aGUgc2VsZWN0aW9uIHVwIHRvIHRoZSBwcmV2aW91cyBpdGVtLlxuICAgKiBAcGFyYW0gZXZlbnQgQ29tbWFuZCBldmVudC5cbiAgICovXG4gIG1vdmVVcChldmVudDogRXZlbnQpIHtcbiAgICByZXR1cm4gdGhpcy5tb3ZlRGVsdGEoZXZlbnQsIC0xKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlIHRoZSBzZWxlY3Rpb24gZG93biB0byB0aGUgbmV4dCBpdGVtLlxuICAgKiBAcGFyYW0gZXZlbnQgQ29tbWFuZCBldmVudC5cbiAgICovXG4gIG1vdmVEb3duKGV2ZW50OiBFdmVudCk6IHZvaWQge1xuICAgIHJldHVybiB0aGlzLm1vdmVEZWx0YShldmVudCwgMSk7XG4gIH1cblxuICBtb3ZlRGVsdGEoZXZlbnQ6IEV2ZW50LCBkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgbGV0IGl0ZW1zID0gdGhpcy5nZXRWaXNpYmxlTGlzdEl0ZW1zKCk7XG5cbiAgICBsZXQgc3ltYm9sID0gdGhpcy5nZXRTZWxlY3RlZFN5bWJvbCgpO1xuICAgIGlmICghc3ltYm9sKSByZXR1cm47XG5cbiAgICBsZXQgZWxlbWVudCA9IHRoaXMuZWxlbWVudEZvclN5bWJvbChzeW1ib2wpO1xuICAgIGlmICghZWxlbWVudCkgcmV0dXJuO1xuXG4gICAgbGV0IGluZGV4ID0gaXRlbXMuaW5kZXhPZihlbGVtZW50KTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSByZXR1cm47XG5cbiAgICBsZXQgbmV3SW5kZXggPSBpbmRleCArIGRlbHRhO1xuICAgIGlmIChuZXdJbmRleCA+PSBpdGVtcy5sZW5ndGgpIG5ld0luZGV4ID0gaXRlbXMubGVuZ3RoIC0gMTtcbiAgICBpZiAobmV3SW5kZXggPCAwKSBuZXdJbmRleCA9IDA7XG5cbiAgICByZXR1cm4gdGhpcy5tb3ZlVG9JbmRleChuZXdJbmRleCwgaXRlbXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIE1vdmUgdG8gYSBzeW1ib2wgd2l0aCBhIHNwZWNpZmljIGluZGV4IGluIHRoZSBmbGF0IGxpc3Qgb2YgdmlzaWJsZSBzeW1ib2xzLlxuICAgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IHRvIG1vdmUgdG8uXG4gICAqIEBwYXJhbSBpdGVtcyBBbiBvcHRpb25hbCBhcnJheSBvZiBub2RlcyBpbiBjYXNlIHlvdSd2ZSBhbHJlYWR5IGRvbmUgdGhlXG4gICAqICAgd29yay5cbiAgICovXG4gIG1vdmVUb0luZGV4KGluZGV4OiBudW1iZXIsIGl0ZW1zPzogRWxlbWVudFtdKTogdm9pZCB7XG4gICAgaWYgKCFpdGVtcykge1xuICAgICAgaXRlbXMgPSB0aGlzLmdldFZpc2libGVMaXN0SXRlbXMoKTtcbiAgICB9XG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgaW5kZXggPSBpdGVtcy5sZW5ndGggLSAxO1xuICAgIH1cblxuICAgIGxldCBzeW1ib2wgPSB0aGlzLnN5bWJvbEZvckVsZW1lbnQoaXRlbXNbaW5kZXhdIGFzIEhUTUxFbGVtZW50KTtcbiAgICBpZiAoIXN5bWJvbCkgcmV0dXJuO1xuXG4gICAgdGhpcy5zZXRTZWxlY3RlZFN5bWJvbChzeW1ib2wpO1xuICAgIGlmICh0aGlzLmNvbmZpZz8udmlzaXRFbnRyaWVzT25LZXlib2FyZE1vdmVtZW50KSB7XG4gICAgICB0aGlzLmFjdGl2YXRlU2VsZWN0ZWRFbnRyeSgpO1xuICAgIH1cbiAgfVxuXG4gIG1vdmVUb1RvcChldmVudDogRXZlbnQpIHtcbiAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLm1vdmVUb0luZGV4KDApO1xuICB9XG5cbiAgbW92ZVRvQm90dG9tKGV2ZW50OiBFdmVudCkge1xuICAgIGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMubW92ZVRvSW5kZXgoLTEpO1xuICB9XG5cbiAgY29sbGFwc2VTZWxlY3RlZEVudHJ5KCkge1xuICAgIGlmICghdGhpcy5zZWxlY3RlZFN5bWJvbCkgcmV0dXJuO1xuICAgIGxldCBlbGVtZW50ID0gdGhpcy5lbGVtZW50Rm9yU3ltYm9sKHRoaXMuc2VsZWN0ZWRTeW1ib2wpO1xuICAgIGlmICghZWxlbWVudD8uY2xhc3NMaXN0LmNvbnRhaW5zKCdsaXN0LW5lc3RlZC1pdGVtJykpIHJldHVybjtcblxuICAgIHJldHVybiB0aGlzLmNvbGxhcHNlRW50cnkoZWxlbWVudCk7XG4gIH1cblxuICBjb2xsYXBzZUVudHJ5KGVsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgICBsZXQgY2hpbGRyZW5Hcm91cCA9IGVsZW1lbnQucXVlcnlTZWxlY3RvcignLmxpc3QtdHJlZScpO1xuICAgIGlmICghY2hpbGRyZW5Hcm91cCkgcmV0dXJuO1xuXG4gICAgbGV0IGlzQ29sbGFwc2VkID0gZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbGxhcHNlZCcpO1xuICAgIGlmIChpc0NvbGxhcHNlZCkge1xuICAgICAgY2hpbGRyZW5Hcm91cC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcbiAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnY29sbGFwc2VkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNoaWxkcmVuR3JvdXAuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2NvbGxhcHNlZCcpO1xuICAgIH1cbiAgfVxuXG4gIGFjdGl2YXRlU2VsZWN0ZWRFbnRyeSgpIHtcbiAgICBpZiAoIXRoaXMuc2VsZWN0ZWRTeW1ib2wpIHJldHVybjtcbiAgICB0aGlzLm1vdmVFZGl0b3JUb1N5bWJvbCh0aGlzLnNlbGVjdGVkU3ltYm9sKTtcbiAgfVxuXG4gIG1vdmVFZGl0b3JUb1N5bWJvbChzeW1ib2w6IFN5bWJvbEVudHJ5KSB7XG4gICAgaWYgKHN5bWJvbCAmJiB0aGlzLmFjdGl2ZUVkaXRvcikge1xuICAgICAgdGhpcy5hY3RpdmVFZGl0b3Iuc2V0Q3Vyc29yQnVmZmVyUG9zaXRpb24oXG4gICAgICAgIHN5bWJvbC5yYW5nZS5zdGFydCxcbiAgICAgICAgeyBhdXRvc2Nyb2xsOiBmYWxzZSB9XG4gICAgICApO1xuICAgICAgdGhpcy5hY3RpdmVFZGl0b3Iuc2Nyb2xsVG9DdXJzb3JQb3NpdGlvbih7IGNlbnRlcjogdHJ1ZSB9KTtcbiAgICB9XG4gIH1cblxuICBnZXQgZWxlbWVudCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlZnM/LnJvb3QgPz8gbnVsbDtcbiAgfVxuXG4gIGVsZW1lbnRGb3JTeW1ib2woc3ltYm9sOiBTeW1ib2xFbnRyeSk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gICAgbGV0IHJlZiA9IHRoaXMuc3ltYm9sRW50cnlUb1JlZlRhYmxlLmdldChzeW1ib2wpO1xuICAgIGlmICghcmVmKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gdGhpcy5yZWZzPy5bcmVmXSA/PyBudWxsO1xuICB9XG5cbiAgc3ltYm9sRm9yRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCk6IFN5bWJvbEVudHJ5IHwgbnVsbCB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBsZXQgcmVmID0gKGVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpLmRhdGFzZXQuaWQ7XG4gICAgaWYgKCFyZWYpIHJldHVybiBudWxsO1xuICAgIHJldHVybiB0aGlzLnJlZlRvU3ltYm9sRW50cnlUYWJsZS5nZXQocmVmKSA/PyBudWxsO1xuICB9XG5cbiAgaGFuZGxlRWRpdG9yRXZlbnRzKCkge1xuICAgIGxldCBlZGl0b3IgPSB0aGlzLmFjdGl2ZUVkaXRvcjtcbiAgICBsZXQgZGlzcG9zYWJsZXMgPSB0aGlzLmFjdGl2ZUVkaXRvckRpc3Bvc2FibGVzO1xuICAgIGlmICghZWRpdG9yIHx8ICFkaXNwb3NhYmxlcykgcmV0dXJuO1xuXG4gICAgZGlzcG9zYWJsZXMuYWRkKFxuICAgICAgZWRpdG9yLm9uRGlkU3RvcENoYW5naW5nKCgpID0+IHtcbiAgICAgICAgaWYgKCFlZGl0b3IpIHJldHVybjtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZUZvckVkaXRvcihlZGl0b3IpO1xuICAgICAgfSksXG4gICAgICBlZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbigoKSA9PiB7XG4gICAgICAgIGxldCBzeW1ib2wgPSB0aGlzLmdldEFjdGl2ZVN5bWJvbEZvckVkaXRvcihlZGl0b3IpO1xuICAgICAgICBpZiAoIXN5bWJvbCkgcmV0dXJuO1xuICAgICAgICB0aGlzLnNldFNlbGVjdGVkU3ltYm9sKHN5bWJvbCk7XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICBzd2l0Y2hUb0VkaXRvcihlZGl0b3I6IFRleHRFZGl0b3IpIHtcbiAgICB0aGlzLmFjdGl2ZUVkaXRvckRpc3Bvc2FibGVzPy5kaXNwb3NlKCk7XG4gICAgdGhpcy5zZWxlY3RlZFN5bWJvbCA9IG51bGw7XG4gICAgdGhpcy5zZWxlY3RlZFJlZiA9IG51bGw7XG5cbiAgICBpZiAoIWVkaXRvcikge1xuICAgICAgdGhpcy5hY3RpdmVFZGl0b3JEaXNwb3NhYmxlcyA9IG51bGw7XG4gICAgICB0aGlzLnNldFN5bWJvbHMoW10pO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFjdGl2ZUVkaXRvciA9IGVkaXRvcjtcbiAgICAgIHRoaXMuYWN0aXZlRWRpdG9yRGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpO1xuXG4gICAgICBsZXQgbmV3U3ltYm9sczogU3ltYm9sRW50cnlbXSA9IFtdO1xuICAgICAgaWYgKHRoaXMuZWRpdG9yU3ltYm9sc0xpc3QuaGFzKGVkaXRvcikpIHtcbiAgICAgICAgbmV3U3ltYm9scyA9IHRoaXMuZWRpdG9yU3ltYm9sc0xpc3QuZ2V0KGVkaXRvcikgPz8gW107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnBvcHVsYXRlRm9yRWRpdG9yKGVkaXRvcik7XG4gICAgICB9XG4gICAgICB0aGlzLnNldFN5bWJvbHMobmV3U3ltYm9scyk7XG4gICAgICB0aGlzLmhhbmRsZUVkaXRvckV2ZW50cygpO1xuICAgIH1cbiAgfVxuXG4gIHBvcHVsYXRlRm9yRWRpdG9yKGVkaXRvcjogVGV4dEVkaXRvcikge1xuICAgIHRoaXMuZ2V0U3ltYm9scygpXG4gICAgICAudGhlbihzeW1ib2xzID0+IHtcbiAgICAgICAgaWYgKCFzeW1ib2xzIHx8ICFlZGl0b3IpIHJldHVybjtcbiAgICAgICAgdGhpcy5zZXRTeW1ib2xzKHN5bWJvbHMsIGVkaXRvcik7XG4gICAgICB9KTtcbiAgfVxuXG4gIHRvZ2dsZSgpIHtcbiAgICBhdG9tLndvcmtzcGFjZS50b2dnbGUodGhpcyk7XG4gIH1cblxuICBhc3luYyBzaG93KCkge1xuICAgIGF3YWl0IGF0b20ud29ya3NwYWNlLm9wZW4odGhpcywge1xuICAgICAgc2VhcmNoQWxsUGFuZXM6IHRydWUsXG4gICAgICBhY3RpdmF0ZVBhbmU6IGZhbHNlLFxuICAgICAgYWN0aXZhdGVJdGVtOiBmYWxzZVxuICAgIH0pO1xuXG4gICAgdGhpcy5hY3RpdmF0ZSgpO1xuICB9XG5cbiAgYWN0aXZhdGUoKSB7XG4gICAgbGV0IGNvbnRhaW5lciA9IGF0b20ud29ya3NwYWNlLnBhbmVDb250YWluZXJGb3JVUkkodGhpcy5nZXRVUkkoKSk7XG4gICAgaWYgKCFpc0RvY2soY29udGFpbmVyKSkgcmV0dXJuO1xuICAgIGNvbnRhaW5lci5zaG93KCk7XG4gICAgY29udGFpbmVyLmdldEFjdGl2ZVBhbmUoKS5hY3RpdmF0ZUl0ZW1Gb3JVUkkodGhpcy5nZXRVUkkoKSk7XG4gICAgY29udGFpbmVyLmFjdGl2YXRlKCk7XG4gIH1cblxuICBoaWRlKCkge1xuICAgIGF0b20ud29ya3NwYWNlLmhpZGUodGhpcyk7XG4gIH1cblxuICBmb2N1cygpIHtcbiAgICB0aGlzLnJlZnM/LnJvb3QuZm9jdXMoKTtcbiAgfVxuXG4gIHVuZm9jdXMoKSB7XG4gICAgbGV0IGNlbnRlcjogV29ya3NwYWNlQ2VudGVyID0gYXRvbS53b3Jrc3BhY2UuZ2V0Q2VudGVyKCk7XG4gICAgY2VudGVyLmdldEFjdGl2ZVBhbmUoKS5hY3RpdmF0ZSgpO1xuICB9XG5cbiAgc2V0U3ltYm9scyhzeW1ib2xzOiBTeW1ib2xFbnRyeVtdLCBlZGl0b3I/OiBUZXh0RWRpdG9yKSB7XG4gICAgdGhpcy5zeW1ib2xzID0gc3ltYm9scztcbiAgICBpZiAoZWRpdG9yICYmIGVkaXRvciAhPT0gdGhpcy5hY3RpdmVFZGl0b3IpIHJldHVybjtcbiAgICBpZiAodGhpcy5hY3RpdmVFZGl0b3IpIHtcbiAgICAgIHRoaXMuZWRpdG9yU3ltYm9sc0xpc3Quc2V0KHRoaXMuYWN0aXZlRWRpdG9yLCBzeW1ib2xzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlKClcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgbGV0IHN5bWJvbCA9IHRoaXMuZ2V0QWN0aXZlU3ltYm9sRm9yRWRpdG9yKHRoaXMuYWN0aXZlRWRpdG9yKTtcbiAgICAgICAgaWYgKCFzeW1ib2wpIHJldHVybjtcbiAgICAgICAgdGhpcy5zZXRTZWxlY3RlZFN5bWJvbChzeW1ib2wpO1xuICAgICAgfSk7XG4gIH1cblxuICBnZXRBY3RpdmVTeW1ib2xGb3JFZGl0b3IoZWRpdG9yPzogVGV4dEVkaXRvciB8IG51bGwsIGZsYXRTeW1ib2xzPzogU3ltYm9sRW50cnlbXSk6IFN5bWJvbEVudHJ5IHwgbnVsbCB7XG4gICAgZWRpdG9yID8/PSB0aGlzLmFjdGl2ZUVkaXRvcjtcbiAgICBpZiAoIWVkaXRvcikgcmV0dXJuIG51bGw7XG5cbiAgICBsZXQgY3Vyc29yID0gZWRpdG9yLmdldExhc3RDdXJzb3IoKTtcbiAgICBsZXQgcG9zaXRpb24gPSBjdXJzb3IuZ2V0QnVmZmVyUG9zaXRpb24oKTtcblxuICAgIGxldCBhbGxTeW1ib2xzID0gZmxhdFN5bWJvbHMgPz8gdGhpcy5nZXRGbGF0U3ltYm9scygpO1xuICAgIGxldCBjYW5kaWRhdGUgPSBudWxsO1xuICAgIGZvciAobGV0IHN5bWJvbCBvZiBhbGxTeW1ib2xzKSB7XG4gICAgICBsZXQgcmFuZ2UgPSBzeW1ib2wucmFuZ2U7XG4gICAgICBsZXQgeyByb3cgfSA9IHBvc2l0aW9uO1xuICAgICAgaWYgKChyYW5nZS5zdGFydC5yb3cgIT09IHJvdykgJiYgKHJhbmdlLmVuZC5yb3cgIT09IHJvdykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAocmFuZ2UuY29udGFpbnNQb2ludChwb3NpdGlvbikpIHtcbiAgICAgICAgaWYgKCFjYW5kaWRhdGUgfHwgIWNhbmRpZGF0ZS5yYW5nZS5jb250YWluc1BvaW50KHBvc2l0aW9uKSB8fCByYW5nZS5jb21wYXJlKGNhbmRpZGF0ZS5yYW5nZSkgPiAwKSB7XG4gICAgICAgICAgLy8gUHJlZmVyIHdoaWNoZXZlciByYW5nZSBpcyBzbWFsbGVyLCBvciBlbHNlIHdoaWNoZXZlciBvbmUgYWN0dWFsbHlcbiAgICAgICAgICAvLyBsaWVzIGluIHRoZSBzeW1ib2wncyByYW5nZSBpbnN0ZWFkIG9mIGp1c3QgdG91Y2hpbmcgdGhlIHNhbWUgcm93LlxuICAgICAgICAgIGNhbmRpZGF0ZSA9IHN5bWJvbDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghY2FuZGlkYXRlKSB7XG4gICAgICAgIC8vIEV2ZW4gaWYgaXQncyBub3QgYW4gZXhhY3QgbWF0Y2gsIHVzZSBpdCBpZiBpdCBoYXBwZW5zIHRvIHRvdWNoIHRoZVxuICAgICAgICAvLyBzYW1lIHJvdyBhcyB0aGUgY3Vyc29yLlxuICAgICAgICBjYW5kaWRhdGUgPSBzeW1ib2w7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNhbmRpZGF0ZTtcbiAgfVxuXG4gIHNldFNlbGVjdGVkU3ltYm9sKG5ld1N5bWJvbDogU3ltYm9sRW50cnkgfCBudWxsKSB7XG4gICAgaWYgKHRoaXMuc2VsZWN0ZWRSZWYpIHtcbiAgICAgIHRoaXMudG9nZ2xlUmVmKHRoaXMuc2VsZWN0ZWRSZWYsIGZhbHNlKTtcbiAgICB9XG5cbiAgICB0aGlzLnNlbGVjdGVkU3ltYm9sID0gbnVsbDtcbiAgICB0aGlzLnNlbGVjdGVkUmVmID0gbnVsbDtcblxuICAgIGlmICghbmV3U3ltYm9sKSByZXR1cm47XG5cbiAgICBsZXQgbmV3RWxlbWVudCA9IHRoaXMuZ2V0Q2xvc2VzdFZpc2libGVFbGVtZW50Rm9yU3ltYm9sKG5ld1N5bWJvbCk7XG4gICAgaWYgKCFuZXdFbGVtZW50KSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbcHVsc2FyLW91dGxpbmUtdmlld10gQ291bGQgbm90IGZpbmQgZWxlbWVudCBmb3Igc3ltYm9sOmAsIG5ld1N5bWJvbCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zZWxlY3RlZFN5bWJvbCA9IG5ld1N5bWJvbDtcbiAgICB0aGlzLnNlbGVjdGVkUmVmID0gbmV3RWxlbWVudDtcbiAgICB0aGlzLnRvZ2dsZVJlZih0aGlzLnNlbGVjdGVkUmVmLCB0cnVlKTtcbiAgICB0aGlzLnNjcm9sbFNlbGVjdGVkRW50cnlJbnRvVmlld0lmTmVlZGVkKCk7XG4gIH1cblxuICBzY3JvbGxTZWxlY3RlZEVudHJ5SW50b1ZpZXdJZk5lZWRlZCgpIHtcbiAgICBpZiAoIXRoaXMuc2VsZWN0ZWRSZWYgfHwgIXRoaXMuZWxlbWVudCkgcmV0dXJuO1xuICAgIGxldCBlbGVtZW50ID0gdGhpcy5zZWxlY3RlZFJlZiBhcyAoSFRNTEVsZW1lbnQgfCBudWxsKTtcbiAgICBpZiAoZWxlbWVudD8uY2xhc3NMaXN0LmNvbnRhaW5zKCdsaXN0LW5lc3RlZC1pdGVtJykpIHtcbiAgICAgIGVsZW1lbnQgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5saXN0LWl0ZW0nKTtcbiAgICB9XG4gICAgaWYgKCFlbGVtZW50KSByZXR1cm47XG5cbiAgICBsZXQgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgbGV0IGNvbnRhaW5lclJlY3QgPSB0aGlzLmVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICBpZiAocmVjdC5ib3R0b20gPiAoY29udGFpbmVyUmVjdC5oZWlnaHQgLSA1MCkgfHwgcmVjdC50b3AgPCA1MCkge1xuICAgICAgdGhpcy5zZWxlY3RlZFJlZi5zY3JvbGxJbnRvVmlldygpO1xuICAgICAgdGhpcy5lbGVtZW50LnNjcm9sbExlZnQgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGdldFNlbGVjdGVkU3ltYm9sKCkge1xuICAgIHJldHVybiB0aGlzLnNlbGVjdGVkU3ltYm9sO1xuICB9XG5cbiAgZ2V0Q2xvc2VzdFZpc2libGVFbGVtZW50Rm9yU3ltYm9sKHN5bWJvbDogU3ltYm9sRW50cnkpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICAgIGxldCBuZXdFbGVtZW50ID0gdGhpcy5lbGVtZW50Rm9yU3ltYm9sKHN5bWJvbCk7XG4gICAgaWYgKCFuZXdFbGVtZW50KSByZXR1cm4gbnVsbDtcblxuICAgIHdoaWxlICgobmV3RWxlbWVudD8ub2Zmc2V0SGVpZ2h0ID8/IDEpID09PSAwKSB7XG4gICAgICBsZXQgcGFyZW50Tm9kZSA9IG5ld0VsZW1lbnQ/LnBhcmVudE5vZGUgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICBpZiAoIXBhcmVudE5vZGUpIHJldHVybiBudWxsO1xuICAgICAgbmV3RWxlbWVudCA9IHBhcmVudE5vZGUuY2xvc2VzdCgnbGknKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld0VsZW1lbnQgPz8gbnVsbDtcbiAgfVxuXG4gIHJldmVhbEluT3V0bGluZVZpZXcoZWRpdG9yOiBUZXh0RWRpdG9yKSB7XG4gICAgbGV0IHN5bWJvbCA9IHRoaXMuZ2V0QWN0aXZlU3ltYm9sRm9yRWRpdG9yKGVkaXRvcik7XG4gICAgaWYgKCFzeW1ib2wpIHJldHVybjtcblxuICAgIGxldCBlbGVtZW50ID0gdGhpcy5lbGVtZW50Rm9yU3ltYm9sKHN5bWJvbCk7XG4gICAgaWYgKCFlbGVtZW50KSByZXR1cm47XG5cbiAgICB3aGlsZSAoZWxlbWVudC5vZmZzZXRIZWlnaHQgPT09IDApIHtcbiAgICAgIGxldCBuZWFyZXN0Q29sbGFwc2VkTm9kZSA9IGVsZW1lbnQuY2xvc2VzdCgnLmNvbGxhcHNlZCcpO1xuICAgICAgaWYgKCFuZWFyZXN0Q29sbGFwc2VkTm9kZSkgYnJlYWs7XG4gICAgICB0aGlzLmNvbGxhcHNlRW50cnkobmVhcmVzdENvbGxhcHNlZE5vZGUpO1xuICAgIH1cblxuICAgIHRoaXMuc2V0U2VsZWN0ZWRTeW1ib2woc3ltYm9sKTtcbiAgfVxuXG4gIGFzeW5jIGdldFN5bWJvbHMoKTogUHJvbWlzZTxTeW1ib2xFbnRyeVtdIHwgbnVsbD4ge1xuICAgIGlmICghdGhpcy5hY3RpdmVFZGl0b3IpIHJldHVybiBudWxsO1xuXG4gICAgbGV0IHByb3ZpZGVyID0gdGhpcy5icm9rZXIuY2hvb3NlUHJvdmlkZXJGb3JFZGl0b3IodGhpcy5hY3RpdmVFZGl0b3IpO1xuICAgIGlmICghcHJvdmlkZXIpIHJldHVybiBudWxsO1xuXG4gICAgbGV0IG91dGxpbmUgPSBhd2FpdCBwcm92aWRlci5nZXRPdXRsaW5lKHRoaXMuYWN0aXZlRWRpdG9yKTtcbiAgICBpZiAoIW91dGxpbmUpIHJldHVybiBudWxsO1xuXG4gICAgcmV0dXJuIHRoaXMuY29uc3VtZU91dGxpbmUob3V0bGluZSk7XG4gIH1cblxuICBjb25zdW1lT3V0bGluZShvdXRsaW5lOiBhdG9tSWRlLk91dGxpbmUpOiBTeW1ib2xFbnRyeVtdIHtcbiAgICB0aGlzLm91dGxpbmUgPSBvdXRsaW5lO1xuICAgIGxldCBzeW1ib2xzOiBTeW1ib2xFbnRyeVtdID0gW107XG4gICAgZnVuY3Rpb24gY29uc3VtZVN5bWJvbChzeW1ib2w6IGF0b21JZGUuT3V0bGluZVRyZWUpIHtcbiAgICAgIGxldCB7XG4gICAgICAgIGljb24sXG4gICAgICAgIGtpbmQsXG4gICAgICAgIHBsYWluVGV4dCxcbiAgICAgICAgdG9rZW5pemVkVGV4dCxcbiAgICAgICAgcmVwcmVzZW50YXRpdmVOYW1lLFxuICAgICAgICBzdGFydFBvc2l0aW9uLFxuICAgICAgICBlbmRQb3NpdGlvbixcbiAgICAgICAgY2hpbGRyZW5cbiAgICAgIH0gPSBzeW1ib2w7XG5cbiAgICAgIGxldCByYW5nZSA9IG5ldyBSYW5nZShcbiAgICAgICAgc3RhcnRQb3NpdGlvbixcbiAgICAgICAgZW5kUG9zaXRpb24gPz8gc3RhcnRQb3NpdGlvblxuICAgICAgKTtcblxuICAgICAgbGV0IHVudG9rZW5pemVkVGV4dDtcbiAgICAgIGlmICh0b2tlbml6ZWRUZXh0KSB7XG4gICAgICAgIHVudG9rZW5pemVkVGV4dCA9IGludGVycHJldFRva2VuaXplZFRleHQodG9rZW5pemVkVGV4dCk7XG4gICAgICB9XG5cbiAgICAgIGxldCByZXN1bHQ6IFN5bWJvbEVudHJ5ID0ge1xuICAgICAgICBpY29uLFxuICAgICAgICBraW5kLFxuICAgICAgICBuYW1lOiB1bnRva2VuaXplZFRleHQgPz8gcGxhaW5UZXh0ID8/IHJlcHJlc2VudGF0aXZlTmFtZSA/PyAnJyxcbiAgICAgICAgcmFuZ2VcbiAgICAgIH07XG5cbiAgICAgIGlmIChjaGlsZHJlbiAmJiBjaGlsZHJlbi5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJlc3VsdC5jaGlsZHJlbiA9IGNoaWxkcmVuLm1hcChjb25zdW1lU3ltYm9sKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgc3ltYm9sIG9mIG91dGxpbmUub3V0bGluZVRyZWVzKSB7XG4gICAgICBzeW1ib2xzLnB1c2goY29uc3VtZVN5bWJvbChzeW1ib2wpKTtcbiAgICB9XG5cbiAgICB0aGlzLnNldFN5bWJvbHMoc3ltYm9scyk7XG4gICAgcmV0dXJuIHN5bWJvbHM7XG4gIH1cblxuICB1cGRhdGUoKSB7XG4gICAgcmV0dXJuIGV0Y2gudXBkYXRlKHRoaXMpO1xuICB9XG5cbiAgcmVuZGVyU3ltYm9sKHN5bWJvbDogU3ltYm9sRW50cnkpIHtcbiAgICBpZiAodGhpcy5zaG91bGRJZ25vcmVTeW1ib2woc3ltYm9sKSkgcmV0dXJuIG51bGw7XG4gICAgbGV0IGNoaWxkcmVuID0gbnVsbDtcbiAgICBsZXQgaWQgPSBzeW1ib2xJZCsrO1xuICAgIHRoaXMuc3ltYm9sRW50cnlUb1JlZlRhYmxlLnNldChzeW1ib2wsIFN0cmluZyhpZCkpO1xuICAgIHRoaXMucmVmVG9TeW1ib2xFbnRyeVRhYmxlLnNldChTdHJpbmcoaWQpLCBzeW1ib2wpO1xuICAgIGlmIChzeW1ib2wuY2hpbGRyZW4pIHtcbiAgICAgIGNoaWxkcmVuID0gc3ltYm9sLmNoaWxkcmVuLm1hcChzeW0gPT4gdGhpcy5yZW5kZXJTeW1ib2woc3ltKSk7XG4gICAgICBjaGlsZHJlbiA9IGNoaWxkcmVuLmZpbHRlcihjID0+IGMgPz8gZmFsc2UpO1xuICAgIH1cbiAgICBsZXQgY2hpbGRNZW51ID0gbnVsbDtcbiAgICBpZiAoY2hpbGRyZW4gJiYgY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgY2hpbGRNZW51ID0gKFxuICAgICAgICA8dWwgY2xhc3NOYW1lPSdvdXRsaW5lLWxpc3QgbGlzdC10cmVlJz5cbiAgICAgICAgICB7Y2hpbGRyZW59XG4gICAgICAgIDwvdWw+XG4gICAgICApO1xuICAgIH1cblxuICAgIGxldCBuYW1lQ2xhc3NlcyA9IENsYXNzTmFtZXMoXG4gICAgICAnbmFtZScsXG4gICAgICBnZXRPY3RvY2F0SWNvbkZvck91dGxpbmVJY29uKHN5bWJvbC5pY29uKVxuICAgICk7XG5cbiAgICBpZiAoY2hpbGRyZW4gJiYgY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGxpXG4gICAgICAgICAgY2xhc3NOYW1lPVwibGlzdC1uZXN0ZWQtaXRlbSBvdXRsaW5lLXZpZXctZW50cnlcIlxuICAgICAgICAgIGRhdGFzZXQ9eyB7IGlkOiBTdHJpbmcoaWQpIH0gfVxuICAgICAgICAgIHJlZj17U3RyaW5nKGlkKX1cbiAgICAgICAgPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwib3V0bGluZS12aWV3LW9wdGlvbiBsaXN0LWl0ZW1cIiB0YWJJbmRleD17LTF9PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e25hbWVDbGFzc2VzfSA+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibmFtZS1pbm5lclwiIHRpdGxlPXt0aXRsZUZvclN5bWJvbChzeW1ib2wpfT57c3ltYm9sLm5hbWV9PC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB7Y2hpbGRNZW51fVxuICAgICAgICA8L2xpPlxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGxpXG4gICAgICAgICAgY2xhc3NOYW1lPVwib3V0bGluZS12aWV3LWVudHJ5IG91dGxpbmUtdmlldy1vcHRpb24gbGlzdC1pdGVtXCJcbiAgICAgICAgICB0YWJJbmRleD17LTF9XG4gICAgICAgICAgZGF0YXNldD17IHsgaWQ6IFN0cmluZyhpZCkgfSB9XG4gICAgICAgICAgcmVmPXtTdHJpbmcoaWQpfVxuICAgICAgICA+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9e25hbWVDbGFzc2VzfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibmFtZS1pbm5lclwiPntzeW1ib2wubmFtZX08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9saT5cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmVuZGVyKCkge1xuICAgIHRoaXMuc3ltYm9sRW50cnlUb1JlZlRhYmxlLmNsZWFyKCk7XG4gICAgdGhpcy5yZWZUb1N5bWJvbEVudHJ5VGFibGUuY2xlYXIoKTtcbiAgICBzeW1ib2xJZCA9IDE7XG4gICAgbGV0IHN5bWJvbHMgPSB0aGlzLnN5bWJvbHMgPz8gW107XG4gICAgbGV0IHN5bWJvbEVsZW1lbnRzID0gc3ltYm9scy5tYXAoXG4gICAgICBzeW0gPT4gdGhpcy5yZW5kZXJTeW1ib2woc3ltKVxuICAgICk7XG4gICAgbGV0IHJvb3RDbGFzc2VzID0gQ2xhc3NOYW1lcyhcbiAgICAgICd0b29sLXBhbmVsJyxcbiAgICAgICdvdXRsaW5lLXZpZXcnLFxuICAgICAge1xuICAgICAgICAnd2l0aC1lbGxpcHNpcy1zdHJhdGVneSc6IHRoaXMuY29uZmlnLm5hbWVPdmVyZmxvd1N0cmF0ZWd5ID09PSAnZWxsaXBzaXMnXG4gICAgICB9XG4gICAgKTtcblxuICAgIGxldCBjb250ZW50cyA9IChcbiAgICAgIDx1bCBjbGFzc05hbWU9J2JhY2tncm91bmQtbWVzc2FnZSc+XG4gICAgICAgIDxsaT5ObyBTeW1ib2xzPC9saT5cbiAgICAgIDwvdWw+XG4gICAgKTtcbiAgICBpZiAoc3ltYm9sRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgY29udGVudHMgPSAoXG4gICAgICAgIDx1bCBjbGFzc05hbWU9J291dGxpbmUtbGlzdCBvdXRsaW5lLWxpc3Qtcm9vdCBmdWxsLW1lbnUgZm9jdXNhYmxlLXBhbmVsIGxpc3QtdHJlZSBoYXMtY29sbGFwc2FibGUtY2hpbGRyZW4nIHJlZj0nbGlzdCc+XG4gICAgICAgICAge3N5bWJvbEVsZW1lbnRzfVxuICAgICAgICA8L3VsPlxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9e3Jvb3RDbGFzc2VzfSB0YWJJbmRleD17LTF9IHJlZj0ncm9vdCc+XG4gICAgICAgIHtjb250ZW50c31cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHRvZ2dsZVJlZihyZWY6IEVsZW1lbnQsIGFkZDogYm9vbGVhbikge1xuICAgIGlmICghcmVmKSByZXR1cm47XG4gICAgbGV0IGl0ZW06IEVsZW1lbnQgfCBudWxsID0gcmVmO1xuICAgIGlmICghaXRlbSkgcmV0dXJuO1xuICAgIGlmIChhZGQpIHtcbiAgICAgIGl0ZW0uY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaXRlbS5jbGFzc0xpc3QucmVtb3ZlKCdzZWxlY3RlZCcpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc2hvdWxkSWdub3JlU3ltYm9sKHN5bWJvbDogU3ltYm9sRW50cnkpOiBib29sZWFuIHtcbiAgICBsZXQgeyBpZ25vcmVkU3ltYm9sVHlwZXMgfSA9IHRoaXMuY29uZmlnO1xuICAgIGlmIChzeW1ib2wua2luZCAmJiBpZ25vcmVkU3ltYm9sVHlwZXMuaW5jbHVkZXMoc3ltYm9sLmtpbmQpKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoc3ltYm9sLmljb24gJiYgaWdub3JlZFN5bWJvbFR5cGVzLmluY2x1ZGVzKHN5bWJvbC5pY29uKSkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRGbGF0U3ltYm9scygpOiBTeW1ib2xFbnRyeVtdIHtcbiAgICBpZiAoIXRoaXMuc3ltYm9scykgcmV0dXJuIFtdO1xuICAgIGxldCByZXN1bHRzOiBTeW1ib2xFbnRyeVtdID0gW107XG4gICAgbGV0IHByb2Nlc3NTeW1ib2xzID0gKGl0ZW06IFN5bWJvbEVudHJ5KSA9PiB7XG4gICAgICBpZiAodGhpcy5zaG91bGRJZ25vcmVTeW1ib2woaXRlbSkpIHJldHVybjtcbiAgICAgIHJlc3VsdHMucHVzaChpdGVtKTtcbiAgICAgIGlmIChpdGVtLmNoaWxkcmVuKSB7XG4gICAgICAgIGZvciAobGV0IGNoaWxkIG9mIGl0ZW0uY2hpbGRyZW4pIHtcbiAgICAgICAgICBwcm9jZXNzU3ltYm9scyhjaGlsZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICAgIGZvciAobGV0IHN5bWJvbCBvZiB0aGlzLnN5bWJvbHMpIHtcbiAgICAgIHByb2Nlc3NTeW1ib2xzKHN5bWJvbCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0NsaWNrT25DYXJldChldmVudDogTW91c2VFdmVudCkge1xuICAgIGxldCBlbGVtZW50ID0gZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuICAgIGlmIChlbGVtZW50Py53ZWJraXRNYXRjaGVzU2VsZWN0b3IoJy5uYW1lJykpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIFRoZSBjYXJldCBjb21lcyBmcm9tIGdlbmVyYXRlZCBjb250ZW50IGluIGEgYDo6YmVmb3JlYCBDU1MgcnVsZS4gV2VcbiAgICAvLyBjYW4ndCBkZXRlY3Qgd2hldGhlciBpdCB3YXMgY2xpY2tlZCBvbiwgYnV0IHdlIGNhbiBtZWFzdXJlIHRoZSBhbW91bnQgb2ZcbiAgICAvLyBzcGFjZSBhbGxvY2F0ZWQgdG8gdGhlIGNhcmV0IG9uIHRoZSBsZWZ0IHNpZGUsIGFuZCB0aGVuIGFzY2VydGFpbiB0aGF0XG4gICAgLy8gdGhlIG1vdXNlIHdhcyBpbiB0aGF0IHpvbmUuXG4gICAgbGV0IGVsUmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgbGV0IG5hbWVSZWN0ID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcubmFtZScpPy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBpZiAoIW5hbWVSZWN0KSByZXR1cm4gZmFsc2U7XG5cbiAgICBsZXQgZGlzdGFuY2UgPSBuYW1lUmVjdC5sZWZ0IC0gZWxSZWN0LmxlZnQ7XG4gICAgcmV0dXJuIGV2ZW50Lm9mZnNldFggPCBkaXN0YW5jZTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0VmlzaWJsZUxpc3RJdGVtcygpIHtcbiAgICBpZiAoIXRoaXMuZWxlbWVudCkgcmV0dXJuIFtdO1xuICAgIGxldCBjaG9pY2VzID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2xpLmxpc3QtaXRlbSwgbGkubGlzdC1uZXN0ZWQtaXRlbScpO1xuICAgIGlmICghY2hvaWNlcyB8fCBjaG9pY2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuICAgIHJldHVybiBBcnJheS5mcm9tKGNob2ljZXMpLmZpbHRlcihjaG9pY2UgPT4ge1xuICAgICAgaWYgKCEoJ29mZnNldEhlaWdodCcgaW4gY2hvaWNlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgcmV0dXJuIChjaG9pY2UgYXMgSFRNTEVsZW1lbnQpLm9mZnNldEhlaWdodCA+IDA7XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3V0bGluZVZpZXc7XG4iXX0=