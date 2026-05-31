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
];

const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
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

function isV4InCidr(ip: string, network: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(network) & mask);
}

function isBlockedV6(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::1' || normalized === '::') {
    return true; // loopback / unspecified
  }
  // fc00::/7 (unique local) covers fc00..fdff; fe80::/10 (link-local).
  return (
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

/**
 * Throws BlockedHostError if the host points at an internal/reserved target.
 * Synchronous and DNS-free by design — literal IPs and obvious internal names
 * only. Callers needing DNS-resolution checks must layer that separately.
 */
export function assertSafeOutboundHost(host: string): void {
  const cleaned = host
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  const kind = isIP(cleaned);

  if (kind === 4) {
    if (
      BLOCKED_V4_CIDRS.some(([net, bits]) => isV4InCidr(cleaned, net, bits))
    ) {
      throw new BlockedHostError(host);
    }
    return;
  }

  if (kind === 6) {
    if (isBlockedV6(cleaned)) {
      throw new BlockedHostError(host);
    }
    return;
  }

  if (
    BLOCKED_HOSTNAMES.has(cleaned) ||
    cleaned.endsWith('.internal') ||
    cleaned.endsWith('.local')
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
