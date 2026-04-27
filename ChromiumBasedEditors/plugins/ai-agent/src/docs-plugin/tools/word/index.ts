import type { HostTool } from "@onlyoffice/ai-chat";
import { addImage } from "./addImage";
import { changeParagraphStyle } from "./changeParagraphStyle";
import { changeTextStyle } from "./changeTextStyle";
import { checkSpelling } from "./checkSpelling";
import { commentText } from "./commentText";
import { generateDocx } from "./generateDocx";
import { generateForm } from "./generateForm";
import { insertPage } from "./insertPage";
import { rewriteText } from "./rewriteText";
import { writeMacro } from "./writeMacro";

export const wordTools: HostTool[] = [
  insertPage,
  changeParagraphStyle,
  changeTextStyle,
  checkSpelling,
  rewriteText,
  commentText,
  generateDocx,
  generateForm,
  addImage,
  writeMacro,
];
