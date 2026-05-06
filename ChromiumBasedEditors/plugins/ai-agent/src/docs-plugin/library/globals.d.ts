declare interface AscEditorStatic {
  callMethod<T = unknown>(name: string, args?: unknown[]): Promise<T>;
  callCommand<T = unknown>(func: () => T): Promise<T>;
  pause(msec: number): Promise<void>;
  getType(): "word" | "cell" | "slide" | "pdf";
}

declare interface AscLibraryInstance {
  GetEditorVersion(): Promise<number>;
  GetCurrentWord(): Promise<string>;
  GetSelectedText(): Promise<string>;
  GetFullText(): Promise<string>;
  GetSelectedContent(type: string): Promise<string>;
  GetSelectedImage(): Promise<string>;
  GetLocalImagePath(url: string): Promise<{ url: string; error: boolean }>;
  ReplaceTextSmart(text: string): Promise<void>;
  InsertAsText(text: string): Promise<void>;
  PasteText(text: string): Promise<void>;
  InsertAsComment(text: string): Promise<void>;
  InsertAsReview(content: string, isHtml?: boolean): Promise<void>;
  InsertAsHyperlink(content: string, hint: string): Promise<void>;
  InsertAsHTML(data: string): Promise<void>;
  // biome-ignore lint/suspicious/noExplicitAny: markdownit plugin type is external
  InsertAsMD(data: string, plugins?: any[]): Promise<void>;
  AddGeneratedImage(base64: string): Promise<void>;
  AddOleObject(imageUrl: string, data: unknown): Promise<void>;
  // biome-ignore lint/suspicious/noExplicitAny: markdownit plugin type is external
  ConvertMdToHTML(data: string, plugins?: any[], isStreaming?: boolean): string;
  // biome-ignore lint/suspicious/noExplicitAny: markdownit plugin type is external
  getHTMLFromMD(data: string, plugins?: any[], isStreaming?: boolean): string;
  getMarkdownResult(data: string, isStreaming?: boolean): string;
  getJSONResult(data: string): string;
  getTranslateResult(data: string, dataSrc: string): string;
  trimResult(
    data: string,
    posStart?: number,
    isSpaces?: boolean,
    extraCharacters?: string[]
  ): string;
  SendError(text: string, errorLevel?: unknown): Promise<void>;
}

declare interface AscPromptsStatic {
  getFixAndSpellPrompt(content: string): string;
  getSummarizationPrompt(content: string, language?: string): string;
  getTranslatePrompt(content: string, language: string): string;
  getExplainPrompt(content: string): string;
  getTextLongerPrompt(content: string): string;
  getTextShorterPrompt(content: string): string;
  getTextRewritePrompt(content: string): string;
  getTextKeywordsPrompt(content: string): string;
  getExplainAsLinkPrompt(content: string): string;
  getImageDescription(): string;
  getImagePromptOCR(): string;
}

declare interface AscPluginsMDStatic {
  // biome-ignore lint/suspicious/noExplicitAny: markdownit instance type is external
  latex(md: any): void;
  // biome-ignore lint/suspicious/noExplicitAny: markdownit instance type is external
  forms(md: any): void;
  // biome-ignore lint/suspicious/noExplicitAny: markdownit instance type is external
  hr(md: any): void;
}

declare interface AIRequestInstance {
  chatRequest(
    content: string,
    block?: boolean,
    streamFunc?: (delta: string, isFinal: boolean) => void | Promise<void>
  ): Promise<string>;
  imageGenerationRequest(
    prompt: string,
    width?: number,
    height?: number
  ): Promise<string>;
}

declare interface AIRequestFactoryStatic {
  create(action: string, profileId?: string | null): AIRequestInstance;
}

declare interface AIGlobal {
  ActionType: {
    readonly Chat: "Chat";
    readonly Translation: "Translation";
    readonly Summarization: "Summarization";
    readonly TextAnalyze: "TextAnalyze";
    readonly ImageGeneration: "ImageGeneration";
    readonly OCR: "OCR";
    readonly Vision: "Vision";
  };
  Request: AIRequestFactoryStatic;
}

interface Window {
  AI?: AIGlobal;
}
