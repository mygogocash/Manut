import { ApiError, type ApiErrorDetail } from "./api-error";
import type {
  HttpExecutor,
  HttpMethod,
  SessionTransport,
  RequestAbortSignal,
  TransportRequest,
  TransportResponse,
} from "./api-types";

const REFRESH_EXEMPT_PATHS = [
  "/auth/login",
  "/auth/logout",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/magic-link",
  "/auth/recover-password",
  "/auth/exchange-session",
];

export interface ApiClientOptions {
  baseUrl: string;
  execute: HttpExecutor;
  session: SessionTransport;
}

export interface ApiRequestOptions {
  signal?: RequestAbortSignal;
}

interface ParsedError {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

function normalizeBaseUrl(value: string): string {
  if (value === "/") return "";
  return value.replace(/\/+$/, "");
}

function requestUrl(baseUrl: string, path: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
    throw new ApiError(
      0,
      "INVALID_API_PATH",
      "API requests must use an application-relative path.",
    );
  }
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function mayRefresh(path: string): boolean {
  return !REFRESH_EXEMPT_PATHS.some(
    (candidate) => path === candidate || path.startsWith(`${candidate}?`),
  );
}

function parseError(response: TransportResponse): ParsedError {
  const fallback =
    response.status === 429
      ? {
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait and try again.",
        }
      : response.status >= 500
        ? {
            code: "SERVER_ERROR",
            message: "The server could not complete the request.",
          }
        : {
            code: "REQUEST_FAILED",
            message: "The request could not be completed.",
          };

  if (
    typeof response.body !== "object" ||
    response.body === null ||
    !("error" in response.body)
  ) {
    return fallback;
  }

  const raw = response.body.error;
  if (typeof raw === "string") {
    return { code: fallback.code, message: raw };
  }
  if (typeof raw !== "object" || raw === null) return fallback;

  const record = raw as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : fallback.code,
    message:
      typeof record.message === "string" ? record.message : fallback.message,
    details: Array.isArray(record.details)
      ? (record.details as ApiErrorDetail[])
      : undefined,
  };
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(private readonly options: ApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
  }

  get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>("GET", path, undefined, options);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
    isRetry = false,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET") headers["X-Requested-With"] = "XMLHttpRequest";

    const undecorated: TransportRequest = {
      url: requestUrl(this.baseUrl, path),
      method,
      headers,
      ...(body === undefined ? {} : { body }),
      ...(options?.signal ? { signal: options.signal } : {}),
    };
    const request = await this.options.session.decorate(undecorated);

    let response: TransportResponse;
    try {
      response = await this.options.execute(request);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "Cannot reach the server. Check your connection and try again.",
      );
    }

    if (
      response.status === 401 &&
      !isRetry &&
      mayRefresh(path) &&
      (await this.options.session.refresh())
    ) {
      return this.request<T>(method, path, body, options, true);
    }

    if (response.status < 200 || response.status >= 300) {
      const parsed = parseError(response);
      throw new ApiError(
        response.status,
        parsed.code,
        parsed.message,
        parsed.details,
      );
    }

    return response.body as T;
  }
}
