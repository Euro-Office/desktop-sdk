import type { HostToolGroup } from "@onlyoffice/ai-chat";
import { cellTools } from "./cell";
import { slideTools } from "./slide";
import { wordTools } from "./word";

export type EditorType = "word" | "cell" | "slide" | "pdf";

export function createHostToolGroups(editorType: EditorType): HostToolGroup[] {
  switch (editorType) {
    case "word":
      return [{ id: "word", name: "Word Tools", tools: wordTools }];
    case "slide":
      return [{ id: "slide", name: "Slide Tools", tools: slideTools }];
    case "cell":
      return [{ id: "cell", name: "Cell Tools", tools: cellTools }];
    default:
      return [];
  }
}
