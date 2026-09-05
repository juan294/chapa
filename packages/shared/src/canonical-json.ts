/** canonical-json-v1: UTF-16 ordinal key order, ECMAScript finite-number spelling,
 * -0 => 0, unmodified valid Unicode encoded as UTF-8. No implicit date/toJSON conversion.
 * Arrays preserve order. Reject values JSON.stringify would silently discard/alter.
 */
export function canonicalJson(value: unknown): string {
  const active = new Set<object>();
  function string(value: string): string {
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError("Invalid Unicode");
      } else if (c >= 0xdc00 && c <= 0xdfff) throw new TypeError("Invalid Unicode");
    }
    return JSON.stringify(value);
  }
  function encode(item: unknown): string {
    if (item === null) return "null";
    if (typeof item === "string") return string(item);
    if (typeof item === "boolean") return String(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== "object") throw new TypeError("Expected finite JSON value");
    if (active.has(item)) throw new TypeError("Cyclic JSON");
    const array = Array.isArray(item);
    if (!array && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new TypeError("Expected plain JSON object");
    if (Object.getOwnPropertySymbols(item).length) throw new TypeError("Symbol keys are not JSON");
    const descriptors = Object.getOwnPropertyDescriptors(item);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!descriptor.enumerable || !("value" in descriptor)) throw new TypeError("Expected enumerable data properties");
    }
    active.add(item);
    let result: string;
    if (array) {
      if (Object.keys(item).length !== item.length) throw new TypeError("Sparse or extended arrays are not JSON");
      const entries: string[] = [];
      for (let i = 0; i < item.length; i++) {
        if (!Object.hasOwn(item, i)) throw new TypeError("Sparse arrays are not JSON");
        entries.push(encode(item[i]));
      }
      result = `[${entries.join(",")}]`;
    } else result = `{${Object.keys(item).sort().map(key => `${string(key)}:${encode(descriptors[key]!.value)}`).join(",")}}`;
    active.delete(item);
    return result;
  }
  return encode(value);
}
export async function canonicalSha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
