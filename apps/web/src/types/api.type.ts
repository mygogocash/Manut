export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiPaginatedResponse<T> {
  data: T[];
  meta: ApiPagination;
}

export interface ApiErrorResponse {
  error:
    | string
    | {
        code: string;
        message: string;
        details?: Array<{ field?: string; message: string }>;
      };
}

export interface ApiDeleteResponse {
  ok: boolean;
}
