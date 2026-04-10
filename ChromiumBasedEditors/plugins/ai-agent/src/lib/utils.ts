import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Re-export generic message utilities from npm_lib
export {
  convertMessagesToMd,
  getMessageTitleFromMd,
  removeSpecialCharacter,
} from "../../npm_lib/utils";

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const sanitizeProviderName = (str: string) => {
  // Inline — removeSpecialCharacter is re-exported above but we avoid importing
  // from the same file to keep it simple
  return str.replace(/[\\/:*"<>|?]/g, "");
};

export const isDocument = (type: number) => {
  return !!(type & 0x40);
};

export const isPresentation = (type: number) => {
  return !!(type & 0x80);
};

export const isSpreadsheet = (type: number) => {
  return !!(type & 0x0100);
};

export const isPdf = (type: number) => {
  return type === 0x0201 || type === 0x0209;
};

export const isDjVu = (type: number) => {
  return type === 0x0203;
};

export const isXps = (type: number) => {
  return type === 0x0204;
};

export const isPdfForm = (type: number) => {
  return type === 0x0057;
};

export const isVisio = (type: number) => {
  return !!(type & 0x4000);
};

export const isDesktopEditor = (): boolean => {
  return typeof window !== "undefined" && "AscDesktopEditor" in window;
};

export const isExternalProcessAvailable = (): boolean => {
  return typeof window !== "undefined" && "ExternalProcess" in window;
};
