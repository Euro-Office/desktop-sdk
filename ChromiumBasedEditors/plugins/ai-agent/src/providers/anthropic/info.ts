export const anthropicInfo = {
  name: "Anthropic",
  baseUrl: "https://api.anthropic.com",
  modelNames: {} as Record<string, string>, // Anthropic uses display_name from API
  thinkingModels: ["claude-sonnet-4-5", "claude-opus-4-5"],
};
