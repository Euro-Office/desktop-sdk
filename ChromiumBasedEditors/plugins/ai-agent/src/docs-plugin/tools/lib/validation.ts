import { ToolError } from "./ToolError";

export function requireString(
  params: Record<string, unknown>,
  key: string
): string {
  const value = params[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ToolError(`Parameter "${key}" must be a non-empty string`);
  }
  return value;
}

export function optionalString(
  params: Record<string, unknown>,
  key: string
): string | undefined {
  const value = params[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ToolError(`Parameter "${key}" must be a string`);
  }
  return value;
}

export function requireNumber(
  params: Record<string, unknown>,
  key: string
): number {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToolError(`Parameter "${key}" must be a finite number`);
  }
  return value;
}

export function optionalNumber(
  params: Record<string, unknown>,
  key: string
): number | undefined {
  const value = params[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToolError(`Parameter "${key}" must be a finite number`);
  }
  return value;
}

export function requireInteger(
  params: Record<string, unknown>,
  key: string,
  opts: { min?: number; max?: number } = {}
): number {
  const value = requireNumber(params, key);
  if (!Number.isInteger(value)) {
    throw new ToolError(`Parameter "${key}" must be an integer`);
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new ToolError(`Parameter "${key}" must be >= ${opts.min}`);
  }
  if (opts.max !== undefined && value > opts.max) {
    throw new ToolError(`Parameter "${key}" must be <= ${opts.max}`);
  }
  return value;
}

export function requireEnum<T extends string>(
  params: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T {
  const value = requireString(params, key);
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ToolError(
      `Parameter "${key}" must be one of: ${allowed.join(", ")}`
    );
  }
  return value as T;
}

export function optionalEnum<T extends string>(
  params: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const value = params[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ToolError(`Parameter "${key}" must be a string`);
  }
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ToolError(
      `Parameter "${key}" must be one of: ${allowed.join(", ")}`
    );
  }
  return value as T;
}

export function optionalBoolean(
  params: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = params[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new ToolError(`Parameter "${key}" must be a boolean`);
  }
  return value;
}
