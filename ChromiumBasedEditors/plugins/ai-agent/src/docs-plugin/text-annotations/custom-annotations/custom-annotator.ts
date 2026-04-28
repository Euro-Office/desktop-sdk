import { editor } from "../../library/editor";
import type { PopupInfo, TextAnnotationPopup } from "../annotation-popup";
import { TextAnnotator } from "../text-annotator";

export interface CustomAssistantData {
  id: string;
  name: string;
  type: 0 | 1 | 2;
  query: string;
}

interface AnnotationRange {
  start: number;
  length: number;
  id: number;
}

export abstract class CustomAnnotator extends TextAnnotator {
  protected assistantData: CustomAssistantData;
  protected _skipNextChangeParagraph = false;
  private _lastUsedPrompt = "";

  constructor(
    annotatorPopup: TextAnnotationPopup,
    assistantData: CustomAssistantData
  ) {
    super(annotatorPopup);
    this.assistantData = assistantData;
    this.type = assistantData.type;
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

    const response = await this.chatRequest(argPrompt);

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

  override async checkParagraphs(
    paraIds: string[]
  ): Promise<Array<boolean | null>> {
    if (this._skipNextChangeParagraph) {
      this._skipNextChangeParagraph = false;
      return paraIds.map(() => false);
    }
    return super.checkParagraphs(paraIds);
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

  override async onAccept(_paraId: string, _rangeId: number): Promise<void> {
    if (this.type !== 0) {
      this._skipNextChangeParagraph = true;
    }
  }

  protected abstract getInfoForPopup(
    paraId: string,
    rangeId: number
  ): PopupInfo;

  private _getAnnotationName(): string {
    return `customAssistant_${this.assistantData.id}`;
  }
}
