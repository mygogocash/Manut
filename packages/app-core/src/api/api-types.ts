export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RequestCredentialsMode = "include" | "omit";

export interface ApiSuccess<T> {
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface RequestAbortSignal {
  readonly aborted: boolean;
}

export interface TransportRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: unknown;
  credentials?: RequestCredentialsMode;
  signal?: RequestAbortSignal;
}

export interface TransportResponse {
  status: number;
  body?: unknown;
}

export type HttpExecutor = (
  request: TransportRequest,
) => Promise<TransportResponse>;

/**
 * Platform code owns credentials. The shared client only asks the transport to
 * decorate a serializable request and to refresh or clear its session.
 */
export interface SessionTransport {
  decorate(request: TransportRequest): Promise<TransportRequest>;
  refresh(): Promise<boolean>;
  clear(): Promise<void>;
}
