"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Index = void 0;
// Like a map, but expects each key to have multiple values.
class Index extends Map {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDREQUE0RDtBQUM1RCxNQUFhLEtBQVksU0FBUSxHQUFHO0lBQ2xDLEdBQUcsQ0FBQyxHQUFNLEVBQUUsR0FBRyxNQUFXO1FBQ3hCLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDM0IsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDdkMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBVyxDQUFDLENBQUM7UUFDN0IsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztJQUN2QixDQUFDO0NBQ0Y7QUFURCxzQkFTQyIsInNvdXJjZXNDb250ZW50IjpbIlxuLy8gTGlrZSBhIG1hcCwgYnV0IGV4cGVjdHMgZWFjaCBrZXkgdG8gaGF2ZSBtdWx0aXBsZSB2YWx1ZXMuXG5leHBvcnQgY2xhc3MgSW5kZXg8SywgVj4gZXh0ZW5kcyBNYXAge1xuICBhZGQoa2V5OiBLLCAuLi52YWx1ZXM6IFZbXSkge1xuICAgIGxldCBleGlzdHMgPSB0aGlzLmhhcyhrZXkpO1xuICAgIGxldCBsaXN0ID0gZXhpc3RzID8gdGhpcy5nZXQoa2V5KSA6IFtdO1xuICAgIGlmICghZXhpc3RzKSB7XG4gICAgICB0aGlzLnNldChrZXksIGxpc3QgYXMgVltdKTtcbiAgICB9XG4gICAgbGlzdC5wdXNoKC4uLnZhbHVlcyk7XG4gIH1cbn1cbiJdfQ==