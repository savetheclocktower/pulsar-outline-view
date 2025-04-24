"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const atom_1 = require("atom");
const outline_view_1 = __importDefault(require("./outline-view"));
const provider_broker_1 = __importDefault(require("./provider-broker"));
class PulsarOutlineView {
    constructor() {
        this.broker = new provider_broker_1.default();
        this.outlineView = null;
    }
    activate() {
        this.subscriptions = new atom_1.CompositeDisposable();
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'pulsar-outline-view:show': () => {
                this.getOutlineView().show();
            },
            'pulsar-outline-view:toggle': () => {
                this.getOutlineView().toggle();
            }
        }), atom.commands.add('atom-text-editor', {
            'pulsar-outline-view:reveal-in-outline-view': () => {
                let editor = atom.workspace.getActiveTextEditor();
                if (!editor)
                    return;
                this.getOutlineView().revealInOutlineView(editor);
            }
        }));
    }
    deactivate() {
        var _a;
        (_a = this.subscriptions) === null || _a === void 0 ? void 0 : _a.dispose();
    }
    consumeOutlineProvider(...providers) {
        this.broker.addProviders(...providers);
    }
    consumeSymbolProvider(...providers) {
        this.broker.addSymbolProviders(...providers);
    }
    getOutlineView() {
        if (this.outlineView === null) {
            this.outlineView = new outline_view_1.default(this.broker);
            this.outlineView.onDidDestroy(() => { this.outlineView = null; });
        }
        return this.outlineView;
    }
}
exports.default = new PulsarOutlineView();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsK0JBQTJDO0FBQzNDLGtFQUF5QztBQUN6Qyx3RUFBK0M7QUFJL0MsTUFBTSxpQkFBaUI7SUFLckI7UUFDRSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUkseUJBQWMsRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0lBQzFCLENBQUM7SUFFRCxRQUFRO1FBQ04sSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUM7UUFFL0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQ3BCLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFO1lBQ2xDLDBCQUEwQixFQUFFLEdBQUcsRUFBRTtnQkFDL0IsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQy9CLENBQUM7WUFDRCw0QkFBNEIsRUFBRSxHQUFHLEVBQUU7Z0JBQ2pDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQyxDQUFDO1NBQ0YsQ0FBQyxFQUVGLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFO1lBQ3BDLDRDQUE0QyxFQUFFLEdBQUcsRUFBRTtnQkFDakQsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO2dCQUNsRCxJQUFJLENBQUMsTUFBTTtvQkFBRSxPQUFPO2dCQUNwQixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDcEQsQ0FBQztTQUNGLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztJQUVELFVBQVU7O1FBQ1IsTUFBQSxJQUFJLENBQUMsYUFBYSwwQ0FBRSxPQUFPLEVBQUUsQ0FBQztJQUNoQyxDQUFDO0lBRUQsc0JBQXNCLENBQUMsR0FBRyxTQUFvQztRQUM1RCxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxHQUFHLFNBQWtDO1FBQ3pELElBQUksQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsY0FBYztRQUNaLElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksc0JBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDaEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRSxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7Q0FDRjtBQUVELGtCQUFlLElBQUksaUJBQWlCLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvc2l0ZURpc3Bvc2FibGUgfSBmcm9tICdhdG9tJztcbmltcG9ydCBPdXRsaW5lVmlldyBmcm9tICcuL291dGxpbmUtdmlldyc7XG5pbXBvcnQgUHJvdmlkZXJCcm9rZXIgZnJvbSAnLi9wcm92aWRlci1icm9rZXInO1xuaW1wb3J0IHR5cGUgKiBhcyBhdG9tSWRlIGZyb20gJ2F0b20taWRlLWJhc2UnO1xuaW1wb3J0IHR5cGUgKiBhcyBzeW1ib2wgZnJvbSAnLi9zeW1ib2xzLXZpZXcnO1xuXG5jbGFzcyBQdWxzYXJPdXRsaW5lVmlldyB7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25zPzogQ29tcG9zaXRlRGlzcG9zYWJsZSB8IG51bGw7XG4gIHByb3RlY3RlZCBicm9rZXI6IFByb3ZpZGVyQnJva2VyO1xuICBwcm90ZWN0ZWQgb3V0bGluZVZpZXc6IE91dGxpbmVWaWV3IHwgbnVsbDtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmJyb2tlciA9IG5ldyBQcm92aWRlckJyb2tlcigpO1xuICAgIHRoaXMub3V0bGluZVZpZXcgPSBudWxsO1xuICB9XG5cbiAgYWN0aXZhdGUoKSB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25zID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKTtcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoXG4gICAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS13b3Jrc3BhY2UnLCB7XG4gICAgICAgICdwdWxzYXItb3V0bGluZS12aWV3OnNob3cnOiAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5nZXRPdXRsaW5lVmlldygpLnNob3coKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ3B1bHNhci1vdXRsaW5lLXZpZXc6dG9nZ2xlJzogKCkgPT4ge1xuICAgICAgICAgIHRoaXMuZ2V0T3V0bGluZVZpZXcoKS50b2dnbGUoKTtcbiAgICAgICAgfVxuICAgICAgfSksXG5cbiAgICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yJywge1xuICAgICAgICAncHVsc2FyLW91dGxpbmUtdmlldzpyZXZlYWwtaW4tb3V0bGluZS12aWV3JzogKCkgPT4ge1xuICAgICAgICAgIGxldCBlZGl0b3IgPSBhdG9tLndvcmtzcGFjZS5nZXRBY3RpdmVUZXh0RWRpdG9yKCk7XG4gICAgICAgICAgaWYgKCFlZGl0b3IpIHJldHVybjtcbiAgICAgICAgICB0aGlzLmdldE91dGxpbmVWaWV3KCkucmV2ZWFsSW5PdXRsaW5lVmlldyhlZGl0b3IpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICBkZWFjdGl2YXRlKCkge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9ucz8uZGlzcG9zZSgpO1xuICB9XG5cbiAgY29uc3VtZU91dGxpbmVQcm92aWRlciguLi5wcm92aWRlcnM6IGF0b21JZGUuT3V0bGluZVByb3ZpZGVyW10pIHtcbiAgICB0aGlzLmJyb2tlci5hZGRQcm92aWRlcnMoLi4ucHJvdmlkZXJzKTtcbiAgfVxuXG4gIGNvbnN1bWVTeW1ib2xQcm92aWRlciguLi5wcm92aWRlcnM6IHN5bWJvbC5TeW1ib2xQcm92aWRlcltdKSB7XG4gICAgdGhpcy5icm9rZXIuYWRkU3ltYm9sUHJvdmlkZXJzKC4uLnByb3ZpZGVycyk7XG4gIH1cblxuICBnZXRPdXRsaW5lVmlldygpOiBPdXRsaW5lVmlldyB7XG4gICAgaWYgKHRoaXMub3V0bGluZVZpZXcgPT09IG51bGwpIHtcbiAgICAgIHRoaXMub3V0bGluZVZpZXcgPSBuZXcgT3V0bGluZVZpZXcodGhpcy5icm9rZXIpO1xuICAgICAgdGhpcy5vdXRsaW5lVmlldy5vbkRpZERlc3Ryb3koKCkgPT4geyB0aGlzLm91dGxpbmVWaWV3ID0gbnVsbDsgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm91dGxpbmVWaWV3O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBQdWxzYXJPdXRsaW5lVmlldygpO1xuIl19