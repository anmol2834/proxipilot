export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions<TBody = unknown> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  tenantId?: string;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  credentials?: RequestCredentials;
}

export interface ApiResponse<TData = unknown> {
  data: TData;
  status: number;
  statusText: string;
  headers: Headers;
  requestId?: string;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}
