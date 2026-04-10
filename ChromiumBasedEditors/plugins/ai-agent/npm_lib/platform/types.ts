import type { TMCPItem, TProcess } from "../types";

export interface PlatformFileOperations {
  /** Show a native file picker dialog and return selected file paths, or null if cancelled */
  pickFiles(): Promise<{ path: string; name: string }[] | null>;

  /** Show a native image picker dialog and return the image as base64, or null if cancelled */
  pickImage(): Promise<{ name: string; base64: string } | null>;

  /** Convert a file at the given path to plain text (e.g. DOCX/PDF → text). Returns content and ONLYOFFICE file type code */
  convertFileToText(path: string, format: number): Promise<string>;

  /** Determine the ONLYOFFICE file type code for a file at the given path */
  getFileType(path: string): number;

  /** Get a JSON string of recently opened files from the host editor */
  getRecentFiles(): Promise<string>;

  /** Show a "Save As" dialog and save content as a file (e.g. export message as DOCX) */
  saveAsFile(content: string, defaultName: string): Promise<void>;

  /** Open a file in the host editor by path */
  openFile(path: string, name: string): void;
}

export interface PlatformProcessRunner {
  /** Spawn an external process (used for MCP STDIO servers). Returns a process handle or null if unavailable */
  createProcess(command: string, env?: Record<string, string>): TProcess | null;

  /** Check whether external process spawning is supported in the current environment */
  isAvailable(): boolean;
}

export interface PlatformEnvironment {
  /** Current UI theme set by the host application */
  theme: string;

  /** OS-level system theme (may differ from the app theme) */
  systemTheme: "dark" | "light";

  /** Current locale/language code (e.g. "en", "ru", "de") */
  locale: string;

  /** Device pixel ratio for high-DPI rendering */
  devicePixelRatio: number;

  /** Subscribe to theme/language changes from the host. Returns an unsubscribe function */
  onEnvironmentChange?: (callback: (info: { theme?: string; lang?: string }) => void) => () => void;
}

export interface PlatformHostTools {
  /** Get the list of built-in tools provided by the host application (e.g. ONLYOFFICE editor tools) */
  getTools(): TMCPItem[];

  /** Execute a built-in host tool by name with the given arguments. Returns a JSON string result */
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}

export interface PlatformAdapter {
  /** File operations: picking, converting, saving, opening files via the host. If null — file attachment buttons and "Save as DOCX" are hidden */
  file: PlatformFileOperations | null;

  /** External process runner for MCP STDIO server transport. If null — only HTTP MCP servers are available */
  process: PlatformProcessRunner | null;

  /** Host environment info: theme, locale, pixel ratio, change events */
  env: PlatformEnvironment;

  /** Built-in tools exposed by the host application. If null — no host tools section in the tools list */
  hostTools: PlatformHostTools | null;
}
