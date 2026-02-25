export const xaiInfo = {
  name: "xAI",
  baseUrl: "https://api.x.ai/v1",
  modelFilters: [
    "grok-4-1-fast-non-reasoning",
    "grok-4-1-fast-reasoning",
    "grok-4-0709",
  ] as string[],
  modelNames: {
    "grok-4-0709": "Grok 4",
    "grok-4-1-fast-non-reasoning": "Grok 4.1 Fast",
    "grok-4-1-fast-reasoning": "Grok 4.1 Fast Reasoning",
  } as Record<string, string>,
};
