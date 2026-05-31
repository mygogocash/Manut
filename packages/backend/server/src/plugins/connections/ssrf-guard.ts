import { isIP } from 'node:net';

/**
 * Raised when an outbound connection target resolves to a host that is not
 * allowed (loopback, private ranges, link-local, cloud metadata, etc.).
 */
export class BlockedHostError extends Error {
  constructor(host: string) {
    super(`Outbound connection to host "${host}" is not allowed`);
    this.name = 'BlockedHostError';
  }
}

// IPv4 CIDR blocks that must never be reached from a user-supplied target.
const BLOCKED_V4_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // RFC1918
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (incl. 169.254.169.254 metadata)
  ['172.16.0.0', 12], // RFC1918
  ['192.168.0.0', 16], // RFC1918
  ['192.0.2.0', 24], // TEST-NET-1 (documentation / non-routable)
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
];

const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.');
  return (
    ((Number(parts[0]) << 24) |
      (Number(parts[1]) << 16) |
      (Number(parts[2]) << 8) |
      Number(parts[3])) >>>
    0
  );
}

function isBlockedV4Int(int: number): boolean {
  return BLOCKED_V4_CIDRS.some(([network, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (int & mask) === (ipv4ToInt(network) & mask);
  });
}

/**
 * Parse an IPv6 literal into its eight hextet integers, expanding `::`
 * and folding any embedded IPv4 tail (`::ffff:1.2.3.4`). Returns null
 * for anything that is not a canonicalisable IPv6 address — callers
 * treat null as "blocked" (fail closed).
 */
function parseIpv6(addr: string): number[] | null {
  let s = addr.toLowerCase().replace(/%.*$/, ''); // strip zone id

  // Embedded IPv4 tail (e.g. ::ffff:127.0.0.1) — fold into two hextets so
  // an IPv4-mapped/-embedded address is range-checked, not prefix-matched.
  const v4 = s.match(/(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (v4) {
    if (isIP(v4[1]) !== 4) {
      return null;
    }
    const octets = v4[1].split('.').map(Number);
    if (octets.some(n => n > 255)) {
      return null;
    }
    const h1 = ((octets[0] << 8) | octets[1]) & 0xffff;
    const h2 = ((octets[2] << 8) | octets[3]) & 0xffff;
    s =
      s.slice(0, s.length - v4[1].length) +
      h1.toString(16) +
      ':' +
      h2.toString(16);
  }

  if ((s.match(/::/g) || []).length > 1) {
    return null; // more than one "::" is invalid
  }

  let parts: string[];
  if (s.includes('::')) {
    const [head, tail] = s.split('::');
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const fill = 8 - headParts.length - tailParts.length;
    if (fill < 0) {
      return null;
    }
    parts = headParts.concat(
      Array.from({ length: fill }, () => '0'),
      tailParts
    );
  } else {
    parts = s.split(':');
  }

  if (parts.length !== 8) {
    return null;
  }
  const hextets = parts.map(x => (x === '' ? NaN : parseInt(x, 16)));
  if (hextets.some(n => Number.isNaN(n) || n < 0 || n > 0xffff)) {
    return null;
  }
  return hextets;
}

function isBlockedV6(addr: string): boolean {
  const h = parseIpv6(addr);
  if (!h) {
    return true; // fail closed on anything we cannot canonicalise
  }
  // :: (unspecified) and ::1 (loopback)
  if (
    h[0] === 0 &&
    h[1] === 0 &&
    h[2] === 0 &&
    h[3] === 0 &&
    h[4] === 0 &&
    h[5] === 0 &&
    h[6] === 0 &&
    (h[7] === 0 || h[7] === 1)
  ) {
    return true;
  }
  // IPv4-mapped ::ffff:0:0/96 — range-check the embedded IPv4 address.
  if (
    h[0] === 0 &&
    h[1] === 0 &&
    h[2] === 0 &&
    h[3] === 0 &&
    h[4] === 0 &&
    h[5] === 0xffff
  ) {
    return isBlockedV4Int(((h[6] << 16) | h[7]) >>> 0);
  }
  // fc00::/7 unique-local, fe80::/10 link-local, 2001:db8::/32 documentation.
  if ((h[0] & 0xfe00) === 0xfc00) {
    return true;
  }
  if ((h[0] & 0xffc0) === 0xfe80) {
    return true;
  }
  if (h[0] === 0x2001 && h[1] === 0x0db8) {
    return true;
  }
  return false;
}

/**
 * Throws BlockedHostError if the host points at an internal/reserved
 * target. Synchronous and DNS-free by design.
 *
 * It CANONICALISES the host before the IP check so the common literal
 * bypasses are closed:
 *  - alternate IPv4 encodings (decimal `2130706433`, hex `0x7f.0.0.1`,
 *    octal `0177.0.0.1`, short forms) are normalised via the WHATWG URL
 *    parser, then range-checked as integers;
 *  - IPv4-mapped / -embedded IPv6 (`::ffff:127.0.0.1`) is folded to its
 *    IPv4 form and range-checked, instead of string-prefix matching.
 *
 * LIMITATION (documented, not a regression): this does NOT resolve DNS,
 * so a public hostname that resolves to a private IP (DNS rebinding), or
 * a `mongodb+srv` SRV target that points inward, is not caught here.
 * Closing that requires resolve-and-pin at the socket layer, which the
 * lazy `mongodb` driver / `fetch` do not expose — tracked as a follow-up.
 */
export function assertSafeOutboundHost(host: string): void {
  const raw = host
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/%.*$/, '');
  if (!raw) {
    throw new BlockedHostError(host);
  }

  // IPv6 literal (contains a colon) — parse to integers and range-check.
  if (raw.includes(':')) {
    if (isBlockedV6(raw)) {
      throw new BlockedHostError(host);
    }
    return;
  }

  // IPv4 (any encoding) or a hostname — canonicalise through the WHATWG
  // URL parser. This turns 2130706433 / 0x7f.0.0.1 / 0177.0.0.1 / short
  // forms into dotted-quad and lower-cases hostnames. Anything the parser
  // rejects is treated as blocked.
  let canonical: string;
  try {
    canonical = new URL(`http://${raw}`).hostname;
  } catch {
    throw new BlockedHostError(host);
  }
  const cleaned = canonical.replace(/^\[|\]$/g, '').toLowerCase();

  if (isIP(cleaned) === 4) {
    if (isBlockedV4Int(ipv4ToInt(cleaned))) {
      throw new BlockedHostError(host);
    }
    return;
  }
  // The parser yields a bracketed IPv6 for some inputs.
  if (cleaned.includes(':')) {
    if (isBlockedV6(cleaned)) {
      throw new BlockedHostError(host);
    }
    return;
  }

  if (
    BLOCKED_HOSTNAMES.has(cleaned) ||
    cleaned.endsWith('.internal') ||
    cleaned.endsWith('.local') ||
    cleaned.endsWith('.localhost')
  ) {
    throw new BlockedHostError(host);
  }
}

/**
 * Parses an http(s) URL, rejects non-http(s) schemes, then guards the host.
 */
export function assertSafeOutboundUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BlockedHostError(url);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BlockedHostError(url);
  }
  assertSafeOutboundHost(parsed.hostname);
}
