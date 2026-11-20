import { env } from "@/config/env";
import { APP_CONFIG } from "@/config/app";
import { AppError } from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";
import { normalizeError } from "../errors/normalize-error";
import { ApiResponse, HttpMethod, RequestOptions } from "./types";

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private token: string | null = null;

  constructor(
    baseUrl: string = env.NEXT_PUBLIC_API_URL,
    defaultTimeout: number = APP_CONFIG.timeouts.apiRequest
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.defaultTimeout = defaultTimeout;
  }

  public setAuthToken(token: string | null): void {
    this.token = token;
    if (typeof window !== "undefined") {
      try {
        if (token) {
          localStorage.setItem("pp_access_token", token);
        } else {
          localStorage.removeItem("pp_access_token");
        }
      } catch {
        // Ignore localStorage quota/access restrictions
      }
    }
  }

  public getAuthToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pp_access_token");
        if (stored) {
          this.token = stored;
          return stored;
        }
      } catch {
        // Ignore localStorage errors
      }
    }
    return null;
  }

  private buildUrl(endpoint: string, params?: RequestOptions["params"]): string {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${cleanEndpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async request<TData>(
    method: HttpMethod,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<TData>> {
    const {
      params,
      body,
      headers: customHeaders = {},
      signal: externalSignal,
      timeoutMs = this.defaultTimeout,
      tenantId,
      credentials = "include",
      cache,
      next,
    } = options;

    const url = this.buildUrl(endpoint, params);

    // Setup Timeout & Cancellation via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Link external abort signal if provided
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        throw new AppError({
          message: "Request was cancelled.",
          code: ErrorCode.ABORTED,
          statusCode: 499,
        });
      }
      externalSignal.addEventListener("abort", () => {
        controller.abort(externalSignal.reason);
      });
    }

    // Build standard headers
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...customHeaders,
    };

    const authToken = this.getAuthToken();
    if (authToken && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (tenantId) {
      headers["X-Organization-Id"] = tenantId;
      headers[APP_CONFIG.headerKeys.tenantId] = tenantId;
    }

    // Request ID for traceability
    const clientRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    headers[APP_CONFIG.headerKeys.requestId] = clientRequestId;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body:
          body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
        credentials,
        cache,
        next,
      });

      clearTimeout(timeoutId);

      const requestId = response.headers.get(APP_CONFIG.headerKeys.requestId) || clientRequestId;

      // Handle non-OK HTTP status
      if (!response.ok) {
        let errorPayload: unknown;
        try {
          errorPayload = await response.json();
        } catch {
          errorPayload = {
            message: response.statusText || `Request failed with status ${response.status}`,
            statusCode: response.status,
          };
        }

        const normalized = normalizeError(errorPayload);
        throw new AppError({
          message: normalized.message,
          code: normalized.code,
          statusCode: response.status,
          fieldErrors: normalized.fieldErrors,
          requestId,
          details: normalized.details,
        });
      }

      // 204 No Content
      if (response.status === 204) {
        return {
          data: null as unknown as TData,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          requestId,
        };
      }

      // Parse JSON
      const data: TData = await response.json();

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        requestId,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw normalizeError(err);
    }
  }

  public get<TData>(
    endpoint: string,
    options?: Omit<RequestOptions, "body">
  ): Promise<ApiResponse<TData>> {
    return this.request<TData>("GET", endpoint, options);
  }

  public post<TData, TBody = unknown>(
    endpoint: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "body">
  ): Promise<ApiResponse<TData>> {
    return this.request<TData>("POST", endpoint, { ...options, body });
  }

  public put<TData, TBody = unknown>(
    endpoint: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "body">
  ): Promise<ApiResponse<TData>> {
    return this.request<TData>("PUT", endpoint, { ...options, body });
  }

  public patch<TData, TBody = unknown>(
    endpoint: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "body">
  ): Promise<ApiResponse<TData>> {
    return this.request<TData>("PATCH", endpoint, { ...options, body });
  }

  public delete<TData>(
    endpoint: string,
    options?: Omit<RequestOptions, "body">
  ): Promise<ApiResponse<TData>> {
    return this.request<TData>("DELETE", endpoint, options);
  }
}

export const apiClient = new ApiClient();
