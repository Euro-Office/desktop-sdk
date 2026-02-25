export const deepseekInfo = {
  name: "DeepSeek",
  baseUrl: "https://api.deepseek.com",
  modelFilters: ["deepseek-chat", "deepseek-reasoner"] as string[], // Empty to show all models
  modelNames: {
    "deepseek-chat": "DeepsSeek Chat",
    "deepseek-reasoner": "DeepsSeek Reasoner",
  } as Record<string, string>,
};
