export const ollamaInfo = {
  name: "Ollama",
  baseUrl: "http://localhost:11434/v1",
  modelFilters: [] as string[], // Ollama returns all local models
  modelNames: {} as Record<string, string>, // Ollama uses model.name from API
};
