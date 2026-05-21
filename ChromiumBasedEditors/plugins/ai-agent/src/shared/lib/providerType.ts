const CUSTOM_INTERNAL_PREFIX = "custom-internal:";
const CUSTOM_EXTERNAL_PREFIX = "custom-external:";

export function sanitizeProviderTypeName(name: string): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "unnamed";
}

export function customInternalProviderType(name: string): string {
  return CUSTOM_INTERNAL_PREFIX + sanitizeProviderTypeName(name);
}

export function customExternalProviderType(name: string): string {
  return CUSTOM_EXTERNAL_PREFIX + sanitizeProviderTypeName(name);
}

export function isCustomInternalProviderType(type: string): boolean {
  return type.startsWith(CUSTOM_INTERNAL_PREFIX);
}

export function isCustomExternalProviderType(type: string): boolean {
  return type.startsWith(CUSTOM_EXTERNAL_PREFIX);
}
