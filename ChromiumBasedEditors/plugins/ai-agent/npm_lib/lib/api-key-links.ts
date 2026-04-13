/**
 * API key registration links for all providers.
 * Key is the provider identifier (ProviderType for AI providers, provider name for web search).
 */
const apiKeyLinks: Record<string, string> = {
  // AI model providers
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  deepseek: "https://platform.deepseek.com/api_keys",
  genai: "https://aistudio.google.com/apikey",
  mistral: "https://console.mistral.ai/api-keys",
  openrouter: "https://openrouter.ai/keys",
  together: "https://api.together.ai/settings/api-keys",
  xai: "https://console.x.ai",
  groq: "https://console.groq.com/keys",
  zhipu: "https://open.bigmodel.cn/usercenter/apikeys",
  stabilityai: "https://platform.stability.ai/account/keys",

  // Web search providers
  Exa: "https://dashboard.exa.ai/api-keys",
};

export const getApiKeyLink = (provider: string): string | undefined => {
  return apiKeyLinks[provider];
};
