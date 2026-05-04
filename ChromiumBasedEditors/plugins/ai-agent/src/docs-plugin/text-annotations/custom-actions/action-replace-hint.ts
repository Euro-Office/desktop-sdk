import { editor } from "../../library/editor";
import { prompts } from "../../library/prompts";
import type { PopupInfo } from "../annotation-popup";
import {
  appendAdditionalInstruction,
  CustomActionAnnotator,
} from "./action-annotator";

interface ReplaceHintMatch {
  origin: string;
  suggestion: string;
  difference: string;
  reason: string;
  paragraph: number;
  occurrence: number;
  confidence: number;
}

interface ReplaceHintAnnotation {
  original: string;
  suggestion: string;
  difference: string;
  reason: string;
}

interface AnnotationRange {
  start: number;
  length: number;
  id: number;
}

export class ActionReplaceHint extends CustomActionAnnotator {
  protected _createPrompt(text: string): string {
    const base = prompts.getActionReplaceHintPrompt(text, this.action.query);
    return appendAdditionalInstruction(base, this.action.additionalAction);
  }

  protected _convertToRanges(
    paraId: string,
    text: string,
    matches: unknown[]
  ): AnnotationRange[] {
    let rangeId = 1;
    const ranges: AnnotationRange[] = [];
    for (const m of matches as ReplaceHintMatch[]) {
      const { origin, suggestion, reason, occurrence, confidence } = m;
      let { difference } = m;
      if (origin === suggestion || confidence <= 0.7) continue;

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
          if (difference?.indexOf(`${origin} → `) === 0) {
            difference = difference.slice(origin.length + 3);
          }
          this.paragraphs[paraId][rangeId] = {
            original: origin,
            suggestion,
            difference: difference ?? "",
            reason: reason ?? "",
          } satisfies ReplaceHintAnnotation;
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
      | ReplaceHintAnnotation
      | undefined;
    let reason = annot?.reason ?? "";
    try {
      reason = reason.replace(/<a\s+(.*?)>/gi, '<a $1 target="_blank">');
    } catch (e) {
      console.error(e);
    }
    let suggested = annot?.difference ?? "";
    if (suggested.indexOf("</strong>") === -1) {
      suggested = `<strong>${suggested}</strong>`;
    }
    return {
      original: annot?.original ?? "",
      suggested,
      explanation: reason,
    };
  }

  override async onAccept(paraId: string, rangeId: number): Promise<void> {
    const annot = this.getAnnotation(paraId, rangeId) as unknown as
      | ReplaceHintAnnotation
      | undefined;
    const text = annot?.suggestion ?? "";
    if (!text) return;

    await editor.callMethod("StartAction", ["GroupActions"]);

    const range = this.getAnnotationRangeObj(paraId, rangeId);
    await editor.callMethod("SelectAnnotationRange", [range]);

    Asc.scope.text = text;
    await editor.callCommand(() => {
      Api.ReplaceTextSmart([Asc.scope.text]);
      Api.GetDocument().RemoveSelection();
    });

    await editor.callMethod("RemoveAnnotationRange", [range]);
    await editor.callMethod("EndAction", ["GroupActions"]);
    await editor.callMethod("FocusEditor");
  }
}
