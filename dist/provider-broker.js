"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const symbol_provider_wrapper_1 = __importDefault(require("./symbol-provider-wrapper"));
class ProviderBroker {
    constructor() {
        this.providers = [];
        this.symbolProviderWrapper = new symbol_provider_wrapper_1.default();
    }
    addProviders(...providers) {
        this.providers.push(...providers);
    }
    removeProviders(...providers) {
        for (let provider of providers) {
            this.removeProviders(provider);
        }
    }
    addSymbolProviders(...providers) {
        console.debug('[pulsar-outline-view] Adding symbol providers:', providers);
        this.symbolProviderWrapper.addSymbolProvider(...providers);
        if (!this.providers.includes(this.symbolProviderWrapper)) {
            this.addProviders(this.symbolProviderWrapper);
        }
    }
    removeSymbolProviders(...providers) {
        this.symbolProviderWrapper.removeSymbolProvider(...providers);
        if (this.symbolProviderWrapper.providers.length === 0) {
            this.removeProvider(this.symbolProviderWrapper);
        }
    }
    removeProvider(provider) {
        let index = this.providers.indexOf(provider);
        if (index > -1) {
            this.providers.splice(index, 1);
        }
    }
    chooseProviderForEditor(editor) {
        var _a;
        console.debug('[pulsar-outline-view] Choosing provider for editor:', editor);
        let baseScope = (_a = editor.getGrammar()) === null || _a === void 0 ? void 0 : _a.scopeName;
        if (!baseScope)
            return null;
        let winner = null;
        for (let provider of this.providers) {
            if (!provider.grammarScopes.includes(baseScope) &&
                !provider.grammarScopes.includes('*'))
                continue;
            if (!winner || winner.priority < provider.priority) {
                winner = provider;
            }
        }
        console.debug('[pulsar-outline-view] Winner is:', winner);
        return winner;
    }
}
exports.default = ProviderBroker;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZXItYnJva2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vbGliL3Byb3ZpZGVyLWJyb2tlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUNBLHdGQUE4RDtBQUk5RCxNQUFNLGNBQWM7SUFHbEI7UUFDRSxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNwQixJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSSxpQ0FBcUIsRUFBRSxDQUFDO0lBQzNELENBQUM7SUFFRCxZQUFZLENBQUMsR0FBRyxTQUFvQztRQUNsRCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxlQUFlLENBQUMsR0FBRyxTQUFvQztRQUNyRCxLQUFLLElBQUksUUFBUSxJQUFJLFNBQVMsRUFBRTtZQUM5QixJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ2hDO0lBQ0gsQ0FBQztJQUVELGtCQUFrQixDQUFDLEdBQUcsU0FBa0M7UUFDdEQsT0FBTyxDQUFDLEtBQUssQ0FBQyxnREFBZ0QsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMzRSxJQUFJLENBQUMscUJBQXFCLENBQUMsaUJBQWlCLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEVBQUU7WUFDeEQsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztTQUMvQztJQUNILENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxHQUFHLFNBQWtDO1FBQ3pELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO1FBQzlELElBQUksSUFBSSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ3JELElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7U0FDakQ7SUFDSCxDQUFDO0lBRUQsY0FBYyxDQUFDLFFBQWlDO1FBQzlDLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzdDLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFO1lBQ2QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ2pDO0lBQ0gsQ0FBQztJQUVELHVCQUF1QixDQUFDLE1BQWtCOztRQUN4QyxPQUFPLENBQUMsS0FBSyxDQUFDLHFEQUFxRCxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzdFLElBQUksU0FBUyxHQUFHLE1BQUEsTUFBTSxDQUFDLFVBQVUsRUFBRSwwQ0FBRSxTQUFTLENBQUM7UUFDL0MsSUFBSSxDQUFDLFNBQVM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUU1QixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDbEIsS0FBSyxJQUFJLFFBQVEsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ25DLElBQ0UsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQzNDLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDO2dCQUNyQyxTQUFTO1lBQ1gsSUFBSSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxRQUFRLEVBQUU7Z0JBQ2xELE1BQU0sR0FBRyxRQUFRLENBQUM7YUFDbkI7U0FDRjtRQUNELE9BQU8sQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDMUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGO0FBRUQsa0JBQWUsY0FBYyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVGV4dEVkaXRvciB9IGZyb20gJ2F0b20nO1xuaW1wb3J0IFN5bWJvbFByb3ZpZGVyV3JhcHBlciBmcm9tICcuL3N5bWJvbC1wcm92aWRlci13cmFwcGVyJztcbmltcG9ydCB0eXBlICogYXMgYXRvbUlkZSBmcm9tICdhdG9tLWlkZS1iYXNlJztcbmltcG9ydCB0eXBlICogYXMgc3ltYm9sIGZyb20gJ3N5bWJvbHMtdmlldy1yZWR1eCc7XG5cbmNsYXNzIFByb3ZpZGVyQnJva2VyIHtcbiAgcHJvdGVjdGVkIHByb3ZpZGVyczogYXRvbUlkZS5PdXRsaW5lUHJvdmlkZXJbXTtcbiAgcHJvdGVjdGVkIHN5bWJvbFByb3ZpZGVyV3JhcHBlcjogU3ltYm9sUHJvdmlkZXJXcmFwcGVyO1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnByb3ZpZGVycyA9IFtdO1xuICAgIHRoaXMuc3ltYm9sUHJvdmlkZXJXcmFwcGVyID0gbmV3IFN5bWJvbFByb3ZpZGVyV3JhcHBlcigpO1xuICB9XG5cbiAgYWRkUHJvdmlkZXJzKC4uLnByb3ZpZGVyczogYXRvbUlkZS5PdXRsaW5lUHJvdmlkZXJbXSkge1xuICAgIHRoaXMucHJvdmlkZXJzLnB1c2goLi4ucHJvdmlkZXJzKTtcbiAgfVxuXG4gIHJlbW92ZVByb3ZpZGVycyguLi5wcm92aWRlcnM6IGF0b21JZGUuT3V0bGluZVByb3ZpZGVyW10pIHtcbiAgICBmb3IgKGxldCBwcm92aWRlciBvZiBwcm92aWRlcnMpIHtcbiAgICAgIHRoaXMucmVtb3ZlUHJvdmlkZXJzKHByb3ZpZGVyKTtcbiAgICB9XG4gIH1cblxuICBhZGRTeW1ib2xQcm92aWRlcnMoLi4ucHJvdmlkZXJzOiBzeW1ib2wuU3ltYm9sUHJvdmlkZXJbXSkge1xuICAgIGNvbnNvbGUuZGVidWcoJ1twdWxzYXItb3V0bGluZS12aWV3XSBBZGRpbmcgc3ltYm9sIHByb3ZpZGVyczonLCBwcm92aWRlcnMpO1xuICAgIHRoaXMuc3ltYm9sUHJvdmlkZXJXcmFwcGVyLmFkZFN5bWJvbFByb3ZpZGVyKC4uLnByb3ZpZGVycyk7XG4gICAgaWYgKCF0aGlzLnByb3ZpZGVycy5pbmNsdWRlcyh0aGlzLnN5bWJvbFByb3ZpZGVyV3JhcHBlcikpIHtcbiAgICAgIHRoaXMuYWRkUHJvdmlkZXJzKHRoaXMuc3ltYm9sUHJvdmlkZXJXcmFwcGVyKTtcbiAgICB9XG4gIH1cblxuICByZW1vdmVTeW1ib2xQcm92aWRlcnMoLi4ucHJvdmlkZXJzOiBzeW1ib2wuU3ltYm9sUHJvdmlkZXJbXSkge1xuICAgIHRoaXMuc3ltYm9sUHJvdmlkZXJXcmFwcGVyLnJlbW92ZVN5bWJvbFByb3ZpZGVyKC4uLnByb3ZpZGVycyk7XG4gICAgaWYgKHRoaXMuc3ltYm9sUHJvdmlkZXJXcmFwcGVyLnByb3ZpZGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMucmVtb3ZlUHJvdmlkZXIodGhpcy5zeW1ib2xQcm92aWRlcldyYXBwZXIpO1xuICAgIH1cbiAgfVxuXG4gIHJlbW92ZVByb3ZpZGVyKHByb3ZpZGVyOiBhdG9tSWRlLk91dGxpbmVQcm92aWRlcikge1xuICAgIGxldCBpbmRleCA9IHRoaXMucHJvdmlkZXJzLmluZGV4T2YocHJvdmlkZXIpO1xuICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICB0aGlzLnByb3ZpZGVycy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbiAgfVxuXG4gIGNob29zZVByb3ZpZGVyRm9yRWRpdG9yKGVkaXRvcjogVGV4dEVkaXRvcik6IGF0b21JZGUuT3V0bGluZVByb3ZpZGVyIHwgbnVsbCB7XG4gICAgY29uc29sZS5kZWJ1ZygnW3B1bHNhci1vdXRsaW5lLXZpZXddIENob29zaW5nIHByb3ZpZGVyIGZvciBlZGl0b3I6JywgZWRpdG9yKTtcbiAgICBsZXQgYmFzZVNjb3BlID0gZWRpdG9yLmdldEdyYW1tYXIoKT8uc2NvcGVOYW1lO1xuICAgIGlmICghYmFzZVNjb3BlKSByZXR1cm4gbnVsbDtcblxuICAgIGxldCB3aW5uZXIgPSBudWxsO1xuICAgIGZvciAobGV0IHByb3ZpZGVyIG9mIHRoaXMucHJvdmlkZXJzKSB7XG4gICAgICBpZiAoXG4gICAgICAgICFwcm92aWRlci5ncmFtbWFyU2NvcGVzLmluY2x1ZGVzKGJhc2VTY29wZSkgJiZcbiAgICAgICAgIXByb3ZpZGVyLmdyYW1tYXJTY29wZXMuaW5jbHVkZXMoJyonKVxuICAgICAgKSBjb250aW51ZTtcbiAgICAgIGlmICghd2lubmVyIHx8IHdpbm5lci5wcmlvcml0eSA8IHByb3ZpZGVyLnByaW9yaXR5KSB7XG4gICAgICAgIHdpbm5lciA9IHByb3ZpZGVyO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zb2xlLmRlYnVnKCdbcHVsc2FyLW91dGxpbmUtdmlld10gV2lubmVyIGlzOicsIHdpbm5lcik7XG4gICAgcmV0dXJuIHdpbm5lcjtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm92aWRlckJyb2tlcjtcbiJdfQ==