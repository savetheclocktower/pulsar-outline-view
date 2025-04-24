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
function getSymbolPosition(symbol) {
    if ('position' in symbol)
        return symbol.position;
    if ('range' in symbol)
        return symbol.range.start;
    return null;
}
function compareSymbols(a, b) {
    let positionA = getSymbolPosition(a);
    let positionB = getSymbolPosition(b);
    if (!positionB && !positionA)
        return 0;
    if (!positionB)
        return -1;
    if (!positionA)
        return 1;
    return positionA.compare(positionB);
}
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
     * If the `symbols-view` package is installed, this package will use the
     * user's configured ranking of various providers.
     */
    getSelectedProviders(meta) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            let exclusivesByScore = [];
            let selectedProviders = [];
            let preferredProviders = atom.config.get('symbols-view.preferCertainProviders');
            let answers = this.providers.map(provider => {
                // TODO: This method can reluctantly go async because language clients
                // might have to ask their servers about capabilities. We must introduce
                // a timeout value here so that we don't wait indefinitely for providers
                // to respond.
                console.debug("[pulsar-outline-view] Asking provider:", provider.name, provider);
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
    /**
     * Asks its various providers for symbols, then assembles them into an outline.
     *
     * Will typically be a flat list, but some heuristics are used to infer
     * hierarchy based on metadata.
     *
     * @param  editor A text editor.
     * @returns An `Outline` data structure or `null`.
     */
    getOutline(editor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
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
                    if (symbols === null)
                        return;
                    rawSymbols.push(...symbols);
                    // Re-sort the list of symbols whenever we add new ones. The outline
                    // should always be in document order.
                    rawSymbols.sort(compareSymbols);
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
                    throw new Error("Malformed symbol!");
                }
                let icon = symbol.icon;
                if (!icon && symbol.tag) {
                    icon = `type-${symbol.tag}`;
                }
                let tree = {
                    icon,
                    kind: (LSP_KINDS.has((_c = symbol.tag) !== null && _c !== void 0 ? _c : '') ? symbol.tag : undefined),
                    plainText: name,
                    representativeName: name,
                    startPosition: range.start,
                    endPosition: range.end,
                    children: []
                };
                if (symbol.context) {
                    let entries = index.get(symbol.context);
                    let last = Array.isArray(entries) ? entries[entries.length - 1] : null;
                    if (last) {
                        entries[0].children.push(tree);
                    }
                    else {
                        if (last === null) {
                            console.warn('[pulsar-outline-view] Unknown context:', symbol.context);
                        }
                        results.push(tree);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ltYm9sLXByb3ZpZGVyLXdyYXBwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9saWIvc3ltYm9sLXByb3ZpZGVyLXdyYXBwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQSwrQkFBZ0Q7QUFDaEQsaUNBQStCO0FBSS9CLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3hCLE1BQU07SUFDTixRQUFRO0lBQ1IsV0FBVztJQUNYLFNBQVM7SUFDVCxPQUFPO0lBQ1AsUUFBUTtJQUNSLFVBQVU7SUFDVixPQUFPO0lBQ1AsYUFBYTtJQUNiLE1BQU07SUFDTixXQUFXO0lBQ1gsVUFBVTtJQUNWLFVBQVU7SUFDVixVQUFVO0lBQ1YsUUFBUTtJQUNSLFFBQVE7SUFDUixTQUFTO0lBQ1QsT0FBTztDQUNSLENBQUMsQ0FBQztBQUVILFNBQVMsaUJBQWlCLENBQUMsTUFBc0I7SUFDL0MsSUFBSSxVQUFVLElBQUksTUFBTTtRQUFFLE9BQU8sTUFBTSxDQUFDLFFBQVEsQ0FBQztJQUNqRCxJQUFJLE9BQU8sSUFBSSxNQUFNO1FBQUUsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztJQUNqRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxTQUFTLGNBQWMsQ0FBQyxDQUFpQixFQUFFLENBQWlCO0lBQzFELElBQUksU0FBUyxHQUFHLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3JDLElBQUksU0FBUyxHQUFHLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3JDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxTQUFTO1FBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkMsSUFBSSxDQUFDLFNBQVM7UUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQzFCLElBQUksQ0FBQyxTQUFTO1FBQUUsT0FBTyxDQUFDLENBQUM7SUFDekIsT0FBTyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FB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QUFFLE9BQU8sRUFBRSxDQUFDO1FBQ25DLENBQUM7S0FBQTtDQUNGO0FBRUQsa0JBQWUscUJBQXFCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQb2ludCwgUmFuZ2UsIFRleHRFZGl0b3IgfSBmcm9tICdhdG9tJztcbmltcG9ydCB7IEluZGV4IH0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB0eXBlICogYXMgYXRvbUlkZSBmcm9tICdhdG9tLWlkZS1iYXNlJztcbmltcG9ydCB0eXBlICogYXMgc3ltIGZyb20gJ3N5bWJvbHMtdmlldyc7XG5cbmNvbnN0IExTUF9LSU5EUyA9IG5ldyBTZXQoW1xuICBcImZpbGVcIixcbiAgXCJtb2R1bGVcIixcbiAgXCJuYW1lc3BhY2VcIixcbiAgXCJwYWNrYWdlXCIsXG4gIFwiY2xhc3NcIixcbiAgXCJtZXRob2RcIixcbiAgXCJwcm9wZXJ0eVwiLFxuICBcImZpZWxkXCIsXG4gIFwiY29uc3RydWN0b3JcIixcbiAgXCJlbnVtXCIsXG4gIFwiaW50ZXJmYWNlXCIsXG4gIFwiZnVuY3Rpb25cIixcbiAgXCJ2YXJpYWJsZVwiLFxuICBcImNvbnN0YW50XCIsXG4gIFwic3RyaW5nXCIsXG4gIFwibnVtYmVyXCIsXG4gIFwiYm9vbGVhblwiLFxuICBcImFycmF5XCJcbl0pO1xuXG5mdW5jdGlvbiBnZXRTeW1ib2xQb3NpdGlvbihzeW1ib2w6IHN5bS5GaWxlU3ltYm9sKTogUG9pbnQgfCBudWxsIHtcbiAgaWYgKCdwb3NpdGlvbicgaW4gc3ltYm9sKSByZXR1cm4gc3ltYm9sLnBvc2l0aW9uO1xuICBpZiAoJ3JhbmdlJyBpbiBzeW1ib2wpIHJldHVybiBzeW1ib2wucmFuZ2Uuc3RhcnQ7XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBjb21wYXJlU3ltYm9scyhhOiBzeW0uRmlsZVN5bWJvbCwgYjogc3ltLkZpbGVTeW1ib2wpOiBudW1iZXIge1xuICBsZXQgcG9zaXRpb25BID0gZ2V0U3ltYm9sUG9zaXRpb24oYSk7XG4gIGxldCBwb3NpdGlvbkIgPSBnZXRTeW1ib2xQb3NpdGlvbihiKTtcbiAgaWYgKCFwb3NpdGlvbkIgJiYgIXBvc2l0aW9uQSkgcmV0dXJuIDA7XG4gIGlmICghcG9zaXRpb25CKSByZXR1cm4gLTE7XG4gIGlmICghcG9zaXRpb25BKSByZXR1cm4gMTtcbiAgcmV0dXJuIHBvc2l0aW9uQS5jb21wYXJlKHBvc2l0aW9uQik7XG59XG5cbi8qKlxuICogQ29uc3VtZXMgdGhlIGBzeW1ib2wucHJvdmlkZXJgIHNlcnZpY2UgYW5kIGFkYXB0cyBpdHMgcHJvdmlkZXJzIGludG8gYW5cbiAqIG91dGxpbmUgcHJvdmlkZXIuIERlc2lnbmVkIHRvIGJlIGNob3NlbiBvbmx5IHdoZW4gYSBtb3JlIHN1aXRhYmxlIG91dGxpbmVcbiAqIHByb3ZpZGVyIGlzIG5vdCBhdmFpbGFibGUuXG4gKi9cbmNsYXNzIFN5bWJvbFByb3ZpZGVyV3JhcHBlciBpbXBsZW1lbnRzIGF0b21JZGUuT3V0bGluZVByb3ZpZGVyIHtcbiAgbmFtZTogc3RyaW5nO1xuICBwcmlvcml0eTogbnVtYmVyO1xuICBncmFtbWFyU2NvcGVzOiBzdHJpbmdbXTtcbiAgcHVibGljIHByb3ZpZGVyczogc3ltLlN5bWJvbFByb3ZpZGVyW107XG5cbiAgX2Fib3J0Q29udHJvbGxlcj86IEFib3J0Q29udHJvbGxlcjtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm5hbWUgPSAnU3ltYm9sIFByb3ZpZGVyJztcbiAgICB0aGlzLnByaW9yaXR5ID0gMC44O1xuICAgIHRoaXMuZ3JhbW1hclNjb3BlcyA9IFsnKiddO1xuICAgIHRoaXMucHJvdmlkZXJzID0gW107XG4gIH1cblxuICBwdWJsaWMgYWRkU3ltYm9sUHJvdmlkZXIoLi4ucHJvdmlkZXJzOiBzeW0uU3ltYm9sUHJvdmlkZXJbXSkge1xuICAgIGZvciAobGV0IHByb3ZpZGVyIG9mIHByb3ZpZGVycykge1xuICAgICAgaWYgKHRoaXMucHJvdmlkZXJzLmluY2x1ZGVzKHByb3ZpZGVyKSkgY29udGludWU7XG4gICAgICB0aGlzLnByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVtb3ZlU3ltYm9sUHJvdmlkZXIoLi4ucHJvdmlkZXJzOiBzeW0uU3ltYm9sUHJvdmlkZXJbXSkge1xuICAgIGxldCBpbmRleGVzVG9SZW1vdmUgPSBbXTtcbiAgICBmb3IgKGxldCBbaW5kZXgsIHByb3ZpZGVyXSBvZiB0aGlzLnByb3ZpZGVycy5lbnRyaWVzKCkpIHtcbiAgICAgIGlmIChwcm92aWRlcnMuaW5jbHVkZXMocHJvdmlkZXIpKSB7XG4gICAgICAgIC8vIEluc2VydCB0aGUgaW5kZXhlcyBpbiBiYWNrd2FyZHMgb3JkZXIuIExhdGVyIHdlJ2xsIGl0ZXJhdGVcbiAgICAgICAgLy8gYmFjay10by1mcm9udCBzbyB0aGF0IGluZGV4ZXMgZG9uJ3Qgc2hpZnQgYXMgd2UgcmVtb3ZlIGVudHJpZXMuXG4gICAgICAgIGluZGV4ZXNUb1JlbW92ZS51bnNoaWZ0KGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChsZXQgaW5kZXggb2YgaW5kZXhlc1RvUmVtb3ZlKSB7XG4gICAgICB0aGlzLnByb3ZpZGVycy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0U2NvcmVCb29zdChcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcGFja2FnZU5hbWU6IHN0cmluZyxcbiAgICBwcmVmZXJyZWRQcm92aWRlcnM6IHN0cmluZ1tdXG4gICk6IG51bWJlciB7XG4gICAgaWYgKHBhY2thZ2VOYW1lID09PSAndW5rbm93bicpIHJldHVybiAwO1xuICAgIGxldCBpbmRleCA9IHByZWZlcnJlZFByb3ZpZGVycy5pbmRleE9mKHBhY2thZ2VOYW1lKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBpbmRleCA9IHByZWZlcnJlZFByb3ZpZGVycy5pbmRleE9mKG5hbWUpO1xuICAgIH1cbiAgICBpZiAoaW5kZXggPT09IC0xKSByZXR1cm4gMDtcbiAgICBsZXQgc2NvcmVCb29zdCA9IHByZWZlcnJlZFByb3ZpZGVycy5sZW5ndGggLSBpbmRleDtcbiAgICByZXR1cm4gc2NvcmVCb29zdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgYHN5bWJvbHMtdmlld2AgcGFja2FnZSBpcyBpbnN0YWxsZWQsIHRoaXMgcGFja2FnZSB3aWxsIHVzZSB0aGVcbiAgICogdXNlcidzIGNvbmZpZ3VyZWQgcmFua2luZyBvZiB2YXJpb3VzIHByb3ZpZGVycy5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZ2V0U2VsZWN0ZWRQcm92aWRlcnMoXG4gICAgbWV0YTogc3ltLlN5bWJvbE1ldGFcbiAgKTogUHJvbWlzZTxzeW0uU3ltYm9sUHJvdmlkZXJbXT4ge1xuICAgIGxldCBleGNsdXNpdmVzQnlTY29yZSA9IFtdO1xuICAgIGxldCBzZWxlY3RlZFByb3ZpZGVycyA9IFtdO1xuICAgIGxldCBwcmVmZXJyZWRQcm92aWRlcnMgPSBhdG9tLmNvbmZpZy5nZXQoJ3N5bWJvbHMtdmlldy5wcmVmZXJDZXJ0YWluUHJvdmlkZXJzJyk7XG5cbiAgICBsZXQgYW5zd2VycyA9IHRoaXMucHJvdmlkZXJzLm1hcChwcm92aWRlciA9PiB7XG4gICAgICAvLyBUT0RPOiBUaGlzIG1ldGhvZCBjYW4gcmVsdWN0YW50bHkgZ28gYXN5bmMgYmVjYXVzZSBsYW5ndWFnZSBjbGllbnRzXG4gICAgICAvLyBtaWdodCBoYXZlIHRvIGFzayB0aGVpciBzZXJ2ZXJzIGFib3V0IGNhcGFiaWxpdGllcy4gV2UgbXVzdCBpbnRyb2R1Y2VcbiAgICAgIC8vIGEgdGltZW91dCB2YWx1ZSBoZXJlIHNvIHRoYXQgd2UgZG9uJ3Qgd2FpdCBpbmRlZmluaXRlbHkgZm9yIHByb3ZpZGVyc1xuICAgICAgLy8gdG8gcmVzcG9uZC5cbiAgICAgIGNvbnNvbGUuZGVidWcoXCJbcHVsc2FyLW91dGxpbmUtdmlld10gQXNraW5nIHByb3ZpZGVyOlwiLCBwcm92aWRlci5uYW1lLCBwcm92aWRlcik7XG4gICAgICByZXR1cm4gcHJvdmlkZXIuY2FuUHJvdmlkZVN5bWJvbHMobWV0YSk7XG4gICAgfSk7XG5cbiAgICBsZXQgb3V0Y29tZXMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoYW5zd2Vycyk7XG5cbiAgICBmb3IgKGxldCBbaW5kZXgsIHByb3ZpZGVyXSBvZiB0aGlzLnByb3ZpZGVycy5lbnRyaWVzKCkpIHtcbiAgICAgIGxldCBvdXRjb21lID0gb3V0Y29tZXNbaW5kZXhdO1xuICAgICAgaWYgKG91dGNvbWUuc3RhdHVzID09PSAncmVqZWN0ZWQnKSBjb250aW51ZTtcbiAgICAgIGxldCB7IHZhbHVlOiBzY29yZSB9ID0gb3V0Y29tZTtcbiAgICAgIGxldCBuYW1lID0gcHJvdmlkZXIubmFtZSA/PyAndW5rbm93bic7XG4gICAgICBsZXQgcGFja2FnZU5hbWUgPSBwcm92aWRlcj8ucGFja2FnZU5hbWUgPz8gJ3Vua25vd24nO1xuICAgICAgbGV0IGlzRXhjbHVzaXZlID0gcHJvdmlkZXI/LmlzRXhjbHVzaXZlID8/IGZhbHNlO1xuXG4gICAgICBpZiAoIXNjb3JlKSBjb250aW51ZTtcblxuICAgICAgaWYgKHNjb3JlID09PSB0cnVlKSBzY29yZSA9IDE7XG4gICAgICBzY29yZSArPSB0aGlzLmdldFNjb3JlQm9vc3QobmFtZSwgcGFja2FnZU5hbWUsIHByZWZlcnJlZFByb3ZpZGVycyk7XG5cbiAgICAgIGlmIChpc0V4Y2x1c2l2ZSkge1xuICAgICAgICAvLyDigJxFeGNsdXNpdmXigJ0gcHJvdmlkZXJzIGdldCBwdXQgYXNpZGUgdW50aWwgdGhlIGVuZC4gV2UnbGwgcGljayB0aGVcbiAgICAgICAgLy8gX29uZV8gdGhhdCBoYXMgdGhlIGhpZ2hlc3Qgc2NvcmUuXG4gICAgICAgIGV4Y2x1c2l2ZXNCeVNjb3JlLnB1c2goeyBwcm92aWRlciwgc2NvcmUgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOb24tZXhjbHVzaXZlIHByb3ZpZGVycyBnbyBpbnRvIHRoZSBwaWxlIGJlY2F1c2Ugd2Uga25vdyB3ZSdsbCBiZVxuICAgICAgICAvLyB1c2luZyB0aGVtIGFsbC5cbiAgICAgICAgc2VsZWN0ZWRQcm92aWRlcnMucHVzaChwcm92aWRlcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGV4Y2x1c2l2ZXNCeVNjb3JlLmxlbmd0aCA+IDApIHtcbiAgICAgIGV4Y2x1c2l2ZXNCeVNjb3JlLnNvcnQoKGEsIGIpID0+IGIuc2NvcmUgLSBhLnNjb3JlKTtcbiAgICAgIGxldCBleGNsdXNpdmUgPSBleGNsdXNpdmVzQnlTY29yZVswXS5wcm92aWRlcjtcbiAgICAgIHNlbGVjdGVkUHJvdmlkZXJzLnVuc2hpZnQoZXhjbHVzaXZlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2VsZWN0ZWRQcm92aWRlcnM7XG5cbiAgfVxuXG4gIC8qKlxuICAgKiBBc2tzIGl0cyB2YXJpb3VzIHByb3ZpZGVycyBmb3Igc3ltYm9scywgdGhlbiBhc3NlbWJsZXMgdGhlbSBpbnRvIGFuIG91dGxpbmUuXG4gICAqXG4gICAqIFdpbGwgdHlwaWNhbGx5IGJlIGEgZmxhdCBsaXN0LCBidXQgc29tZSBoZXVyaXN0aWNzIGFyZSB1c2VkIHRvIGluZmVyXG4gICAqIGhpZXJhcmNoeSBiYXNlZCBvbiBtZXRhZGF0YS5cbiAgICpcbiAgICogQHBhcmFtICBlZGl0b3IgQSB0ZXh0IGVkaXRvci5cbiAgICogQHJldHVybnMgQW4gYE91dGxpbmVgIGRhdGEgc3RydWN0dXJlIG9yIGBudWxsYC5cbiAgICovXG4gIGFzeW5jIGdldE91dGxpbmUoZWRpdG9yOiBUZXh0RWRpdG9yKTogUHJvbWlzZTxhdG9tSWRlLk91dGxpbmUgfCBudWxsPiB7XG4gICAgdGhpcy5fYWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgIHRoaXMuX2Fib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblxuICAgIGxldCBtZXRhID0ge1xuICAgICAgdHlwZTogJ2ZpbGUnIGFzIGNvbnN0LFxuICAgICAgZWRpdG9yLFxuICAgICAgc2lnbmFsOiB0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsXG4gICAgfTtcblxuICAgIGxldCBzZWxlY3RlZFByb3ZpZGVycyA9IGF3YWl0IHRoaXMuZ2V0U2VsZWN0ZWRQcm92aWRlcnMobWV0YSk7XG4gICAgaWYgKHNlbGVjdGVkUHJvdmlkZXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgICBsZXQgcmF3U3ltYm9sczogc3ltLkZpbGVTeW1ib2xbXSA9IFtdO1xuICAgIGxldCBzeW1ib2xQcm9taXNlcyA9IHNlbGVjdGVkUHJvdmlkZXJzLm1hcChwcm92aWRlciA9PiB7XG4gICAgICBsZXQgcmVzcG9uc2UgPSBwcm92aWRlci5nZXRTeW1ib2xzKG1ldGEpO1xuICAgICAgbGV0IHJlc3VsdCA9IHJlc3BvbnNlIGluc3RhbmNlb2YgUHJvbWlzZSA/IHJlc3BvbnNlIDogUHJvbWlzZS5yZXNvbHZlKHJlc3BvbnNlKTtcblxuICAgICAgcmV0dXJuIHJlc3VsdC50aGVuKChzeW1ib2xzKSA9PiB7XG4gICAgICAgIGlmIChzeW1ib2xzID09PSBudWxsKSByZXR1cm47XG4gICAgICAgIHJhd1N5bWJvbHMucHVzaCguLi5zeW1ib2xzKTtcbiAgICAgICAgLy8gUmUtc29ydCB0aGUgbGlzdCBvZiBzeW1ib2xzIHdoZW5ldmVyIHdlIGFkZCBuZXcgb25lcy4gVGhlIG91dGxpbmVcbiAgICAgICAgLy8gc2hvdWxkIGFsd2F5cyBiZSBpbiBkb2N1bWVudCBvcmRlci5cbiAgICAgICAgcmF3U3ltYm9scy5zb3J0KGNvbXBhcmVTeW1ib2xzKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHN5bWJvbFByb21pc2VzKTtcbiAgICBsZXQgcmVzdWx0czogYXRvbUlkZS5PdXRsaW5lVHJlZVtdID0gW107XG5cbiAgICBsZXQgaW5kZXggPSBuZXcgSW5kZXgoKTtcblxuICAgIGZvciAobGV0IHN5bWJvbCBvZiByYXdTeW1ib2xzKSB7XG4gICAgICBsZXQgbmFtZSA9IHN5bWJvbC5zaG9ydE5hbWUgPz8gc3ltYm9sLm5hbWU7XG4gICAgICBsZXQgcmFuZ2U6IFJhbmdlO1xuICAgICAgaWYgKCdyYW5nZScgaW4gc3ltYm9sKSB7XG4gICAgICAgIHJhbmdlID0gc3ltYm9sLnJhbmdlO1xuICAgICAgfSBlbHNlIGlmICgncG9zaXRpb24nIGluIHN5bWJvbCkge1xuICAgICAgICByYW5nZSA9IG5ldyBSYW5nZShzeW1ib2wucG9zaXRpb24sIHN5bWJvbC5wb3NpdGlvbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNYWxmb3JtZWQgc3ltYm9sIVwiKTtcbiAgICAgIH1cbiAgICAgIGxldCBpY29uID0gc3ltYm9sLmljb247XG4gICAgICBpZiAoIWljb24gJiYgc3ltYm9sLnRhZykge1xuICAgICAgICBpY29uID0gYHR5cGUtJHtzeW1ib2wudGFnfWA7XG4gICAgICB9XG4gICAgICBsZXQgdHJlZSA9IHtcbiAgICAgICAgaWNvbixcbiAgICAgICAga2luZDogKExTUF9LSU5EUy5oYXMoc3ltYm9sLnRhZyA/PyAnJykgPyBzeW1ib2wudGFnIDogdW5kZWZpbmVkKSBhcyBhdG9tSWRlLk91dGxpbmVUcmVlS2luZCxcbiAgICAgICAgcGxhaW5UZXh0OiBuYW1lLFxuICAgICAgICByZXByZXNlbnRhdGl2ZU5hbWU6IG5hbWUsXG4gICAgICAgIHN0YXJ0UG9zaXRpb246IHJhbmdlLnN0YXJ0LFxuICAgICAgICBlbmRQb3NpdGlvbjogcmFuZ2UuZW5kLFxuICAgICAgICBjaGlsZHJlbjogW11cbiAgICAgIH07XG4gICAgICBpZiAoc3ltYm9sLmNvbnRleHQpIHtcbiAgICAgICAgbGV0IGVudHJpZXMgPSBpbmRleC5nZXQoc3ltYm9sLmNvbnRleHQpO1xuICAgICAgICBsZXQgbGFzdCA9IEFycmF5LmlzQXJyYXkoZW50cmllcykgPyBlbnRyaWVzW2VudHJpZXMubGVuZ3RoIC0gMV0gOiBudWxsO1xuICAgICAgICBpZiAobGFzdCkge1xuICAgICAgICAgIGVudHJpZXNbMF0uY2hpbGRyZW4ucHVzaCh0cmVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAobGFzdCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbcHVsc2FyLW91dGxpbmUtdmlld10gVW5rbm93biBjb250ZXh0OicsIHN5bWJvbC5jb250ZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKHRyZWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHRzLnB1c2godHJlZSk7XG4gICAgICB9XG4gICAgICBpbmRleC5hZGQobmFtZSwgdHJlZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgb3V0bGluZVRyZWVzOiByZXN1bHRzIH07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU3ltYm9sUHJvdmlkZXJXcmFwcGVyO1xuIl19