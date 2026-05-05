import type {
  CustomAiAction,
  CustomAiActionType,
} from "../../ai-actions/types";
import { editor } from "../../library/editor";
import type { PopupInfo, TextAnnotationPopup } from "../annotation-popup";
import { TextAnnotator } from "../text-annotator";

interface AnnotationRange {
  start: number;
  length: number;
  id: number;
}

const TYPE_TO_CODE: Record<CustomAiActionType, number> = {
  hint: 0,
  "replace-hint": 1,
  replace: 2,
  "in-chat": 3,
  "replace-in-chat": 4,
  "as-review": 5,
};

export const ACTION_ANNOTATION_PREFIX = "customAction_";

export abstract class CustomActionAnnotator extends TextAnnotator {
  protected action: CustomAiAction;
  private _lastUsedPrompt = "";
  // Latest known text/recalcId per paragraph, mirrored from
  // onChangeParagraph. Unlike TextAnnotator.waitParagraphs (which
  // is consumed per check cycle), this map persists so that repeated
  // one-shot runs of the same action work without requiring the user
  // to edit the paragraph between runs.
  private _latestParagraphs = new Map<
    string,
    { recalcId: string; text: string }
  >();

  constructor(annotatorPopup: TextAnnotationPopup, action: CustomAiAction) {
    super(annotatorPopup);
    this.action = action;
    this.type = TYPE_TO_CODE[action.type];
  }

  /**
   * Move the cached per-paragraph text from another annotator into this
   * one. Called on action update so the replacement instance keeps the
   * history that the editor pushed via `onParagraphText` — otherwise the
   * first run after an edit would have nothing to feed `waitParagraphs`.
   */
  inheritParagraphCache(other: CustomActionAnnotator): void {
    for (const [paraId, entry] of other._latestParagraphs) {
      this._latestParagraphs.set(paraId, entry);
    }
  }

  override async onChangeParagraph(
    paraId: string,
    recalcId: string,
    text: string,
    ranges: unknown[]
  ): Promise<boolean | null> {
    this._latestParagraphs.set(paraId, { recalcId, text });
    // Custom actions are one-shot — an edit must not auto-trigger a
    // chat request. The base `_checkParagraph` will fire one if a
    // stale paraToCheck entry from a prior run is still around, so
    // drop it here before delegating.
    this.paraToCheck.delete(paraId);
    return super.onChangeParagraph(paraId, recalcId, text, ranges);
  }

  override async checkParagraphs(
    paraIds: string[]
  ): Promise<Array<boolean | null>> {
    // Each run is a fresh one-shot: re-seed waitParagraphs from the
    // persistent cache and clear `checked` so the base implementation
    // does not skip paragraphs it has already processed in a prior run.
    for (const paraId of paraIds) {
      const latest = this._latestParagraphs.get(paraId);
      if (latest && !this.waitParagraphs[paraId]) {
        this.waitParagraphs[paraId] = {
          recalcId: latest.recalcId,
          text: latest.text,
        };
      }
      this.checked.delete(paraId);
    }
    const result = await super.checkParagraphs(paraIds);
    // Drop any paraIds the base left in paraToCheck (those whose
    // waitParagraphs was empty); otherwise the next edit on one of
    // them would auto-trigger a chat request via `_checkParagraph`.
    this.paraToCheck.clear();
    return result;
  }

  protected abstract _createPrompt(text: string): string;

  protected abstract _convertToRanges(
    paraId: string,
    text: string,
    matches: unknown[]
  ): AnnotationRange[];

  protected async annotateParagraph(
    paraId: string,
    recalcId: string,
    text: string
  ): Promise<boolean | null> {
    this.paragraphs[paraId] = {};
    if (text.length === 0) return false;

    let argPrompt = this._createPrompt(text);

    if (this._lastUsedPrompt && argPrompt !== this._lastUsedPrompt) {
      const resetInstruction = `CRITICAL
                    - Ignore all previous messages and instructions.
                    - Please respond only to this new query and treat this as a new request.

                    `;
      argPrompt = resetInstruction + argPrompt;
    }
    this._lastUsedPrompt = argPrompt;

    const response = await this.chatRequest(
      argPrompt,
      this.action.profileId ?? null
    );

    if (!response || response === "[]") {
      if (response === null) return null;
      return false;
    }

    try {
      const ranges = this._convertToRanges(
        paraId,
        text,
        JSON.parse(response) as unknown[]
      );
      await editor.callMethod("AnnotateParagraph", [
        {
          type: "highlightText",
          paragraphId: paraId,
          name: this._getAnnotationName(),
          recalcId,
          ranges,
        },
      ]);
    } catch (_e) {
      return false;
    }

    return true;
  }

  async uncheckParagraphs(paraIds: string[]): Promise<unknown[]> {
    const promises: Promise<unknown>[] = [];
    for (const paraId of paraIds) {
      promises.push(
        editor.callMethod("RemoveAnnotationRange", [
          {
            all: true,
            paragraphId: paraId,
            rangeId: undefined,
            name: this._getAnnotationName(),
          },
        ])
      );
    }
    return Promise.all(promises);
  }

  getAnnotationRangeObj(
    paraId: string,
    rangeId?: number
  ): Record<string, unknown> {
    return {
      paragraphId: paraId,
      rangeId,
      name: this._getAnnotationName(),
    };
  }

  protected async _handleNewRangePositions(
    range: unknown,
    paraId: string,
    text: string
  ): Promise<void> {
    const r = range as Record<string, unknown> | null;
    if (
      !r ||
      r.name !== this._getAnnotationName() ||
      !this.paragraphs[paraId]
    ) {
      return;
    }

    const rangeId = r.id as number;
    const annotation = this.getAnnotation(paraId, rangeId) as {
      original?: string;
    };
    if (!annotation?.original) return;

    const start = r.start as number;
    const len = r.length as number;

    if (annotation.original !== text.substring(start, start + len)) {
      await editor.callMethod("RemoveAnnotationRange", [
        this.getAnnotationRangeObj(paraId, rangeId),
      ]);
    }
  }

  protected abstract getInfoForPopup(
    paraId: string,
    rangeId: number
  ): PopupInfo;

  private _getAnnotationName(): string {
    return `${ACTION_ANNOTATION_PREFIX}${this.action.id}`;
  }
}
