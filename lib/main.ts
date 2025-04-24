
import { CompositeDisposable } from 'atom';
import OutlineView from './outline-view';
import ProviderBroker from './provider-broker';
import type * as atomIde from 'atom-ide-base';
import type * as symbol from 'symbols-view';

class PulsarOutlineView {
  protected subscriptions?: CompositeDisposable | null;
  protected broker: ProviderBroker;
  protected outlineView: OutlineView | null;

  constructor() {
    this.broker = new ProviderBroker();
    this.outlineView = null;
  }

  activate() {
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.commands.add('atom-workspace', {
        'pulsar-outline-view:show': () => {
          this.getOutlineView().show();
        },
        'pulsar-outline-view:toggle': () => {
          this.getOutlineView().toggle();
        }
      }),

      atom.commands.add('atom-text-editor', {
        'pulsar-outline-view:reveal-in-outline-view': () => {
          let editor = atom.workspace.getActiveTextEditor();
          if (!editor) return;
          this.getOutlineView().revealInOutlineView(editor);
        }
      })
    );
  }

  deactivate() {
    this.subscriptions?.dispose();
  }

  consumeOutlineProvider(...providers: atomIde.OutlineProvider[]) {
    this.broker.addProviders(...providers);
  }

  consumeSymbolProvider(...providers: symbol.SymbolProvider[]) {
    this.broker.addSymbolProviders(...providers);
  }

  getOutlineView(): OutlineView {
    if (this.outlineView === null) {
      this.outlineView = new OutlineView(this.broker);
      this.outlineView.onDidDestroy(() => { this.outlineView = null; });
    }
    return this.outlineView;
  }
}

export default new PulsarOutlineView();
