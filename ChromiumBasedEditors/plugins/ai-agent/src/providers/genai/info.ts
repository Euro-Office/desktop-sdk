export const genaiInfo = {
  name: "Google AI",
  baseUrl: "https://generativelanguage.googleapis.com",
  modelFilters: ["gemini-3-pro-preview", "gemini-3-flash-preview"],
  modelNames: {
    "gemini-3-pro-preview": "Gemini 3 Pro",
    "gemini-3-flash-preview": "Gemini 3 Flash",
  } as Record<string, string>,
};
