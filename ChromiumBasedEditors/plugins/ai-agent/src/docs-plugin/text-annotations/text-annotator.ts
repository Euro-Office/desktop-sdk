import { editor } from "../library/editor";
import type { PopupInfo, TextAnnotationPopup } from "./annotation-popup";

interface ParagraphWait {
  recalcId: string;
  text: string;
}

export abstract class TextAnnotator {
  protected type = -1;
  protected paragraphs: Record<string, Record<number, unknown>> = {};
  protected waitParagraphs: Record<string, ParagraphWait> = {};
  protected paraToCheck: Set<string> = new Set();
  protected checked: Set<string> = new Set();
  protected annotatorPopup: TextAnnotationPopup;

  constructor(annotatorPopup: TextAnnotationPopup) {
    this.annotatorPopup = annotatorPopup;
  }

  async onChangeParagraph(
    paraId: string,
    recalcId: string,
    text: string,
    ranges: unknown[]
  ): Promise<boolean | null> {
    await this._handleNewRanges(ranges, paraId, text);
    this.waitParagraphs[paraId] = { recalcId, text };
    return this._checkParagraph(paraId);
  }

  async checkParagraphs(paraIds: string[]): Promise<Array<boolean | null>> {
    this.paraToCheck.clear();
    for (const paraId of paraIds) {
      if (!this.checked.has(paraId) || this.waitParagraphs[paraId]) {
        this.paraToCheck.add(paraId);
      }
    }
    const promises: Array<Promise<boolean | null>> = [];
    for (const paraId of this.paraToCheck) {
      promises.push(this._checkParagraph(paraId));
    }
    return Promise.all(promises);
  }

  private async _checkParagraph(paraId: string): Promise<boolean | null> {
    if (!this.paraToCheck.has(paraId) || !this.waitParagraphs[paraId]) {
      return false;
    }

    const { recalcId, text } = this.waitParagraphs[paraId];
    const baseRange = this.getAnnotationRangeObj(paraId);
    await editor.callMethod("RemoveAnnotationRange", [
      { ...baseRange, rangeId: undefined, all: true },
    ]);
    const isAnnotate = await this.annotateParagraph(paraId, recalcId, text);

    delete this.waitParagraphs[paraId];
    this.paraToCheck.delete(paraId);
    this.checked.add(paraId);

    return isAnnotate;
  }

  protected abstract annotateParagraph(
    paraId: string,
    recalcId: string,
    text: string
  ): Promise<boolean | null>;

  protected abstract getInfoForPopup(
    paraId: string,
    rangeId: number
  ): PopupInfo;

  abstract getAnnotationRangeObj(
    paraId: string,
    rangeId?: number
  ): Record<string, unknown>;

  protected abstract _handleNewRangePositions(
    range: unknown,
    paraId: string,
    text: string
  ): Promise<void>;

  async openPopup(paraId: string, rangeId: number): Promise<void> {
    const info = this.getInfoForPopup(paraId, rangeId);
    const opened = this.annotatorPopup.open(this.type, paraId, rangeId, info);
    if (!opened) return;
    this.annotatorPopup.onAcceptCallback = async () => {
      await this.onAccept(paraId, rangeId);
      this.closePopup();
    };
    this.annotatorPopup.onRejectCallback = async () => {
      await this.onReject(paraId, rangeId);
      this.closePopup();
    };
  }

  closePopup(): void {
    this.annotatorPopup.close(this.type);
  }

  async onAccept(_paraId: string, _rangeId: number): Promise<void> {
    // overridden by subclasses
  }

  async onReject(paraId: string, rangeId: number): Promise<void> {
    const range = this.getAnnotationRangeObj(paraId, rangeId);
    await editor.callMethod("RemoveAnnotationRange", [range]);
  }

  onClick(paraId: string, ranges: number[]): void {
    if (!ranges || !ranges.length) {
      this.closePopup();
    } else {
      void this.openPopup(paraId, ranges[0]);
    }
  }

  onBlur(): void {
    this.closePopup();
  }

  protected getAnnotation(
    paraId: string,
    rangeId: number
  ): Record<string, unknown> {
    if (
      !paraId ||
      !rangeId ||
      !this.paragraphs[paraId] ||
      !this.paragraphs[paraId][rangeId]
    ) {
      return {};
    }
    return this.paragraphs[paraId][rangeId] as Record<string, unknown>;
  }

  protected async chatRequest(
    prompt: string,
    profileId: string | null = null
  ): Promise<string | null> {
    const ai = window.AI;
    if (!ai) return null;
    const requestEngine = ai.Request.create(ai.ActionType.Chat, profileId);
    if (!requestEngine) return null;
    const response = await requestEngine.chatRequest(prompt, false);
    return this.normalizeResponse(response);
  }

  protected normalizeResponse(response: string): string {
    return window.Asc.Library?.getJSONResult(response) ?? response;
  }

  protected simpleGraphemeIndexOf(
    str: string,
    searchStr: string,
    fromIndex = 0
  ): number {
    let cuFrom = 0;
    let graphemeCount = 0;
    while (graphemeCount < fromIndex && cuFrom < str.length) {
      const code = str.charCodeAt(cuFrom);
      cuFrom++;
      if (code >= 0xd800 && code <= 0xdbff && cuFrom < str.length) {
        cuFrom++;
      }
      graphemeCount++;
    }

    const codeUnitIndex = str.indexOf(searchStr, cuFrom);
    if (codeUnitIndex < 2) return codeUnitIndex;

    let surrogateCount = 0;
    for (let i = 0; i < codeUnitIndex; i++) {
      const code = str.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) surrogateCount++;
    }
    return codeUnitIndex - surrogateCount;
  }

  private async _handleNewRanges(
    ranges: unknown[],
    paraId: string,
    text: string
  ): Promise<void> {
    if (!ranges || !Array.isArray(ranges)) return;
    await Promise.all(
      ranges.map((r) => this._handleNewRangePositions(r, paraId, text))
    );
  }
}
