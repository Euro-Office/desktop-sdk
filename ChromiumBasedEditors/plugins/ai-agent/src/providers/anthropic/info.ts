export const anthropicInfo = {
  name: "Anthropic",
  baseUrl: "https://api.anthropic.com",
  modelFilters: ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-1"],
  modelNames: {} as Record<string, string>, // Anthropic uses display_name from API
};
