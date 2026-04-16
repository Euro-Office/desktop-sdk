import type { TCloud, TCloudKey } from "@onlyoffice/ai-chat";

export type {
  Model,
  Profile,
  Prompt,
  PromptFolder,
  ProviderType,
  TAttachmentFile,
  TAttachmentImage,
  TCloud,
  TCloudKey,
  TCloudProvider,
  Thread,
  TMCPItem,
  TProcess,
  TProvider,
} from "@onlyoffice/ai-chat";

export interface AscDesktopEditor {
  getOfficeFileType: (file: string) => number;
  getToolFunctions: () => string;
  callToolFunction: (name: string, args?: string) => Promise<string>;
  getClouds: () => TCloud[];
  getCloudKeys: () => TCloudKey[];
  openConnectCloud: () => void;
  openTemplate: (file: string, name: string) => void;
  saveAndOpen: (
    content: string,
    inputFormat: number,
    path: string,
    outputFormat: number,
    callback: (code: number) => void
  ) => void;
  OpenFilenameDialog: (
    initialPath: string,
    multiSelect: boolean,
    callback: (path: string | string[] | null) => void
  ) => void;
  convertFileExternal: (
    file: string,
    format: number,
    callback: (data: { content: ArrayBuffer }, error?: unknown) => void
  ) => void;
  SaveFilenameDialog: (
    fileName: string,
    callback: (path: string | null) => void,
    content?: string
  ) => void;
}
