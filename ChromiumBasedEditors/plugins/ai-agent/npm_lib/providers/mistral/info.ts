export const mistralInfo = {
  name: "Mistral",
  baseUrl: "https://api.mistral.ai",
  reasoningModels: [
    ["small", "magistral-small-latest"],
    ["medium", "magistral-medium-latest"],
    ["large", "magistral-medium-latest"],
  ] as [string, string][],
};
