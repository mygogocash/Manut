export type SearchParameter = string | string[] | undefined;

function dynamicParameterNames(segments: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const segment of segments) {
    const match = /^\[(?:\.\.\.)?(.+)\]$/.exec(segment);
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}

export function buildReturnPath(
  pathname: string,
  parameters: Readonly<Record<string, SearchParameter>>,
  segments: readonly string[] = [],
  hash = "",
): string {
  const pathParameters = dynamicParameterNames(segments);
  const query: string[] = [];

  for (const [key, rawValue] of Object.entries(parameters)) {
    if (pathParameters.has(key) || rawValue === undefined) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  const normalizedHash = !hash || hash === "#" ? "" : hash;
  const pathWithQuery =
    query.length > 0 ? `${pathname}?${query.join("&")}` : pathname;
  return `${pathWithQuery}${normalizedHash}`;
}
