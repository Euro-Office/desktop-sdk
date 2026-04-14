// Re-export utilities from npm_lib
export {
  cn,
  isDjVu,
  isDocument,
  isPdf,
  isPdfForm,
  isPresentation,
  isSpreadsheet,
  isVisio,
  isXps,
  sanitizeProviderName,
} from "../../../npm_lib/lib/utils.ts";
export {
  convertMessagesToMd,
  getMessageTitleFromMd,
  removeSpecialCharacter,
} from "../../../npm_lib/utils.ts";

// Host-specific helpers — only meaningful in the ONLYOFFICE Desktop context
export const isDesktopEditor = (): boolean => {
  return typeof window !== "undefined" && "AscDesktopEditor" in window;
};

export const isExternalProcessAvailable = (): boolean => {
  return typeof window !== "undefined" && "ExternalProcess" in window;
};
