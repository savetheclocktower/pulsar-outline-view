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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQ0EsK0JBQTJDO0FBQzNDLGtFQUF5QztBQUN6Qyx3RUFBK0M7QUFJL0MsTUFBTSxpQkFBaUI7SUFLckI7UUFDRSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUkseUJBQWMsRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0lBQzFCLENBQUM7SUFFRCxRQUFRO1FBQ04sSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUM7UUFFL0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQ3BCLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFO1lBQ2xDLDBCQUEwQixFQUFFLEdBQUcsRUFBRTtnQkFDL0IsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQy9CLENBQUM7U0FDRixDQUFDLEVBRUYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUU7WUFDcEMsNENBQTRDLEVBQUUsR0FBRyxFQUFFO2dCQUNqRCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLG1CQUFtQixFQUFFLENBQUM7Z0JBQ2xELElBQUksQ0FBQyxNQUFNO29CQUFFLE9BQU87Z0JBQ3BCLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNwRCxDQUFDO1NBQ0YsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0lBRUQsVUFBVTs7UUFDUixNQUFBLElBQUksQ0FBQyxhQUFhLDBDQUFFLE9BQU8sRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxzQkFBc0IsQ0FBQyxHQUFHLFNBQW9DO1FBQzVELElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVELHFCQUFxQixDQUFDLEdBQUcsU0FBa0M7UUFDekQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRCxjQUFjO1FBQ1osSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLElBQUksRUFBRTtZQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksc0JBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDaEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNuRTtRQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUMxQixDQUFDO0NBQ0Y7QUFFRCxrQkFBZSxJQUFJLGlCQUFpQixFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJcbmltcG9ydCB7IENvbXBvc2l0ZURpc3Bvc2FibGUgfSBmcm9tICdhdG9tJztcbmltcG9ydCBPdXRsaW5lVmlldyBmcm9tICcuL291dGxpbmUtdmlldyc7XG5pbXBvcnQgUHJvdmlkZXJCcm9rZXIgZnJvbSAnLi9wcm92aWRlci1icm9rZXInO1xuaW1wb3J0IHR5cGUgKiBhcyBhdG9tSWRlIGZyb20gJ2F0b20taWRlLWJhc2UnO1xuaW1wb3J0IHR5cGUgKiBhcyBzeW1ib2wgZnJvbSAnc3ltYm9scy12aWV3LXJlZHV4JztcblxuY2xhc3MgUHVsc2FyT3V0bGluZVZpZXcge1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9ucz86IENvbXBvc2l0ZURpc3Bvc2FibGUgfCBudWxsO1xuICBwcm90ZWN0ZWQgYnJva2VyOiBQcm92aWRlckJyb2tlcjtcbiAgcHJvdGVjdGVkIG91dGxpbmVWaWV3OiBPdXRsaW5lVmlldyB8IG51bGw7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5icm9rZXIgPSBuZXcgUHJvdmlkZXJCcm9rZXIoKTtcbiAgICB0aGlzLm91dGxpbmVWaWV3ID0gbnVsbDtcbiAgfVxuXG4gIGFjdGl2YXRlKCkge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9ucyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKCk7XG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKFxuICAgICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20td29ya3NwYWNlJywge1xuICAgICAgICAncHVsc2FyLW91dGxpbmUtdmlldzpzaG93JzogKCkgPT4ge1xuICAgICAgICAgIHRoaXMuZ2V0T3V0bGluZVZpZXcoKS5zaG93KCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuXG4gICAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvcicsIHtcbiAgICAgICAgJ3B1bHNhci1vdXRsaW5lLXZpZXc6cmV2ZWFsLWluLW91dGxpbmUtdmlldyc6ICgpID0+IHtcbiAgICAgICAgICBsZXQgZWRpdG9yID0gYXRvbS53b3Jrc3BhY2UuZ2V0QWN0aXZlVGV4dEVkaXRvcigpO1xuICAgICAgICAgIGlmICghZWRpdG9yKSByZXR1cm47XG4gICAgICAgICAgdGhpcy5nZXRPdXRsaW5lVmlldygpLnJldmVhbEluT3V0bGluZVZpZXcoZWRpdG9yKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICApO1xuICB9XG5cbiAgZGVhY3RpdmF0ZSgpIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnM/LmRpc3Bvc2UoKTtcbiAgfVxuXG4gIGNvbnN1bWVPdXRsaW5lUHJvdmlkZXIoLi4ucHJvdmlkZXJzOiBhdG9tSWRlLk91dGxpbmVQcm92aWRlcltdKSB7XG4gICAgdGhpcy5icm9rZXIuYWRkUHJvdmlkZXJzKC4uLnByb3ZpZGVycyk7XG4gIH1cblxuICBjb25zdW1lU3ltYm9sUHJvdmlkZXIoLi4ucHJvdmlkZXJzOiBzeW1ib2wuU3ltYm9sUHJvdmlkZXJbXSkge1xuICAgIHRoaXMuYnJva2VyLmFkZFN5bWJvbFByb3ZpZGVycyguLi5wcm92aWRlcnMpO1xuICB9XG5cbiAgZ2V0T3V0bGluZVZpZXcoKTogT3V0bGluZVZpZXcge1xuICAgIGlmICh0aGlzLm91dGxpbmVWaWV3ID09PSBudWxsKSB7XG4gICAgICB0aGlzLm91dGxpbmVWaWV3ID0gbmV3IE91dGxpbmVWaWV3KHRoaXMuYnJva2VyKTtcbiAgICAgIHRoaXMub3V0bGluZVZpZXcub25EaWREZXN0cm95KCgpID0+IHsgdGhpcy5vdXRsaW5lVmlldyA9IG51bGw7IH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5vdXRsaW5lVmlldztcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgUHVsc2FyT3V0bGluZVZpZXcoKTtcbiJdfQ==