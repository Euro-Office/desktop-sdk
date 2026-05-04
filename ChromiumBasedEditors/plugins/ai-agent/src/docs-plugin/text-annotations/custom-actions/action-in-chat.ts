import type { PopupInfo } from "../annotation-popup";
import { CustomActionAnnotator } from "./action-annotator";

interface AnnotationRange {
  start: number;
  length: number;
  id: number;
}

// In-chat actions don't annotate the document. The toolbar handler in
// main.tsx forwards the prompt + selection to the chat panel and never
// invokes the annotation pipeline, so the abstract hooks below are
// unreachable in practice.
export class ActionInChat extends CustomActionAnnotator {
  protected _createPrompt(_text: string): string {
    return "";
  }

  protected _convertToRanges(
    _paraId: string,
    _text: string,
    _matches: unknown[]
  ): AnnotationRange[] {
    return [];
  }

  protected getInfoForPopup(_paraId: string, _rangeId: number): PopupInfo {
    return { original: "", suggested: "" };
  }

  override async checkParagraphs(
    _paraIds: string[]
  ): Promise<Array<boolean | null>> {
    return [];
  }

  override async onChangeParagraph(): Promise<boolean | null> {
    return false;
  }
}
