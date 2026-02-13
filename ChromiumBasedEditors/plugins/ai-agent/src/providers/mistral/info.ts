export const mistralInfo = {
  name: "Mistral",
  baseUrl: "https://api.mistral.ai",
  modelFilters: [
    "mistral-large-latest",
    "mistral-medium-latest",
    "mistral-small-latest",
  ] as string[],
  modelNames: {
    "mistral-large-latest": "Mistral Large",
    "mistral-medium-latest": "Mistral Medium",
    "mistral-small-latest": "Mistral Small",
  } as Record<string, string>,
  reasoningModels: [
    ["small", "magistral-small-latest"],
    ["medium", "magistral-medium-latest"],
    ["large", "magistral-medium-latest"],
  ] as [string, string][],
};
