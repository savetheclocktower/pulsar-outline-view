/** @jsx etch.dom */

import etch from 'etch';
import {
  CompositeDisposable,
  Dock,
  Emitter,
  Range,
  TextEditor,
  WorkspaceCenter
} from 'atom';
import ClassNames from 'classnames';
import ProviderBroker from './provider-broker';
import type * as atomIde from 'atom-ide-base';

type SymbolEntry = {
  name: string,
  icon?: string,
  kind?: string,
  range: Range,
  children?: SymbolEntry[]
};

type OutlineViewConfig = {
  visitEntriesOnKeyboardMovement: boolean,
  showOnRightSide: boolean,
  nameOverflowStrategy: 'scroll' | 'ellipsis',
  ignoredSymbolTypes: string[]
};

const OUTLINE_VIEW_URI = 'atom://pulsar-outline-view';
let nextInstanceId = 1;
let symbolId = 1;


function isDock(item: unknown): item is Dock {
  if (item === null || typeof item !== 'object') return false;
  return item.constructor.name === 'Dock';
}

function interpretTokenizedText(tokenizedText: atomIde.TokenizedText): string {
  let result = [];
  for (let token of tokenizedText) {
    result.push(token.value);
  }
  return result.join('');
}

function getOctocatIconForOutlineIcon(outlineIcon?: string): string {
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

function titleForSymbol(symbol: SymbolEntry) {
  let kindTag = '';
  if (symbol.kind) {
    kindTag = ` (${symbol.kind})`;
  } else if (symbol.icon) {
    kindTag = ` (${symbol.icon})`;
  }
  return `${symbol.name}${kindTag}`;
}

class OutlineView {
  protected id: number;
  protected refs?: { [key: string]: HTMLElement };
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

  constructor(broker: ProviderBroker, _state?: unknown) {
    this.id = nextInstanceId++;
    this.broker = broker;

    this.editorSymbolsList = new Map();
    this.symbolEntryToRefTable = new Map();
    this.refToSymbolEntryTable = new Map();
    this.disposables = new CompositeDisposable();
    this.emitter = new Emitter();
    this.activeEditor = null;
    this.config = atom.config.get('pulsar-outline-view');

    etch.initialize(this);
    etch.setScheduler(atom.views);

    this.element?.addEventListener('click', (event) => {
      if (!this.activeEditor) return;
      if (this.isClickOnCaret(event)) {
        let target = (event.target as HTMLElement)?.closest('li.outline-view-entry');
        if (!target) return;
        return this.collapseEntry(target);
      }

      let target = (event.target as HTMLElement)?.closest('li.outline-view-entry');
      if (!target) return;

      let ref = (target as HTMLElement).dataset.id;
      if (!ref) return;

      let symbol = this.refToSymbolEntryTable.get(ref);
      if (!symbol) return;

      this.moveEditorToSymbol(symbol);
    });

    this.handleEvents();

    let editor = atom.workspace.getActiveTextEditor();
    if (editor) {
      this.switchToEditor(editor);
    }
  }

  async destroy() {
    this.disposables.dispose();
    this.emitter.emit('did-destroy');
    await etch.destroy(this);
  }

  onDidDestroy(callback: () => void) {
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
    if (!this.refs) return;
    this.refs.list.style.width === 'min-content';
    let result = this.refs.list.offsetWidth;
    this.refs.list.style.width === '';
    return result;
  }

  handleEvents() {
    this.disposables.add(
      atom.config.onDidChange('pulsar-outline-view', ({ newValue }) => {
        this.config = newValue;
        this.update();
      }),
      atom.workspace.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          // If the new active item isn't a TextEditor, we won't replace the
          // previous text editor, because the outline view will still show
          // that editor's symbols.
          this.activeEditor;
          this.switchToEditor(editor);
        }
      }),
    );

    if (this.element) {
      this.disposables.add(
        atom.commands.add(
          this.element,
          {
            'core:move-up': (e) => this.moveUp(e),
            'core:move-down': (e) => this.moveDown(e),
            'core:move-to-top': (e) => this.moveToTop(e),
            'core:move-to-bottom': (e) => this.moveToBottom(e),
            'pulsar-outline-view:collapse-selected-entry': () => this.collapseSelectedEntry(),
            'pulsar-outline-view:activate-selected-entry': () => this.activateSelectedEntry()
          }
        )
      );

      this.element.addEventListener('focus', () => {
        if (!this.selectedRef) {
          this.moveToIndex(0);
        }
        this.selectedRef?.focus();
      });
    }
  }

  isFocused() {
    if (!this.element) return false;
    let active = document.activeElement;
    return this.element === active || this.element.contains(active);
  }

  /**
   * Move the selection up to the previous item.
   * @param event Command event.
   */
  moveUp(event: Event) {
    return this.moveDelta(event, -1);
  }

  /**
   * Move the selection down to the next item.
   * @param event Command event.
   */
  moveDown(event: Event): void {
    return this.moveDelta(event, 1);
  }

  moveDelta(event: Event, delta: number): void {
    event.stopImmediatePropagation();
    let items = this.getVisibleListItems();

    let symbol = this.getSelectedSymbol();
    if (!symbol) return;

    let element = this.elementForSymbol(symbol);
    if (!element) return;

    let index = items.indexOf(element);
    if (index === -1) return;

    let newIndex = index + delta;
    if (newIndex >= items.length) newIndex = items.length - 1;
    if (newIndex < 0) newIndex = 0;

    return this.moveToIndex(newIndex, items);
  }

  /**
   * Move to a symbol with a specific index in the flat list of visible symbols.
   * @param index The index to move to.
   * @param items An optional array of nodes in case you've already done the
   *   work.
   */
  moveToIndex(index: number, items?: Element[]): void {
    if (!items) {
      items = this.getVisibleListItems();
    }
    if (items.length === 0) return;

    if (index === -1) {
      index = items.length - 1;
    }

    let symbol = this.symbolForElement(items[index] as HTMLElement);
    if (!symbol) return;

    this.setSelectedSymbol(symbol);
    if (this.config?.visitEntriesOnKeyboardMovement) {
      this.activateSelectedEntry();
    }
  }

  moveToTop(event: Event) {
    event.stopImmediatePropagation();
    this.moveToIndex(0);
  }

  moveToBottom(event: Event) {
    event.stopImmediatePropagation();
    this.moveToIndex(-1);
  }

  collapseSelectedEntry() {
    if (!this.selectedSymbol) return;
    let element = this.elementForSymbol(this.selectedSymbol);
    if (!element?.classList.contains('list-nested-item')) return;

    return this.collapseEntry(element);
  }

  collapseEntry(element: Element) {
    let childrenGroup = element.querySelector('.list-tree');
    if (!childrenGroup) return;

    let isCollapsed = element.classList.contains('collapsed');
    if (isCollapsed) {
      childrenGroup.classList.remove('hidden');
      element.classList.remove('collapsed');
    } else {
      childrenGroup.classList.add('hidden');
      element.classList.add('collapsed');
    }
  }

  activateSelectedEntry() {
    if (!this.selectedSymbol) return;
    this.moveEditorToSymbol(this.selectedSymbol);
  }

  moveEditorToSymbol(symbol: SymbolEntry) {
    if (symbol && this.activeEditor) {
      this.activeEditor.setCursorBufferPosition(
        symbol.range.start,
        { autoscroll: false }
      );
      this.activeEditor.scrollToCursorPosition({ center: true });
    }
  }

  get element(): HTMLElement | null {
    return this.refs?.root ?? null;
  }

  elementForSymbol(symbol: SymbolEntry): HTMLElement | null {
    let ref = this.symbolEntryToRefTable.get(symbol);
    if (!ref) return null;
    return this.refs?.[ref] ?? null;
  }

  symbolForElement(element: HTMLElement): SymbolEntry | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ref = (element as HTMLElement).dataset.id;
    if (!ref) return null;
    return this.refToSymbolEntryTable.get(ref) ?? null;
  }

  handleEditorEvents() {
    let editor = this.activeEditor;
    let disposables = this.activeEditorDisposables;
    if (!editor || !disposables) return;

    disposables.add(
      editor.onDidStopChanging(() => {
        if (!editor) return;
        this.populateForEditor(editor);
      }),
      editor.onDidChangeCursorPosition(() => {
        let symbol = this.getActiveSymbolForEditor(editor);
        if (!symbol) return;
        this.setSelectedSymbol(symbol);
      })
    );
  }

  switchToEditor(editor: TextEditor) {
    this.activeEditorDisposables?.dispose();
    this.selectedSymbol = null;
    this.selectedRef = null;

    if (!editor) {
      this.activeEditorDisposables = null;
      this.setSymbols([]);
      return;
    } else {
      this.activeEditor = editor;
      this.activeEditorDisposables = new CompositeDisposable();

      let newSymbols: SymbolEntry[] = [];
      if (this.editorSymbolsList.has(editor)) {
        newSymbols = this.editorSymbolsList.get(editor) ?? [];
      } else {
        this.populateForEditor(editor);
      }
      this.setSymbols(newSymbols);
      this.handleEditorEvents();
    }
  }

  populateForEditor(editor: TextEditor) {
    this.getSymbols()
      .then(symbols => {
        if (!symbols || !editor) return;
        this.setSymbols(symbols, editor);
      });
  }

  toggle() {
    atom.workspace.toggle(this);
  }

  async show() {
    await atom.workspace.open(this, {
      searchAllPanes: true,
      activatePane: false,
      activateItem: false
    });

    this.activate();
  }

  activate() {
    let container = atom.workspace.paneContainerForURI(this.getURI());
    if (!isDock(container)) return;
    container.show();
    container.getActivePane().activateItemForURI(this.getURI());
    container.activate();
  }

  hide() {
    atom.workspace.hide(this);
  }

  focus() {
    this.refs?.root.focus();
  }

  unfocus() {
    let center: WorkspaceCenter = atom.workspace.getCenter();
    center.getActivePane().activate();
  }

  setSymbols(symbols: SymbolEntry[], editor?: TextEditor) {
    this.symbols = symbols;
    if (editor && editor !== this.activeEditor) return;
    if (this.activeEditor) {
      this.editorSymbolsList.set(this.activeEditor, symbols);
    }
    return this.update()
      .then(() => {
        let symbol = this.getActiveSymbolForEditor(this.activeEditor);
        if (!symbol) return;
        this.setSelectedSymbol(symbol);
      });
  }

  getActiveSymbolForEditor(editor?: TextEditor | null, flatSymbols?: SymbolEntry[]): SymbolEntry | null {
    editor ??= this.activeEditor;
    if (!editor) return null;

    let cursor = editor.getLastCursor();
    let position = cursor.getBufferPosition();

    let allSymbols = flatSymbols ?? this.getFlatSymbols();
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
      } else if (!candidate) {
        // Even if it's not an exact match, use it if it happens to touch the
        // same row as the cursor.
        candidate = symbol;
      }
    }

    return candidate;
  }

  setSelectedSymbol(newSymbol: SymbolEntry | null) {
    if (this.selectedRef) {
      this.toggleRef(this.selectedRef, false);
    }

    this.selectedSymbol = null;
    this.selectedRef = null;

    if (!newSymbol) return;

    let newElement = this.getClosestVisibleElementForSymbol(newSymbol);
    if (!newElement) {
      console.error(`[pulsar-outline-view] Couldn’t find element for symbol:`, newSymbol);
      return;
    }

    this.selectedSymbol = newSymbol;
    this.selectedRef = newElement;
    this.toggleRef(this.selectedRef, true);
    this.scrollSelectedEntryIntoViewIfNeeded();
  }

  scrollSelectedEntryIntoViewIfNeeded() {
    if (!this.selectedRef || !this.element) return;
    let element = this.selectedRef as (HTMLElement | null);
    if (element?.classList.contains('list-nested-item')) {
      element = element.querySelector('.list-item');
    }
    if (!element) return;

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

  getClosestVisibleElementForSymbol(symbol: SymbolEntry): HTMLElement | null {
    let newElement = this.elementForSymbol(symbol);
    if (!newElement) return null;

    while ((newElement?.offsetHeight ?? 1) === 0) {
      let parentNode = newElement?.parentNode as HTMLElement;
      if (!parentNode) return null;
      newElement = parentNode.closest('li');
    }
    return newElement ?? null;
  }

  revealInOutlineView(editor: TextEditor) {
    let symbol = this.getActiveSymbolForEditor(editor);
    if (!symbol) return;

    let element = this.elementForSymbol(symbol);
    if (!element) return;

    while (element.offsetHeight === 0) {
      let nearestCollapsedNode = element.closest('.collapsed');
      if (!nearestCollapsedNode) break;
      this.collapseEntry(nearestCollapsedNode);
    }

    this.setSelectedSymbol(symbol);
  }

  async getSymbols(): Promise<SymbolEntry[] | null> {
    if (!this.activeEditor) return null;

    let provider = this.broker.chooseProviderForEditor(this.activeEditor);
    if (!provider) return null;

    let outline = await provider.getOutline(this.activeEditor);
    if (!outline) return null;

    return this.consumeOutline(outline);
  }

  consumeOutline(outline: atomIde.Outline): SymbolEntry[] {
    this.outline = outline;
    let symbols: SymbolEntry[] = [];
    function consumeSymbol(symbol: atomIde.OutlineTree) {
      let {
        icon,
        kind,
        plainText,
        tokenizedText,
        representativeName,
        startPosition,
        endPosition,
        children
      } = symbol;

      let range = new Range(
        startPosition,
        endPosition ?? startPosition
      );

      let untokenizedText;
      if (tokenizedText) {
        untokenizedText = interpretTokenizedText(tokenizedText);
      }

      let result: SymbolEntry = {
        icon,
        kind,
        name: untokenizedText ?? plainText ?? representativeName ?? '',
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
    return etch.update(this);
  }

  renderSymbol(symbol: SymbolEntry) {
    if (this.shouldIgnoreSymbol(symbol)) return null;
    let children = null;
    let id = symbolId++;
    this.symbolEntryToRefTable.set(symbol, String(id));
    this.refToSymbolEntryTable.set(String(id), symbol);
    if (symbol.children) {
      children = symbol.children.map(sym => this.renderSymbol(sym));
      children = children.filter(c => c ?? false);
    }
    let childMenu = null;
    if (children && children.length > 0) {
      childMenu = (
        <ul className='outline-list list-tree'>
          {children}
        </ul>
      );
    }

    let nameClasses = ClassNames(
      'name',
      getOctocatIconForOutlineIcon(symbol.icon)
    );

    if (children && children.length > 0) {
      return (
        <li
          className="list-nested-item outline-view-entry"
          dataset={ { id: String(id) } }
          ref={String(id)}
        >
          <div className="outline-view-option list-item" tabIndex={-1}>
            <div className={nameClasses} >
              <div className="name-inner" title={titleForSymbol(symbol)}>{symbol.name}</div>
            </div>
          </div>
          {childMenu}
        </li>
      );
    } else {
      return (
        <li
          className="outline-view-entry outline-view-option list-item"
          tabIndex={-1}
          dataset={ { id: String(id) } }
          ref={String(id)}
        >
          <div className={nameClasses}>
            <div className="name-inner">{symbol.name}</div>
          </div>
        </li>
      );
    }
  }

  render() {
    this.symbolEntryToRefTable.clear();
    this.refToSymbolEntryTable.clear();
    symbolId = 1;
    let symbols = this.symbols ?? [];
    let symbolElements = symbols.map(
      sym => this.renderSymbol(sym)
    );
    let rootClasses = ClassNames(
      'tool-panel',
      'outline-view',
      {
        'with-ellipsis-strategy': this.config.nameOverflowStrategy === 'ellipsis'
      }
    );

    let contents = (
      <ul className='background-message'>
        <li>No Symbols</li>
      </ul>
    );
    if (symbolElements.length > 0) {
      contents = (
        <ul className='outline-list outline-list-root full-menu focusable-panel list-tree has-collapsable-children' ref='list'>
          {symbolElements}
        </ul>
      );
    }

    return (
      <div className={rootClasses} tabIndex={-1} ref='root'>
        {contents}
      </div>
    );
  }

  private toggleRef(ref: Element, add: boolean) {
    if (!ref) return;
    let item: Element | null = ref;
    if (!item) return;
    if (add) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  }

  private shouldIgnoreSymbol(symbol: SymbolEntry): boolean {
    let { ignoredSymbolTypes } = this.config;
    if (symbol.kind && ignoredSymbolTypes.includes(symbol.kind)) return true;
    if (symbol.icon && ignoredSymbolTypes.includes(symbol.icon)) return true;
    return false;
  }

  private getFlatSymbols(): SymbolEntry[] {
    if (!this.symbols) return [];
    let results: SymbolEntry[] = [];
    let processSymbols = (item: SymbolEntry) => {
      if (this.shouldIgnoreSymbol(item)) return;
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

  private isClickOnCaret(event: MouseEvent) {
    let element = event.target as HTMLElement;
    if (element?.webkitMatchesSelector('.name')) return false;

    // The caret comes from generated content in a `::before` CSS rule. We
    // can't detect whether it was clicked on, but we can measure the amount of
    // space allocated to the caret on the left side, and then ascertain that
    // the mouse was in that zone.
    let elRect = element.getBoundingClientRect();
    let nameRect = element.querySelector('.name')?.getBoundingClientRect();
    if (!nameRect) return false;

    let distance = nameRect.left - elRect.left;
    return event.offsetX < distance;
  }

  private getVisibleListItems() {
    if (!this.element) return [];
    let choices = this.element.querySelectorAll('li.list-item, li.list-nested-item');
    if (!choices || choices.length === 0) return [];
    return Array.from(choices).filter(choice => {
      if (!('offsetHeight' in choice)) return false;
      return (choice as HTMLElement).offsetHeight > 0;
    });
  }
}

export default OutlineView;
