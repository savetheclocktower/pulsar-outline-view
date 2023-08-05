"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Index = void 0;
// Like a map, but expects each key to have multiple values.
class Index extends Map {
    constructor() {
        super();
    }
    add(key, ...values) {
        let exists = this.has(key);
        let list = exists ? this.get(key) : [];
        if (!exists) {
            this.set(key, list);
        }
        list.push(...values);
    }
}
exports.Index = Index;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDREQUE0RDtBQUM1RCxNQUFhLEtBQVksU0FBUSxHQUFHO0lBQ2xDO1FBQ0UsS0FBSyxFQUFFLENBQUM7SUFDVixDQUFDO0lBRUQsR0FBRyxDQUFDLEdBQU0sRUFBRSxHQUFHLE1BQVc7UUFDeEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMzQixJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUN2QyxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1gsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBVyxDQUFDLENBQUM7U0FDNUI7UUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7SUFDdkIsQ0FBQztDQUNGO0FBYkQsc0JBYUMiLCJzb3VyY2VzQ29udGVudCI6WyJcbi8vIExpa2UgYSBtYXAsIGJ1dCBleHBlY3RzIGVhY2gga2V5IHRvIGhhdmUgbXVsdGlwbGUgdmFsdWVzLlxuZXhwb3J0IGNsYXNzIEluZGV4PEssIFY+IGV4dGVuZHMgTWFwIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGFkZChrZXk6IEssIC4uLnZhbHVlczogVltdKSB7XG4gICAgbGV0IGV4aXN0cyA9IHRoaXMuaGFzKGtleSk7XG4gICAgbGV0IGxpc3QgPSBleGlzdHMgPyB0aGlzLmdldChrZXkpIDogW107XG4gICAgaWYgKCFleGlzdHMpIHtcbiAgICAgIHRoaXMuc2V0KGtleSwgbGlzdCBhcyBWW10pO1xuICAgIH1cbiAgICBsaXN0LnB1c2goLi4udmFsdWVzKTtcbiAgfVxufVxuIl19