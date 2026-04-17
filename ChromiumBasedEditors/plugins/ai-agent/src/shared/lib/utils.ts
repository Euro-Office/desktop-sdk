// Re-export utilities from @onlyoffice/ai-chat
export {
  convertMessagesToMd,
  getMessageTitleFromMd,
  isDjVu,
  isDocument,
  isPdf,
  isPdfForm,
  isPresentation,
  isSpreadsheet,
  isVisio,
  isXps,
  sanitizeProviderName,
} from "@onlyoffice/ai-chat";

// Host-specific helpers — only meaningful in the ONLYOFFICE Desktop context
export const isDesktopEditor = (): boolean => {
  return typeof window !== "undefined" && "AscDesktopEditor" in window;
};

export const isExternalProcessAvailable = (): boolean => {
  return typeof window !== "undefined" && "ExternalProcess" in window;
};
