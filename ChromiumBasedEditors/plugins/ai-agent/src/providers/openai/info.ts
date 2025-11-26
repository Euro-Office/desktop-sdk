export const openaiInfo = {
  name: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  modelFilters: ["gpt-4.1", "gpt-5", "gpt-5.1-2025-11-13"],
  modelNames: {
    "gpt-4.1": "GPT-4.1",
    "gpt-5": "GPT-5",
    "gpt-5.1-2025-11-13": "GPT-5.1",
  } as Record<string, string>,
};
