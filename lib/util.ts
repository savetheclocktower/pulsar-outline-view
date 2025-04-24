
// Like a map, but expects each key to have multiple values.
export class Index<K, V> extends Map {
  add(key: K, ...values: V[]) {
    let exists = this.has(key);
    let list = exists ? this.get(key) : [];
    if (!exists) {
      this.set(key, list as V[]);
    }
    list.push(...values);
  }
}
