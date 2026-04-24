import type { HostTool } from "@onlyoffice/ai-chat";
import { changeParagraphStyle } from "./changeParagraphStyle";
import { changeTextStyle } from "./changeTextStyle";
import { insertPage } from "./insertPage";

export const wordTools: HostTool[] = [
  insertPage,
  changeParagraphStyle,
  changeTextStyle,
];
