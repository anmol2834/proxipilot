import { AppError, FieldError } from "./app-error";
import { ErrorCode, ErrorCodeType } from "./error-codes";

interface BackendErrorPayload {
  message?: string;
  error?: string | { message?: string; code?: string };
  detail?: string | Array<{ msg?: string; loc?: string[]; message?: string }>;
  code?: string;
  status?: number;
  statusCode?: number;
  errors?: Record<string, string[]> | Array<{ field?: string; message?: string }>;
  requestId?: string;
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  // Handle AbortError / DOMException
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AppError({
      message: "The request was cancelled.",
      code: ErrorCode.ABORTED,
      statusCode: 499,
      cause: error,
    });
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new AppError({
        message: "The request was cancelled.",
        code: ErrorCode.ABORTED,
        statusCode: 499,
        cause: error,
      });
    }

    // Network / Offline errors
    if (
      error.message.toLowerCase().includes("failed to fetch") ||
      error.message.toLowerCase().includes("networkerror")
    ) {
      return new AppError({
        message: "Unable to connect to the server. Please check your internet connection.",
        code: ErrorCode.NETWORK_ERROR,
        statusCode: 0,
        cause: error,
      });
    }

    return new AppError({
      message: error.message || "An unexpected error occurred.",
      code: ErrorCode.UNKNOWN_ERROR,
      statusCode: 500,
      cause: error,
    });
  }

  // Handle object-like responses from backends
  if (typeof error === "object" && error !== null) {
    const payload = error as BackendErrorPayload;
    const statusCode = payload.status || payload.statusCode || 500;

    let message = "A server error occurred.";
    if (typeof payload.detail === "string") {
      message = payload.detail;
    } else if (Array.isArray(payload.detail) && payload.detail.length > 0) {
      message = payload.detail[0]?.msg || payload.detail[0]?.message || "Validation error.";
    } else if (typeof payload.message === "string") {
      message = payload.message;
    } else if (typeof payload.error === "string") {
      message = payload.error;
    } else if (typeof payload.error === "object" && payload.error?.message) {
      message = payload.error.message;
    }

    const fieldErrors: FieldError[] = [];
    if (payload.errors) {
      if (Array.isArray(payload.errors)) {
        for (const item of payload.errors) {
          if (item.field && item.message) {
            fieldErrors.push({ field: item.field, message: item.message });
          }
        }
      } else if (typeof payload.errors === "object") {
        for (const [field, messages] of Object.entries(payload.errors)) {
          if (Array.isArray(messages) && messages.length > 0) {
            fieldErrors.push({ field, message: messages[0] });
          } else if (typeof messages === "string") {
            fieldErrors.push({ field, message: messages });
          }
        }
      }
    }

    let code: ErrorCodeType = ErrorCode.UNKNOWN_ERROR;
    if (statusCode === 400) code = ErrorCode.BAD_REQUEST;
    else if (statusCode === 401) code = ErrorCode.UNAUTHORIZED;
    else if (statusCode === 403) code = ErrorCode.FORBIDDEN;
    else if (statusCode === 404) code = ErrorCode.NOT_FOUND;
    else if (statusCode === 409) code = ErrorCode.CONFLICT;
    else if (statusCode === 422) code = ErrorCode.VALIDATION_ERROR;
    else if (statusCode === 429) code = ErrorCode.RATE_LIMITED;
    else if (statusCode >= 500) code = ErrorCode.INTERNAL_SERVER_ERROR;

    return new AppError({
      message,
      code,
      statusCode,
      fieldErrors,
      requestId: payload.requestId,
      details: payload,
    });
  }

  return new AppError({
    message: typeof error === "string" ? error : "An unknown error occurred.",
    code: ErrorCode.UNKNOWN_ERROR,
    statusCode: 500,
  });
}
