export const togetherInfo = {
  name: "TogetherAI",
  baseUrl: "https://api.together.xyz/v1",
  modelFilters: ["deepseek-ai/DeepSeek-V3.1"],
  modelNames: {} as Record<string, string>, // Together uses display_name from API
};
