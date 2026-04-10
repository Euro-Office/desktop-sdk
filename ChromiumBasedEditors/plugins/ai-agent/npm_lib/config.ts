export interface StoreKeys {
  defaultProfile: string;
  chatProfile: string;
  summarizationProfile: string;
  translationProfile: string;
  textAnalysisProfile: string;
  imageGenerationProfile: string;
  ocrProfile: string;
  visionProfile: string;
  deepMode: string;
  mcpServers: string;
  disabledTools: string;
}

export const DEFAULT_STORE_KEYS: StoreKeys = {
  defaultProfile: "default-profile",
  chatProfile: "chat-profile",
  summarizationProfile: "summarization-profile",
  translationProfile: "translation-profile",
  textAnalysisProfile: "text-analysis-profile",
  imageGenerationProfile: "image-generation-profile",
  ocrProfile: "ocr-profile",
  visionProfile: "vision-profile",
  deepMode: "deep-mode",
  mcpServers: "mcpServers",
  disabledTools: "disabledTools",
};

export interface FeatureFlags {
  showWallet: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  showWallet: false,
};

export const MAX_TOOL_COUNT = 100;
export const MAX_TOOL_COUNT_WITH_WEB_SEARCH = MAX_TOOL_COUNT + 2;
