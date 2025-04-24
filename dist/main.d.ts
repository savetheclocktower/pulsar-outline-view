import { CompositeDisposable } from 'atom';
import OutlineView from './outline-view';
import ProviderBroker from './provider-broker';
import type * as atomIde from 'atom-ide-base';
import type * as symbol from './symbols-view';
declare class PulsarOutlineView {
    protected subscriptions?: CompositeDisposable | null;
    protected broker: ProviderBroker;
    protected outlineView: OutlineView | null;
    constructor();
    activate(): void;
    deactivate(): void;
    consumeOutlineProvider(...providers: atomIde.OutlineProvider[]): void;
    consumeSymbolProvider(...providers: symbol.SymbolProvider[]): void;
    getOutlineView(): OutlineView;
}
declare const _default: PulsarOutlineView;
export default _default;
