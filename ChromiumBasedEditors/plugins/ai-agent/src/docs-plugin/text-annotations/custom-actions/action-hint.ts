import { editor } from "../../library/editor";
import { prompts } from "../../library/prompts";
import type { PopupInfo } from "../annotation-popup";
import {
  appendAdditionalInstruction,
  CustomActionAnnotator,
} from "./action-annotator";

interface HintMatch {
  origin: string;
  reason: string;
  paragraph: number;
  occurrence: number;
  confidence: number;
}

interface HintAnnotation {
  original: string;
  reason: string;
}

interface AnnotationRange {
  start: number;
  length: number;
  id: number;
}

export class ActionHint extends CustomActionAnnotator {
  protected _createPrompt(text: string): string {
    const base = prompts.getActionHintPrompt(text, this.action.query);
    return appendAdditionalInstruction(base, this.action.additionalAction);
  }

  protected _convertToRanges(
    paraId: string,
    text: string,
    matches: unknown[]
  ): AnnotationRange[] {
    let rangeId = 1;
    const ranges: AnnotationRange[] = [];
    for (const m of matches as HintMatch[]) {
      const { origin, reason, occurrence, confidence } = m;
      if (confidence <= 0.7) continue;

      let count = 0;
      let searchStart = 0;
      while (searchStart < text.length) {
        const index = this.simpleGraphemeIndexOf(text, origin, searchStart);
        if (index === -1) break;
        count++;
        if (count === occurrence) {
          ranges.push({
            start: index,
            length: [...origin].length,
            id: rangeId,
          });
          this.paragraphs[paraId][rangeId] = {
            original: origin,
            reason,
          } satisfies HintAnnotation;
          rangeId++;
          break;
        }
        searchStart = index + 1;
      }
    }
    return ranges;
  }

  protected getInfoForPopup(paraId: string, rangeId: number): PopupInfo {
    const annot = this.getAnnotation(paraId, rangeId) as unknown as
      | HintAnnotation
      | undefined;
    let reason = annot?.reason ?? "";
    try {
      reason = reason.replace(/<a\s+(.*?)>/gi, '<a $1 target="_blank">');
    } catch (e) {
      console.error(e);
    }
    return {
      original: annot?.original ?? "",
      suggested: "",
      explanation: reason,
    };
  }

  override async onAccept(paraId: string, rangeId: number): Promise<void> {
    await editor.callMethod("StartAction", ["GroupActions"]);

    const range = this.getAnnotationRangeObj(paraId, rangeId);
    await editor.callMethod("SelectAnnotationRange", [range]);

    await editor.callCommand(() => {
      Api.GetDocument().RemoveSelection();
    });

    await editor.callMethod("RemoveAnnotationRange", [range]);
    await editor.callMethod("EndAction", ["GroupActions"]);
    await editor.callMethod("FocusEditor");
  }
}
