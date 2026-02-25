export const openaicompatibleInfo = {
  name: "OpenAI Compatible",
  baseUrl: "",
  modelFilters: [] as string[], // No filters - returns all models from the API
  modelNames: {} as Record<string, string>, // Uses model ID from API
};
