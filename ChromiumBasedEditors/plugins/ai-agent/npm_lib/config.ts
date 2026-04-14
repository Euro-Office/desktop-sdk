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

export const MAX_TOOL_COUNT = 100;
export const MAX_TOOL_COUNT_WITH_WEB_SEARCH = MAX_TOOL_COUNT + 2;
