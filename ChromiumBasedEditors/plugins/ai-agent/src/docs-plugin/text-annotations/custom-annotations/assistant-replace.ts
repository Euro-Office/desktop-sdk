import { editor } from "../../library/editor";
import { prompts } from "../../library/prompts";
import type { PopupInfo } from "../annotation-popup";
import { CustomAnnotator } from "./custom-annotator";

interface ReplaceMatch {
  origin: string;
  suggestion: string;
  paragraph: number;
  occurrence: number;
  confidence: number;
}

interface ReplaceAnnotation {
  original: string;
  suggestion: string;
}

interface AnnotationRange {
  start: number;
  length: number;
  id: number;
}

export class AssistantReplace extends CustomAnnotator {
  protected _createPrompt(text: string): string {
    return prompts.getCustomAssistantReplacePrompt(
      text,
      this.assistantData.query
    );
  }

  protected _convertToRanges(
    paraId: string,
    text: string,
    matches: unknown[]
  ): AnnotationRange[] {
    let rangeId = 1;
    const ranges: AnnotationRange[] = [];
    for (const m of matches as ReplaceMatch[]) {
      const { origin, suggestion, occurrence, confidence } = m;
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
          this.paragraphs[paraId][rangeId] = {
            original: origin,
            suggestion,
          } satisfies ReplaceAnnotation;
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
      | ReplaceAnnotation
      | undefined;
    let suggested = annot?.suggestion ?? "";
    if (suggested.indexOf("</strong>") === -1) {
      suggested = `<strong>${suggested}</strong>`;
    }
    return {
      original: annot?.original ?? "",
      suggested,
    };
  }

  override async onAccept(paraId: string, rangeId: number): Promise<void> {
    await super.onAccept(paraId, rangeId);
    const annot = this.getAnnotation(paraId, rangeId) as unknown as
      | ReplaceAnnotation
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
