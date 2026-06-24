// One error type, one response shape. Every layer throws AppError; the Edge
// Function boundary turns it into the consistent JSON envelope. No ad-hoc
// `{error: "..."}` shapes anywhere else.

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_REQUEST"
  | "SYMBOL_NOT_FOUND"
  | "QUOTA_EXCEEDED"
  | "REQUEST_IN_PROGRESS"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL";

const HTTP: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  INVALID_REQUEST: 400,
  SYMBOL_NOT_FOUND: 404,
  QUOTA_EXCEEDED: 402, // Payment Required — semantically "upgrade to continue"
  REQUEST_IN_PROGRESS: 409,
  PROVIDER_TIMEOUT: 504,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
  get httpStatus(): number {
    return HTTP[this.code];
  }
  toBody() {
    return {
      success: false as const,
      error_code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

// Normalize anything thrown (including a raw QUOTA_EXCEEDED jsonb from the RPC) into AppError.
export function asAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  return new AppError("INTERNAL", msg);
}
