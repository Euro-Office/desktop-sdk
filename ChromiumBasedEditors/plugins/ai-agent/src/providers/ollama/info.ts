export const ollamaInfo = {
  name: "Ollama",
  baseUrl: "http://localhost:11434",
  modelFilters: [] as string[], // Ollama returns all local models
  modelNames: {} as Record<string, string>, // Ollama uses model.name from API
};
