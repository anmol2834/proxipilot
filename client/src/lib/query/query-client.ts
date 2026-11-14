import { QueryClient } from "@tanstack/react-query";

interface ErrorWithStatus {
  status?: number;
  statusCode?: number;
  response?: { status?: number };
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const err = error as ErrorWithStatus;
    return err.status ?? err.statusCode ?? err.response?.status;
  }
  return undefined;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale after 1 minute to avoid aggressive refetching
        staleTime: 60 * 1000,
        // Keep inactive data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Exponential retry for transient network issues, max 2 attempts
        retry: (failureCount, error: unknown) => {
          // Do not retry 4xx client errors (bad request, unauthorized, forbidden, not found)
          const status = getErrorStatusCode(error);
          if (status !== undefined && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        // By default, never retry failed mutations automatically to prevent unintended duplicate writes
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create a new query client to prevent cross-request state leakage
    return createQueryClient();
  } else {
    // Browser: reuse singleton client
    if (!browserQueryClient) {
      browserQueryClient = createQueryClient();
    }
    return browserQueryClient;
  }
}
