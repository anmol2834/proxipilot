import { ErrorCode, ErrorCodeType } from "./error-codes";

export interface FieldError {
  field: string;
  message: string;
}

export interface AppErrorParams {
  message: string;
  code?: ErrorCodeType;
  statusCode?: number;
  fieldErrors?: FieldError[];
  details?: unknown;
  requestId?: string;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly fieldErrors: FieldError[];
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(params: AppErrorParams) {
    super(params.message);
    this.name = "AppError";
    this.code = params.code || ErrorCode.UNKNOWN_ERROR;
    this.statusCode = params.statusCode || 500;
    this.fieldErrors = params.fieldErrors || [];
    this.details = params.details;
    this.requestId = params.requestId;

    if (params.cause) {
      this.cause = params.cause;
    }

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }

  public isAuthError(): boolean {
    return this.statusCode === 401 || this.code === ErrorCode.UNAUTHORIZED;
  }

  public isForbidden(): boolean {
    return this.statusCode === 403 || this.code === ErrorCode.FORBIDDEN;
  }

  public isNotFound(): boolean {
    return this.statusCode === 404 || this.code === ErrorCode.NOT_FOUND;
  }

  public isValidationError(): boolean {
    return (
      this.statusCode === 422 ||
      this.code === ErrorCode.VALIDATION_ERROR ||
      this.fieldErrors.length > 0
    );
  }

  public isAborted(): boolean {
    return this.code === ErrorCode.ABORTED;
  }
}
