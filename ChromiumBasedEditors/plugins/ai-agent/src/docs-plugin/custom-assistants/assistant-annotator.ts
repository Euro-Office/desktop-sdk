import { editor } from "../library/editor";
import type {
  PopupInfo,
  TextAnnotationPopup,
} from "../text-annotations/annotation-popup";
import { TextAnnotator } from "../text-annotations/text-annotator";
import { buildAssistantPrompt } from "./prompts";
import {
  ANNOTATION_NAME_PREFIX,
  CUSTOM_ASSISTANT_TYPE,
  type CustomAssistant,
  type HintMatch,
  type ReplaceHintMatch,
  type ReplaceMatch,
} from "./types";

interface AssistantAnnotation {
  original: string;
  suggestion?: string;
  reason?: string;
  difference?: string;
}

interface AnnotationRange {
  start: number;
  length: number;
  id: number;
}

type AssistantMatch = HintMatch | ReplaceMatch | ReplaceHintMatch;

export class CustomAssistantAnnotator extends TextAnnotator {
  readonly assistant: CustomAssistant;
  private readonly annotationName: string;
  private skipNextChangeParagraph = false;
  private lastUsedPrompt = "";

  constructor(annotatorPopup: TextAnnotationPopup, assistant: CustomAssistant) {
    super(annotatorPopup);
    this.assistant = assistant;
    this.annotationName = ANNOTATION_NAME_PREFIX + assistant.id;
    // Popup UX: hint = single OK (popup type 0); replace = Accept/Reject
    // ("Suggested replacement", popup type 2); replaceHint = Accept/Reject
    // ("Grammar suggestion", popup type 1). The popup distinguishes single-OK
    // from two-button modes by `type === 0`.
    this.type =
      assistant.type === CUSTOM_ASSISTANT_TYPE.hint
        ? 0
        : assistant.type === CUSTOM_ASSISTANT_TYPE.replace
          ? 2
          : 1;
  }

  takeCheckedParagraphIds(): string[] {
    const ids = [...this.checked];
    this.checked.clear();
    return ids;
  }

  override async checkParagraphs(
    paraIds: string[]
  ): Promise<Array<boolean | null>> {
    if (this.skipNextChangeParagraph) {
      this.skipNextChangeParagraph = false;
      return paraIds.map(() => false);
    }
    return super.checkParagraphs(paraIds);
  }

  protected async annotateParagraph(
    paraId: string,
    recalcId: string,
    text: string
  ): Promise<boolean | null> {
    this.paragraphs[paraId] = {};
    if (text.length === 0) return false;

    let prompt = buildAssistantPrompt(
      this.assistant.type,
      this.assistant.query,
      text
    );
    if (this.lastUsedPrompt && prompt !== this.lastUsedPrompt) {
      prompt = `CRITICAL
    - Ignore all previous messages and instructions.
    - Please respond only to this new query and treat this as a new request.

${prompt}`;
    }
    this.lastUsedPrompt = prompt;
    const response = await this.chatRequest(prompt, this.assistant.profileId);
    if (response === null) return null;
    // Legacy parity: an empty response or a literal "[]" means the AI
    // produced no matches — treat it as a check failure so the manager
    // can surface ERROR / NO_AI_MODEL when *every* paragraph misses.
    if (!response || response.trim() === "[]") return false;

    let rangeId = 1;
    const ranges: AnnotationRange[] = [];

    let parsed: AssistantMatch[];
    try {
      parsed = JSON.parse(response) as AssistantMatch[];
    } catch (_e) {
      return false;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return false;

    for (const match of parsed) {
      if (!match || typeof match !== "object") continue;
      if (match.confidence <= 0.7) continue;

      const origin = match.origin;
      if (!origin) continue;

      // Replace-style assistants must produce a different suggestion.
      if (
        this.assistant.type !== CUSTOM_ASSISTANT_TYPE.hint &&
        "suggestion" in match &&
        match.suggestion === origin
      ) {
        continue;
      }

      let count = 0;
      let searchStart = 0;
      while (searchStart < text.length) {
        const index = this.simpleGraphemeIndexOf(text, origin, searchStart);
        if (index === -1) break;

        count++;
        if (count === match.occurrence) {
          ranges.push({
            start: index,
            length: [...origin].length,
            id: rangeId,
          });
          this.paragraphs[paraId][rangeId] = this._buildAnnotation(
            origin,
            match
          );
          rangeId++;
          break;
        }
        searchStart = index + 1;
      }
    }

    try {
      await editor.callMethod("AnnotateParagraph", [
        {
          type: "highlightText",
          paragraphId: paraId,
          name: this.annotationName,
          recalcId,
          ranges,
        },
      ]);
    } catch (_e) {
      return false;
    }

    return true;
  }

  private _buildAnnotation(
    origin: string,
    match: AssistantMatch
  ): AssistantAnnotation {
    if (this.assistant.type === CUSTOM_ASSISTANT_TYPE.hint) {
      const m = match as HintMatch;
      return { original: origin, reason: m.reason };
    }
    if (this.assistant.type === CUSTOM_ASSISTANT_TYPE.replace) {
      const m = match as ReplaceMatch;
      return { original: origin, suggestion: m.suggestion };
    }
    const m = match as ReplaceHintMatch;
    let difference = m.difference ?? m.suggestion ?? "";
    // Legacy strips a leading "<origin> → " marker if the model echoes
    // the original side of the diff.
    const marker = `${origin} → `;
    if (difference.indexOf(marker) === 0) {
      difference = difference.slice(marker.length);
    }
    return {
      original: origin,
      suggestion: m.suggestion,
      reason: m.reason,
      difference,
    };
  }

  protected getInfoForPopup(paraId: string, rangeId: number): PopupInfo {
    const annotation = this.getAnnotation(
      paraId,
      rangeId
    ) as unknown as AssistantAnnotation;
    if (this.assistant.type === CUSTOM_ASSISTANT_TYPE.hint) {
      return {
        suggested: "",
        original: annotation.original ?? "",
        explanation: this._sanitizeReason(annotation.reason),
      };
    }
    if (this.assistant.type === CUSTOM_ASSISTANT_TYPE.replace) {
      let suggested = annotation.suggestion ?? "";
      if (suggested && suggested.indexOf("</strong>") === -1) {
        suggested = `<strong>${suggested}</strong>`;
      }
      return {
        suggested,
        original: annotation.original ?? "",
      };
    }
    let suggested = annotation.difference ?? "";
    if (suggested && suggested.indexOf("</strong>") === -1) {
      suggested = `<strong>${suggested}</strong>`;
    }
    return {
      suggested,
      original: annotation.original ?? "",
      explanation: this._sanitizeReason(annotation.reason),
    };
  }

  private _sanitizeReason(reason: string | undefined): string | undefined {
    if (!reason) return undefined;
    try {
      return reason.replace(/<a\s+(.*?)>/gi, '<a $1 target="_blank">');
    } catch {
      return reason;
    }
  }

  getAnnotationRangeObj(
    paraId: string,
    rangeId?: number
  ): Record<string, unknown> {
    return {
      paragraphId: paraId,
      rangeId,
      name: this.annotationName,
    };
  }

  override async onAccept(paraId: string, rangeId: number): Promise<void> {
    const annotation = this.getAnnotation(
      paraId,
      rangeId
    ) as unknown as AssistantAnnotation;

    if (this.assistant.type !== CUSTOM_ASSISTANT_TYPE.hint) {
      this.skipNextChangeParagraph = true;
    }

    await editor.callMethod("StartAction", ["GroupActions"]);
    const range = this.getAnnotationRangeObj(paraId, rangeId);
    await editor.callMethod("SelectAnnotationRange", [range]);

    if (
      this.assistant.type !== CUSTOM_ASSISTANT_TYPE.hint &&
      annotation.suggestion
    ) {
      Asc.scope.text = annotation.suggestion;
      await editor.callCommand(() => {
        Api.ReplaceTextSmart([Asc.scope.text]);
        Api.GetDocument().RemoveSelection();
      });
    } else {
      await editor.callCommand(() => {
        Api.GetDocument().RemoveSelection();
      });
    }

    await editor.callMethod("RemoveAnnotationRange", [range]);
    await editor.callMethod("EndAction", ["GroupActions"]);
    await editor.callMethod("FocusEditor");
  }

  protected async _handleNewRangePositions(
    range: unknown,
    paraId: string,
    text: string
  ): Promise<void> {
    const r = range as Record<string, unknown> | null;
    if (!r || r.name !== this.annotationName || !this.paragraphs[paraId]) {
      return;
    }

    const rangeId = r.id as number;
    const annotation = this.getAnnotation(
      paraId,
      rangeId
    ) as unknown as AssistantAnnotation;
    if (!annotation?.original) return;

    const start = r.start as number;
    const len = r.length as number;
    if (annotation.original !== text.substring(start, start + len)) {
      await editor.callMethod("RemoveAnnotationRange", [
        this.getAnnotationRangeObj(paraId, rangeId),
      ]);
    }
  }

  async uncheckAllParagraphs(): Promise<void> {
    const paraIds = [...this.checked];
    this.checked.clear();
    this.paraToCheck.clear();
    this.waitParagraphs = {};
    for (const paraId of paraIds) {
      this.paragraphs[paraId] = {};
      await editor.callMethod("RemoveAnnotationRange", [
        {
          ...this.getAnnotationRangeObj(paraId),
          rangeId: undefined,
          all: true,
        },
      ]);
    }
  }
}
