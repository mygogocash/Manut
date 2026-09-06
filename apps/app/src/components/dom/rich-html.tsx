"use dom";

/**
 * Web-only escape hatch for HTML the Reusables stack cannot render
 * (TipTap dumps, PDF previews, charts). Layouts cannot be DOM components.
 * Callers must pass already-sanitized HTML.
 */
export default function RichHtml({
  html,
  dom,
}: {
  html: string;
  dom?: import("expo/dom").DOMProps;
}) {
  void dom;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
