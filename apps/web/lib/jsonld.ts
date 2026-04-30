/**
 * Serialize an object to JSON-LD safe for injection into a <script> tag via
 * dangerouslySetInnerHTML.  JSON.stringify alone is not enough: a value such as
 * `</script>` inside a JSON string would break the surrounding <script> tag and
 * allow script injection.  Unicode-escaping <, >, and & covers all three vectors.
 */
export function renderJsonLd(obj: object): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
