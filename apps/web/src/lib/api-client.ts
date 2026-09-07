/**
 * API base URL — always same-origin via Next.js rewrites proxy.
 * Requests go to `/api/…` on the current host; `next.config.ts` proxies
 * them to the real Express backend (`API_URL` env var, server-side only).
 */
export const apiBaseUrl = "/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ field?: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

const authRedirectExemptPaths = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/magic-link",
  "/auth/recover-password",
  "/auth/exchange-session",
  "/auth/refresh",
];

function isAuthRedirectExemptPath(path: string): boolean {
  return authRedirectExemptPaths.some((candidate) => path.includes(candidate));
}

// Page paths where a background 401 (typically AuthProvider's /me bootstrap)
// must NOT trigger a redirect to /sign-in. These pages are mid-auth flows
// that legitimately have no session cookie yet — the magic-link callback
// races AuthProvider on mount, the forgot/reset/magic-link forms are pre-
// session by design. Without this guard, the /me 401 navigates the user
// away before the callback can exchange the token and set the cookie.
const authFlowPagePaths = [
  "/sign-in",
  "/auth/callback",
  "/magic-link",
  "/forgot-password",
  "/reset-password",
  "/welcome",
];

export function isOnAuthFlowPage(pathname?: string): boolean {
  const currentPath =
    pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  if (!currentPath) return false;
  // Exact match for the root marketing page; do not prefix-match "/" or it would exempt all routes.
  if (currentPath === "/") return true;
  return authFlowPagePaths.some(
    (p) => currentPath === p || currentPath.startsWith(`${p}/`),
  );
}

export async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = fetch(`${apiBaseUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}

function parseErrorBody(body: unknown) {
  const err =
    body && typeof body === "object" && "error" in body
      ? ((body as Record<string, unknown>).error ?? {})
      : {};
  const errObj =
    typeof err === "object" && err !== null
      ? (err as Record<string, unknown>)
      : null;
  return {
    code: typeof err === "string" ? err : String(errObj?.code ?? "UNKNOWN"),
    message:
      typeof err === "string"
        ? err
        : String(errObj?.message ?? "Unknown error"),
    details: errObj?.details as
      Array<{ field?: string; message: string }> | undefined,
  };
}

function throwNonJsonResponseError(res: Response): never {
  if (res.status === 429) {
    throw new ApiError(
      res.status,
      "RATE_LIMITED",
      "Too many requests. Please wait a few minutes and try again.",
    );
  }
  if (res.status >= 500) {
    throw new ApiError(
      res.status,
      "PARSE_ERROR",
      "Something went wrong on our end. Please try again in a moment.",
    );
  }
  throw new ApiError(
    res.status || 0,
    "PARSE_ERROR",
    "We couldn't read the server's response. Please try again.",
  );
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const raw = await res.text();
  const trimmed = raw.trim();

  let body: unknown;
  if (!trimmed) {
    body = {};
  } else {
    try {
      body = JSON.parse(trimmed) as unknown;
    } catch {
      throwNonJsonResponseError(res);
    }
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      if (!isOnAuthFlowPage() && !isAuthRedirectExemptPath(res.url)) {
        window.location.replace("/sign-in");
      }
    }

    const parsed = parseErrorBody(body);
    throw new ApiError(res.status, parsed.code, parsed.message, parsed.details);
  }

  return body as T;
}

/**
 * Typed fetch wrapper for the Manut API.
 * - Uses httpOnly cookies for auth (credentials: 'include')
 * - Adds CSRF `X-Requested-With` header on mutations
 * - On 401, attempts a silent token refresh then retries once
 * - Reads response as text then JSON.parse (429 HTML from edges still surfaces as a clear message)
 * - Throws typed `ApiError` on failure
 */
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
  _isRetry = false,
): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init?.headers);

  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }

  const url = path.startsWith("http") ? path : `${apiBaseUrl}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, credentials: "include" });
  } catch {
    // Raw fetch failures read as "Failed to fetch" / "Load failed" — keep
    // those out of the toast and tell the user what to actually do.
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Can't reach the server. Check your internet connection and try again.",
    );
  }

  if (
    res.status === 401 &&
    !_isRetry &&
    !isAuthRedirectExemptPath(path) &&
    typeof window !== "undefined"
  ) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiFetch<T>(path, init, true);
    }
  }

  return handleResponse<T>(res);
}

/**
 * Build a fetch init with credentials for manual fetch calls (file downloads, multipart uploads, etc.).
 * Returns headers + credentials config; caller can merge with their own options.
 */
export function authFetchInit(
  extraHeaders?: Record<string, string>,
): RequestInit {
  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
    ...extraHeaders,
  };
  return { headers, credentials: "include" };
}

// ─── Convenience methods ────────────────────────────────

export const api = {
  get<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    return apiFetch<T>(path, { ...init, method: "GET" });
  },

  post<T = unknown>(
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    return apiFetch<T>(path, {
      ...init,
      method: "POST",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  put<T = unknown>(
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    return apiFetch<T>(path, {
      ...init,
      method: "PUT",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  patch<T = unknown>(
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    return apiFetch<T>(path, {
      ...init,
      method: "PATCH",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    return apiFetch<T>(path, { ...init, method: "DELETE" });
  },
};
