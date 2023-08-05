"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const atom_1 = require("atom");
const util_1 = require("./util");
const LSP_KINDS = new Set([
    "file",
    "module",
    "namespace",
    "package",
    "class",
    "method",
    "property",
    "field",
    "constructor",
    "enum",
    "interface",
    "function",
    "variable",
    "constant",
    "string",
    "number",
    "boolean",
    "array"
]);
/**
 * Consumes the `symbol.provider` service and adapts its providers into an
 * outline provider. Designed to be chosen only when a more suitable outline
 * provider is not available.
 */
class SymbolProviderWrapper {
    constructor() {
        this.name = 'Symbol Provider';
        this.priority = 0.8;
        this.grammarScopes = ['*'];
        this.providers = [];
    }
    addSymbolProvider(...providers) {
        for (let provider of providers) {
            if (this.providers.includes(provider))
                continue;
            this.providers.push(provider);
        }
    }
    removeSymbolProvider(...providers) {
        let indexesToRemove = [];
        for (let [index, provider] of this.providers.entries()) {
            if (providers.includes(provider)) {
                // Insert the indexes in backwards order. Later we'll iterate
                // back-to-front so that indexes don't shift as we remove entries.
                indexesToRemove.unshift(index);
            }
        }
        for (let index of indexesToRemove) {
            this.providers.splice(index, 1);
        }
    }
    getScoreBoost(name, packageName, preferredProviders) {
        if (packageName === 'unknown')
            return 0;
        let index = preferredProviders.indexOf(packageName);
        if (index === -1) {
            index = preferredProviders.indexOf(name);
        }
        if (index === -1)
            return 0;
        let scoreBoost = preferredProviders.length - index;
        return scoreBoost;
    }
    /**
     * If the `symbols-view-redux` package is installed, this package will the
     * user's configured ranking of various providers.
     */
    getSelectedProviders(meta) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            let exclusivesByScore = [];
            let selectedProviders = [];
            let preferredProviders = atom.config.get('symbols-view-redux.preferCertainProviders');
            let answers = this.providers.map(provider => {
                // TODO: This method can reluctantly go async because language clients
                // might have to ask their servers about capabilities. We must introduce
                // a timeout value here so that we don't wait indefinitely for providers
                // to respond.
                console.debug(`[pulsar-outline-view] Asking provider:`, provider.name, provider);
                return provider.canProvideSymbols(meta);
            });
            let outcomes = yield Promise.allSettled(answers);
            for (let [index, provider] of this.providers.entries()) {
                let outcome = outcomes[index];
                if (outcome.status === 'rejected')
                    continue;
                let { value: score } = outcome;
                let name = (_a = provider.name) !== null && _a !== void 0 ? _a : 'unknown';
                let packageName = (_b = provider === null || provider === void 0 ? void 0 : provider.packageName) !== null && _b !== void 0 ? _b : 'unknown';
                let isExclusive = (_c = provider === null || provider === void 0 ? void 0 : provider.isExclusive) !== null && _c !== void 0 ? _c : false;
                if (!score)
                    continue;
                if (score === true)
                    score = 1;
                score += this.getScoreBoost(name, packageName, preferredProviders);
                if (isExclusive) {
                    // “Exclusive” providers get put aside until the end. We'll pick the
                    // _one_ that has the highest score.
                    exclusivesByScore.push({ provider, score });
                }
                else {
                    // Non-exclusive providers go into the pile because we know we'll be
                    // using them all.
                    selectedProviders.push(provider);
                }
            }
            if (exclusivesByScore.length > 0) {
                exclusivesByScore.sort((a, b) => b.score - a.score);
                let exclusive = exclusivesByScore[0].provider;
                selectedProviders.unshift(exclusive);
            }
            return selectedProviders;
        });
    }
    getOutline(editor) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            (_a = this._abortController) === null || _a === void 0 ? void 0 : _a.abort();
            this._abortController = new AbortController();
            let meta = {
                type: 'file',
                editor,
                signal: this._abortController.signal
            };
            let selectedProviders = yield this.getSelectedProviders(meta);
            if (selectedProviders.length === 0)
                return null;
            let rawSymbols = [];
            let symbolPromises = selectedProviders.map(provider => {
                let response = provider.getSymbols(meta);
                let result = response instanceof Promise ? response : Promise.resolve(response);
                return result.then((symbols) => {
                    rawSymbols.push(...symbols);
                });
            });
            yield Promise.allSettled(symbolPromises);
            let results = [];
            let index = new util_1.Index();
            for (let symbol of rawSymbols) {
                let name = (_b = symbol.shortName) !== null && _b !== void 0 ? _b : symbol.name;
                let range;
                if ('range' in symbol) {
                    range = symbol.range;
                }
                else if ('position' in symbol) {
                    range = new atom_1.Range(symbol.position, symbol.position);
                }
                else {
                    throw new Error(`Malformed symbol!`);
                }
                let tree = {
                    icon: symbol.tag ? `type-${symbol.tag}` : undefined,
                    kind: (LSP_KINDS.has((_c = symbol.tag) !== null && _c !== void 0 ? _c : '') ? symbol.tag : undefined),
                    plainText: name,
                    representativeName: name,
                    startPosition: range.start,
                    endPosition: range.end,
                    children: []
                };
                if (symbol.context) {
                    let entries = index.get(symbol.context);
                    let last = entries[entries.length - 1];
                    if (last) {
                        entries[0].children.push(tree);
                    }
                }
                else {
                    results.push(tree);
                }
                index.add(name, tree);
            }
            return { outlineTrees: results };
        });
    }
}
exports.default = SymbolProviderWrapper;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ltYm9sLXByb3ZpZGVyLXdyYXBwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9saWIvc3ltYm9sLXByb3ZpZGVyLXdyYXBwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQSwrQkFBeUM7QUFDekMsaUNBQStCO0FBSS9CLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3hCLE1BQU07SUFDTixRQUFRO0lBQ1IsV0FBVztJQUNYLFNBQVM7SUFDVCxPQUFPO0lBQ1AsUUFBUTtJQUNSLFVBQVU7SUFDVixPQUFPO0lBQ1AsYUFBYTtJQUNiLE1BQU07SUFDTixXQUFXO0lBQ1gsVUFBVTtJQUNWLFVBQVU7SUFDVixVQUFVO0lBQ1YsUUFBUTtJQUNSLFFBQVE7SUFDUixTQUFTO0lBQ1QsT0FBTztDQUNSLENBQUMsQ0FBQztBQUdIOzs7O0dBSUc7QUFDSCxNQUFNLHFCQUFxQjtJQVF6QjtRQUNFLElBQUksQ0FBQyxJQUFJLEdBQUcsaUJBQWlCLENBQUM7UUFDOUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUM7UUFDcEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxHQUFHLFNBQStCO1FBQ2xELEtBQUssSUFBSSxRQUFRLElBQUksU0FBUyxFQUFFO1lBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO2dCQUFFLFNBQVM7WUFDaEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDL0I7SUFDSCxDQUFDO0lBRUQsb0JBQW9CLENBQUMsR0FBRyxTQUErQjtRQUNyRCxJQUFJLGVBQWUsR0FBRyxFQUFFLENBQUM7UUFDekIsS0FBSyxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxJ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O29CQUNuRCxJQUFJLEVBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQUEsTUFBTSxDQUFDLEdBQUcsbUNBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBNEI7b0JBQzNGLFNBQVMsRUFBRSxJQUFJO29CQUNmLGtCQUFrQixFQUFFLElBQUk7b0JBQ3hCLGFBQWEsRUFBRSxLQUFLLENBQUMsS0FBSztvQkFDMUIsV0FBVyxFQUFFLEtBQUssQ0FBQyxHQUFHO29CQUN0QixRQUFRLEVBQUUsRUFBRTtpQkFDYixDQUFDO2dCQUNGLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRTtvQkFDbEIsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ3hDLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUN2QyxJQUFJLElBQUksRUFBRTt3QkFDUixPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDaEM7aUJBQ0Y7cUJBQU07b0JBQ0wsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDcEI7Z0JBQ0QsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDdkI7WUFFRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE9BQU8sRUFBRSxDQUFDOztLQUNsQztDQUNGO0FBRUQsa0JBQWUscUJBQXFCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSYW5nZSwgVGV4dEVkaXRvciB9IGZyb20gJ2F0b20nO1xuaW1wb3J0IHsgSW5kZXggfSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHR5cGUgKiBhcyBhdG9tSWRlIGZyb20gJ2F0b20taWRlLWJhc2UnO1xuaW1wb3J0IHR5cGUgKiBhcyBzeW0gZnJvbSAnc3ltYm9scy12aWV3LXJlZHV4JztcblxuY29uc3QgTFNQX0tJTkRTID0gbmV3IFNldChbXG4gIFwiZmlsZVwiLFxuICBcIm1vZHVsZVwiLFxuICBcIm5hbWVzcGFjZVwiLFxuICBcInBhY2thZ2VcIixcbiAgXCJjbGFzc1wiLFxuICBcIm1ldGhvZFwiLFxuICBcInByb3BlcnR5XCIsXG4gIFwiZmllbGRcIixcbiAgXCJjb25zdHJ1Y3RvclwiLFxuICBcImVudW1cIixcbiAgXCJpbnRlcmZhY2VcIixcbiAgXCJmdW5jdGlvblwiLFxuICBcInZhcmlhYmxlXCIsXG4gIFwiY29uc3RhbnRcIixcbiAgXCJzdHJpbmdcIixcbiAgXCJudW1iZXJcIixcbiAgXCJib29sZWFuXCIsXG4gIFwiYXJyYXlcIlxuXSk7XG5cblxuLyoqXG4gKiBDb25zdW1lcyB0aGUgYHN5bWJvbC5wcm92aWRlcmAgc2VydmljZSBhbmQgYWRhcHRzIGl0cyBwcm92aWRlcnMgaW50byBhblxuICogb3V0bGluZSBwcm92aWRlci4gRGVzaWduZWQgdG8gYmUgY2hvc2VuIG9ubHkgd2hlbiBhIG1vcmUgc3VpdGFibGUgb3V0bGluZVxuICogcHJvdmlkZXIgaXMgbm90IGF2YWlsYWJsZS5cbiAqL1xuY2xhc3MgU3ltYm9sUHJvdmlkZXJXcmFwcGVyIGltcGxlbWVudHMgYXRvbUlkZS5PdXRsaW5lUHJvdmlkZXIge1xuICBuYW1lOiBzdHJpbmc7XG4gIHByaW9yaXR5OiBudW1iZXI7XG4gIGdyYW1tYXJTY29wZXM6IHN0cmluZ1tdO1xuICBwdWJsaWMgcHJvdmlkZXJzOiBzeW0uU3ltYm9sUHJvdmlkZXJbXTtcblxuICBfYWJvcnRDb250cm9sbGVyPzogQWJvcnRDb250cm9sbGVyO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubmFtZSA9ICdTeW1ib2wgUHJvdmlkZXInO1xuICAgIHRoaXMucHJpb3JpdHkgPSAwLjg7XG4gICAgdGhpcy5ncmFtbWFyU2NvcGVzID0gWycqJ107XG4gICAgdGhpcy5wcm92aWRlcnMgPSBbXTtcbiAgfVxuXG4gIGFkZFN5bWJvbFByb3ZpZGVyKC4uLnByb3ZpZGVyczogc3ltLlN5bWJvbFByb3ZpZGVyW10pIHtcbiAgICBmb3IgKGxldCBwcm92aWRlciBvZiBwcm92aWRlcnMpIHtcbiAgICAgIGlmICh0aGlzLnByb3ZpZGVycy5pbmNsdWRlcyhwcm92aWRlcikpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5wcm92aWRlcnMucHVzaChwcm92aWRlcik7XG4gICAgfVxuICB9XG5cbiAgcmVtb3ZlU3ltYm9sUHJvdmlkZXIoLi4ucHJvdmlkZXJzOiBzeW0uU3ltYm9sUHJvdmlkZXJbXSkge1xuICAgIGxldCBpbmRleGVzVG9SZW1vdmUgPSBbXTtcbiAgICBmb3IgKGxldCBbaW5kZXgsIHByb3ZpZGVyXSBvZiB0aGlzLnByb3ZpZGVycy5lbnRyaWVzKCkpIHtcbiAgICAgIGlmIChwcm92aWRlcnMuaW5jbHVkZXMocHJvdmlkZXIpKSB7XG4gICAgICAgIC8vIEluc2VydCB0aGUgaW5kZXhlcyBpbiBiYWNrd2FyZHMgb3JkZXIuIExhdGVyIHdlJ2xsIGl0ZXJhdGVcbiAgICAgICAgLy8gYmFjay10by1mcm9udCBzbyB0aGF0IGluZGV4ZXMgZG9uJ3Qgc2hpZnQgYXMgd2UgcmVtb3ZlIGVudHJpZXMuXG4gICAgICAgIGluZGV4ZXNUb1JlbW92ZS51bnNoaWZ0KGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChsZXQgaW5kZXggb2YgaW5kZXhlc1RvUmVtb3ZlKSB7XG4gICAgICB0aGlzLnByb3ZpZGVycy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbiAgfVxuXG4gIGdldFNjb3JlQm9vc3QobmFtZTogc3RyaW5nLCBwYWNrYWdlTmFtZTogc3RyaW5nLCBwcmVmZXJyZWRQcm92aWRlcnM6IHN0cmluZ1tdKSB7XG4gICAgaWYgKHBhY2thZ2VOYW1lID09PSAndW5rbm93bicpIHJldHVybiAwO1xuICAgIGxldCBpbmRleCA9IHByZWZlcnJlZFByb3ZpZGVycy5pbmRleE9mKHBhY2thZ2VOYW1lKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBpbmRleCA9IHByZWZlcnJlZFByb3ZpZGVycy5pbmRleE9mKG5hbWUpO1xuICAgIH1cbiAgICBpZiAoaW5kZXggPT09IC0xKSByZXR1cm4gMDtcbiAgICBsZXQgc2NvcmVCb29zdCA9IHByZWZlcnJlZFByb3ZpZGVycy5sZW5ndGggLSBpbmRleDtcbiAgICByZXR1cm4gc2NvcmVCb29zdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgYHN5bWJvbHMtdmlldy1yZWR1eGAgcGFja2FnZSBpcyBpbnN0YWxsZWQsIHRoaXMgcGFja2FnZSB3aWxsIHRoZVxuICAgKiB1c2VyJ3MgY29uZmlndXJlZCByYW5raW5nIG9mIHZhcmlvdXMgcHJvdmlkZXJzLlxuICAgKi9cbiAgYXN5bmMgZ2V0U2VsZWN0ZWRQcm92aWRlcnMobWV0YTogc3ltLlN5bWJvbE1ldGEpIHtcbiAgICBsZXQgZXhjbHVzaXZlc0J5U2NvcmUgPSBbXTtcbiAgICBsZXQgc2VsZWN0ZWRQcm92aWRlcnMgPSBbXTtcbiAgICBsZXQgcHJlZmVycmVkUHJvdmlkZXJzID0gYXRvbS5jb25maWcuZ2V0KCdzeW1ib2xzLXZpZXctcmVkdXgucHJlZmVyQ2VydGFpblByb3ZpZGVycycpO1xuXG4gICAgbGV0IGFuc3dlcnMgPSB0aGlzLnByb3ZpZGVycy5tYXAocHJvdmlkZXIgPT4ge1xuICAgICAgLy8gVE9ETzogVGhpcyBtZXRob2QgY2FuIHJlbHVjdGFudGx5IGdvIGFzeW5jIGJlY2F1c2UgbGFuZ3VhZ2UgY2xpZW50c1xuICAgICAgLy8gbWlnaHQgaGF2ZSB0byBhc2sgdGhlaXIgc2VydmVycyBhYm91dCBjYXBhYmlsaXRpZXMuIFdlIG11c3QgaW50cm9kdWNlXG4gICAgICAvLyBhIHRpbWVvdXQgdmFsdWUgaGVyZSBzbyB0aGF0IHdlIGRvbid0IHdhaXQgaW5kZWZpbml0ZWx5IGZvciBwcm92aWRlcnNcbiAgICAgIC8vIHRvIHJlc3BvbmQuXG4gICAgICBjb25zb2xlLmRlYnVnKGBbcHVsc2FyLW91dGxpbmUtdmlld10gQXNraW5nIHByb3ZpZGVyOmAsIHByb3ZpZGVyLm5hbWUsIHByb3ZpZGVyKTtcbiAgICAgIHJldHVybiBwcm92aWRlci5jYW5Qcm92aWRlU3ltYm9scyhtZXRhKTtcbiAgICB9KTtcblxuICAgIGxldCBvdXRjb21lcyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChhbnN3ZXJzKTtcblxuICAgIGZvciAobGV0IFtpbmRleCwgcHJvdmlkZXJdIG9mIHRoaXMucHJvdmlkZXJzLmVudHJpZXMoKSkge1xuICAgICAgbGV0IG91dGNvbWUgPSBvdXRjb21lc1tpbmRleF07XG4gICAgICBpZiAob3V0Y29tZS5zdGF0dXMgPT09ICdyZWplY3RlZCcpIGNvbnRpbnVlO1xuICAgICAgbGV0IHsgdmFsdWU6IHNjb3JlIH0gPSBvdXRjb21lO1xuICAgICAgbGV0IG5hbWUgPSBwcm92aWRlci5uYW1lID8/ICd1bmtub3duJztcbiAgICAgIGxldCBwYWNrYWdlTmFtZSA9IHByb3ZpZGVyPy5wYWNrYWdlTmFtZSA/PyAndW5rbm93bic7XG4gICAgICBsZXQgaXNFeGNsdXNpdmUgPSBwcm92aWRlcj8uaXNFeGNsdXNpdmUgPz8gZmFsc2U7XG5cbiAgICAgIGlmICghc2NvcmUpIGNvbnRpbnVlO1xuXG4gICAgICBpZiAoc2NvcmUgPT09IHRydWUpIHNjb3JlID0gMTtcbiAgICAgIHNjb3JlICs9IHRoaXMuZ2V0U2NvcmVCb29zdChuYW1lLCBwYWNrYWdlTmFtZSwgcHJlZmVycmVkUHJvdmlkZXJzKTtcblxuICAgICAgaWYgKGlzRXhjbHVzaXZlKSB7XG4gICAgICAgIC8vIOKAnEV4Y2x1c2l2ZeKAnSBwcm92aWRlcnMgZ2V0IHB1dCBhc2lkZSB1bnRpbCB0aGUgZW5kLiBXZSdsbCBwaWNrIHRoZVxuICAgICAgICAvLyBfb25lXyB0aGF0IGhhcyB0aGUgaGlnaGVzdCBzY29yZS5cbiAgICAgICAgZXhjbHVzaXZlc0J5U2NvcmUucHVzaCh7IHByb3ZpZGVyLCBzY29yZSB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vbi1leGNsdXNpdmUgcHJvdmlkZXJzIGdvIGludG8gdGhlIHBpbGUgYmVjYXVzZSB3ZSBrbm93IHdlJ2xsIGJlXG4gICAgICAgIC8vIHVzaW5nIHRoZW0gYWxsLlxuICAgICAgICBzZWxlY3RlZFByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZXhjbHVzaXZlc0J5U2NvcmUubGVuZ3RoID4gMCkge1xuICAgICAgZXhjbHVzaXZlc0J5U2NvcmUuc29ydCgoYSwgYikgPT4gYi5zY29yZSAtIGEuc2NvcmUpO1xuICAgICAgbGV0IGV4Y2x1c2l2ZSA9IGV4Y2x1c2l2ZXNCeVNjb3JlWzBdLnByb3ZpZGVyO1xuICAgICAgc2VsZWN0ZWRQcm92aWRlcnMudW5zaGlmdChleGNsdXNpdmUpO1xuICAgIH1cblxuICAgIHJldHVybiBzZWxlY3RlZFByb3ZpZGVycztcblxuICB9XG5cbiAgYXN5bmMgZ2V0T3V0bGluZShlZGl0b3I6IFRleHRFZGl0b3IpIHtcbiAgICB0aGlzLl9hYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgdGhpcy5fYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuXG4gICAgbGV0IG1ldGEgPSB7XG4gICAgICB0eXBlOiAnZmlsZScgYXMgY29uc3QsXG4gICAgICBlZGl0b3IsXG4gICAgICBzaWduYWw6IHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWxcbiAgICB9O1xuXG4gICAgbGV0IHNlbGVjdGVkUHJvdmlkZXJzID0gYXdhaXQgdGhpcy5nZXRTZWxlY3RlZFByb3ZpZGVycyhtZXRhKTtcbiAgICBpZiAoc2VsZWN0ZWRQcm92aWRlcnMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICAgIGxldCByYXdTeW1ib2xzOiBzeW0uRmlsZVN5bWJvbFtdID0gW107XG4gICAgbGV0IHN5bWJvbFByb21pc2VzID0gc2VsZWN0ZWRQcm92aWRlcnMubWFwKHByb3ZpZGVyID0+IHtcbiAgICAgIGxldCByZXNwb25zZSA9IHByb3ZpZGVyLmdldFN5bWJvbHMobWV0YSk7XG4gICAgICBsZXQgcmVzdWx0ID0gcmVzcG9uc2UgaW5zdGFuY2VvZiBQcm9taXNlID8gcmVzcG9uc2UgOiBQcm9taXNlLnJlc29sdmUocmVzcG9uc2UpO1xuXG4gICAgICByZXR1cm4gcmVzdWx0LnRoZW4oKHN5bWJvbHMpID0+IHtcbiAgICAgICAgcmF3U3ltYm9scy5wdXNoKC4uLnN5bWJvbHMpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoc3ltYm9sUHJvbWlzZXMpO1xuICAgIGxldCByZXN1bHRzOiBhdG9tSWRlLk91dGxpbmVUcmVlW10gPSBbXTtcblxuICAgIGxldCBpbmRleCA9IG5ldyBJbmRleCgpO1xuXG4gICAgZm9yIChsZXQgc3ltYm9sIG9mIHJhd1N5bWJvbHMpIHtcbiAgICAgIGxldCBuYW1lID0gc3ltYm9sLnNob3J0TmFtZSA/PyBzeW1ib2wubmFtZTtcbiAgICAgIGxldCByYW5nZTtcbiAgICAgIGlmICgncmFuZ2UnIGluIHN5bWJvbCkge1xuICAgICAgICByYW5nZSA9IHN5bWJvbC5yYW5nZTtcbiAgICAgIH0gZWxzZSBpZiAoJ3Bvc2l0aW9uJyBpbiBzeW1ib2wpIHtcbiAgICAgICAgcmFuZ2UgPSBuZXcgUmFuZ2Uoc3ltYm9sLnBvc2l0aW9uLCBzeW1ib2wucG9zaXRpb24pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBNYWxmb3JtZWQgc3ltYm9sIWApO1xuICAgICAgfVxuICAgICAgbGV0IHRyZWUgPSB7XG4gICAgICAgIGljb246IHN5bWJvbC50YWcgPyBgdHlwZS0ke3N5bWJvbC50YWd9YCA6IHVuZGVmaW5lZCxcbiAgICAgICAga2luZDogKExTUF9LSU5EUy5oYXMoc3ltYm9sLnRhZyA/PyAnJykgPyBzeW1ib2wudGFnIDogdW5kZWZpbmVkKSBhcyBhdG9tSWRlLk91dGxpbmVUcmVlS2luZCxcbiAgICAgICAgcGxhaW5UZXh0OiBuYW1lLFxuICAgICAgICByZXByZXNlbnRhdGl2ZU5hbWU6IG5hbWUsXG4gICAgICAgIHN0YXJ0UG9zaXRpb246IHJhbmdlLnN0YXJ0LFxuICAgICAgICBlbmRQb3NpdGlvbjogcmFuZ2UuZW5kLFxuICAgICAgICBjaGlsZHJlbjogW11cbiAgICAgIH07XG4gICAgICBpZiAoc3ltYm9sLmNvbnRleHQpIHtcbiAgICAgICAgbGV0IGVudHJpZXMgPSBpbmRleC5nZXQoc3ltYm9sLmNvbnRleHQpO1xuICAgICAgICBsZXQgbGFzdCA9IGVudHJpZXNbZW50cmllcy5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKGxhc3QpIHtcbiAgICAgICAgICBlbnRyaWVzWzBdLmNoaWxkcmVuLnB1c2godHJlZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdHMucHVzaCh0cmVlKTtcbiAgICAgIH1cbiAgICAgIGluZGV4LmFkZChuYW1lLCB0cmVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBvdXRsaW5lVHJlZXM6IHJlc3VsdHMgfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTeW1ib2xQcm92aWRlcldyYXBwZXI7XG4iXX0=