import type { TErrorData } from "./base";

/**
 * Provider error types for checkProvider validation.
 */
export type ProviderErrorType =
  | "invalid_key"
  | "empty_key"
  | "invalid_url"
  | "connection_failed";

/**
 * Error factory functions for consistent error responses.
 */
export const ProviderErrors = {
  invalidKey: (message = "Invalid API key"): TErrorData => ({
    field: "key",
    message,
  }),

  emptyKey: (): TErrorData => ({
    field: "key",
    message: "Empty key",
  }),

  invalidUrl: (message = "Invalid URL"): TErrorData => ({
    field: "url",
    message,
  }),

  connectionFailed: (message = "Failed to connect"): TErrorData => ({
    field: "url",
    message,
  }),
};

/**
 * Extract error message from various API error formats.
 */
export const extractErrorMessage = (error: unknown): string | undefined => {
  if (typeof error !== "object" || !error) return undefined;

  // Anthropic error format: error.error.error.message
  if (
    "error" in error &&
    typeof error.error === "object" &&
    error.error &&
    "error" in error.error &&
    typeof error.error.error === "object" &&
    error.error.error &&
    "message" in error.error.error
  ) {
    return error.error.error.message as string;
  }

  // Standard error format: error.message
  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  return undefined;
};

/**
 * Get HTTP status code from error object.
 */
export const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || !error) return undefined;
  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }
  return undefined;
};

/**
 * Get error code from error object (OpenAI style).
 */
export const getErrorCode = (error: unknown): string | number | undefined => {
  if (typeof error !== "object" || !error) return undefined;
  if ("message" in error && error.message === "Connection error.") return 404;
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  return undefined;
};

/**
 * Map a caught fetch/SDK error to a TErrorData for display in the UI.
 */
export const mapFetchError = (
  error: unknown,
  hasApiKey?: boolean
): TErrorData => {
  const status = getErrorStatus(error);

  if (
    status === 0 ||
    (error && typeof error === "object" && "cause" in error)
  ) {
    return ProviderErrors.connectionFailed();
  }
  if (status === 401) {
    return ProviderErrors.invalidKey(extractErrorMessage(error));
  }
  if (status === 404) {
    return ProviderErrors.invalidUrl();
  }

  return hasApiKey ? ProviderErrors.invalidKey() : ProviderErrors.emptyKey();
};
