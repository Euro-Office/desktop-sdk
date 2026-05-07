export const CUSTOM_ASSISTANT_TYPE = {
  hint: 0,
  replaceHint: 1,
  replace: 2,
} as const;

export type CustomAssistantType =
  (typeof CUSTOM_ASSISTANT_TYPE)[keyof typeof CUSTOM_ASSISTANT_TYPE];

export interface CustomAssistant {
  id: string;
  name: string;
  query: string;
  type: CustomAssistantType;
  profileId: string | null;
}

export interface HintMatch {
  origin: string;
  reason: string;
  paragraph: number;
  occurrence: number;
  confidence: number;
}

export interface ReplaceMatch {
  origin: string;
  suggestion: string;
  paragraph: number;
  occurrence: number;
  confidence: number;
}

export interface ReplaceHintMatch extends ReplaceMatch {
  reason: string;
  difference: string;
}

export const ANNOTATION_NAME_PREFIX = "customAssistant_";
