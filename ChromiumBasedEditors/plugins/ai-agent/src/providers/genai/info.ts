export const genaiInfo = {
  name: "Google AI",
  baseUrl: "https://generativelanguage.googleapis.com",
  modelFilters: [
    // Gemini 2.5
    "gemini-2.5-pro",
    "gemini-2.5-pro-preview",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    // Gemini 3
    "gemini-3-pro-preview",
    // Latest aliases
    "gemini-pro-latest",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
  ],
  modelNames: {} as Record<string, string>,
};
