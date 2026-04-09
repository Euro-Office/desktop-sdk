export type TMCPItem = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  enabled?: boolean;
};

export type Thread = {
  threadId: string;
  title?: string;
  lastEditDate?: number;
  provider?: TProvider;
  model?: Model;
  profileId?: string;
};

export type ProviderType =
  | "anthropic"
  | "ollama"
  | "openai"
  | "openaicompatible"
  | "together"
  | "openrouter"
  | "genai"
  | "deepseek"
  | "xai"
  | "lm-studio"
  | "mistral"
  | "wallet";

export type Model = {
  id: string;
  name: string;
  provider: ProviderType;
  reasoning?: boolean;
};

export type TProvider = {
  type: ProviderType;
  name: string;
  key?: string;
  baseUrl: string;
};

export type PromptFolder = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type Prompt = {
  id: string;
  name: string;
  text: string;
  folderId?: string;
  createdAt: number;
  updatedAt: number;
};

export type TAttachmentFile = {
  path: string;
  content: string;
  type: number;
};

export type TAttachmentImage = {
  name: string;
  base64: string;
};

export type TProcess = {
  stdin: (data: string) => void;
  onprocess: (type: number, message: string) => void;
  end: () => void;
  start: () => void;
};

export type Profile = {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  key?: string;
  modelId: string;
  reasoning?: boolean;
};
