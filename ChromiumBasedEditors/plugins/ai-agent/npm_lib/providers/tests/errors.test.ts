import { describe, expect, it } from "vitest";
import {
  extractErrorMessage,
  getErrorCode,
  getErrorStatus,
  ProviderErrors,
} from "../errors";

describe("ProviderErrors", () => {
  describe("invalidKey", () => {
    it("should return error with default message", () => {
      const error = ProviderErrors.invalidKey();

      expect(error.field).toBe("key");
      expect(error.message).toBe("Invalid API key");
    });

    it("should return error with custom message", () => {
      const error = ProviderErrors.invalidKey("Custom key error");

      expect(error.field).toBe("key");
      expect(error.message).toBe("Custom key error");
    });
  });

  describe("emptyKey", () => {
    it("should return error with empty key message", () => {
      const error = ProviderErrors.emptyKey();

      expect(error.field).toBe("key");
      expect(error.message).toBe("Empty key");
    });
  });

  describe("invalidUrl", () => {
    it("should return error with default message", () => {
      const error = ProviderErrors.invalidUrl();

      expect(error.field).toBe("url");
      expect(error.message).toBe("Invalid URL");
    });

    it("should return error with custom message", () => {
      const error = ProviderErrors.invalidUrl("Custom URL error");

      expect(error.field).toBe("url");
      expect(error.message).toBe("Custom URL error");
    });
  });

  describe("connectionFailed", () => {
    it("should return error with default message", () => {
      const error = ProviderErrors.connectionFailed();

      expect(error.field).toBe("url");
      expect(error.message).toBe("Failed to connect");
    });

    it("should return error with custom message", () => {
      const error = ProviderErrors.connectionFailed("Network timeout");

      expect(error.field).toBe("url");
      expect(error.message).toBe("Network timeout");
    });
  });
});

describe("extractErrorMessage", () => {
  it("should return undefined for null", () => {
    const result = extractErrorMessage(null);
    expect(result).toBeUndefined();
  });

  it("should return undefined for non-object values", () => {
    expect(extractErrorMessage("string")).toBeUndefined();
    expect(extractErrorMessage(123)).toBeUndefined();
    expect(extractErrorMessage(true)).toBeUndefined();
    expect(extractErrorMessage(undefined)).toBeUndefined();
  });

  it("should extract message from standard error format", () => {
    const error = { message: "Standard error message" };
    const result = extractErrorMessage(error);

    expect(result).toBe("Standard error message");
  });

  it("should extract message from Anthropic error format", () => {
    const error = {
      error: {
        error: {
          message: "Anthropic error message",
        },
      },
    };
    const result = extractErrorMessage(error);

    expect(result).toBe("Anthropic error message");
  });

  it("should handle partial Anthropic error structure", () => {
    const error = {
      error: {
        error: null,
      },
    };
    const result = extractErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it("should return undefined when no message property exists", () => {
    const error = { code: 500, status: "error" };
    const result = extractErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it("should handle Error objects", () => {
    const error = new Error("JavaScript error");
    const result = extractErrorMessage(error);

    expect(result).toBe("JavaScript error");
  });

  it("should prioritize Anthropic format over standard format", () => {
    const error = {
      message: "Standard message",
      error: {
        error: {
          message: "Nested Anthropic message",
        },
      },
    };
    const result = extractErrorMessage(error);

    expect(result).toBe("Nested Anthropic message");
  });

  it("should handle non-string message in standard format", () => {
    const error = { message: 123 };
    const result = extractErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it("should handle incomplete Anthropic error chain", () => {
    const error = {
      error: {
        something: "else",
      },
    };
    const result = extractErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it("should handle error.error not being object", () => {
    const error = {
      error: "string",
    };
    const result = extractErrorMessage(error);

    expect(result).toBeUndefined();
  });
});

describe("getErrorStatus", () => {
  it("should return undefined for null", () => {
    const result = getErrorStatus(null);
    expect(result).toBeUndefined();
  });

  it("should return undefined for non-object values", () => {
    expect(getErrorStatus("string")).toBeUndefined();
    expect(getErrorStatus(123)).toBeUndefined();
    expect(getErrorStatus(true)).toBeUndefined();
    expect(getErrorStatus(undefined)).toBeUndefined();
  });

  it("should extract status code from error", () => {
    const error = { status: 404 };
    const result = getErrorStatus(error);

    expect(result).toBe(404);
  });

  it("should return undefined when status is not a number", () => {
    const error = { status: "404" };
    const result = getErrorStatus(error);

    expect(result).toBeUndefined();
  });

  it("should return undefined when status does not exist", () => {
    const error = { code: 404 };
    const result = getErrorStatus(error);

    expect(result).toBeUndefined();
  });

  it("should handle various HTTP status codes", () => {
    expect(getErrorStatus({ status: 200 })).toBe(200);
    expect(getErrorStatus({ status: 401 })).toBe(401);
    expect(getErrorStatus({ status: 403 })).toBe(403);
    expect(getErrorStatus({ status: 500 })).toBe(500);
  });
});

describe("getErrorCode", () => {
  it("should return undefined for null", () => {
    const result = getErrorCode(null);
    expect(result).toBeUndefined();
  });

  it("should return undefined for non-object values", () => {
    expect(getErrorCode("string")).toBeUndefined();
    expect(getErrorCode(123)).toBeUndefined();
    expect(getErrorCode(true)).toBeUndefined();
    expect(getErrorCode(undefined)).toBeUndefined();
  });

  it("should extract code from error", () => {
    const error = { code: "invalid_api_key" };
    const result = getErrorCode(error);

    expect(result).toBe("invalid_api_key");
  });

  it("should return undefined when code is not a string", () => {
    const error = { code: 404 };
    const result = getErrorCode(error);

    expect(result).toBeUndefined();
  });

  it("should return undefined when code does not exist", () => {
    const error = { status: 404 };
    const result = getErrorCode(error);

    expect(result).toBeUndefined();
  });

  it("should handle various error codes", () => {
    expect(getErrorCode({ code: "invalid_api_key" })).toBe("invalid_api_key");
    expect(getErrorCode({ code: "rate_limit_exceeded" })).toBe(
      "rate_limit_exceeded"
    );
    expect(getErrorCode({ code: "insufficient_quota" })).toBe(
      "insufficient_quota"
    );
  });
});
