/**
 * JSON.stringify output is valid JSON, but raw JSON is not always safe inside
 * an inline <script>: `</script>` terminates the tag and JS line separators can
 * break parsing. Keep the parsed value identical while removing script-breaking
 * bytes from the source.
 */
export function jsonForInlineScript(value: unknown): string {
  return (JSON.stringify(value) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029');
}
