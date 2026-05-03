import type { TextAnnotationPopup } from "../annotation-popup";
import { AssistantHint } from "./assistant-hint";
import { AssistantReplace } from "./assistant-replace";
import { AssistantReplaceHint } from "./assistant-replace-hint";
import type { CustomAnnotator, CustomAssistantData } from "./custom-annotator";

export const CUSTOM_ASSISTANT_STATUSES = {
  OK: 0,
  NOT_FOUND: 1,
  ERROR: 2,
  NO_AI_MODEL_SELECTED: 3,
} as const;

export type CustomAssistantStatus =
  (typeof CUSTOM_ASSISTANT_STATUSES)[keyof typeof CUSTOM_ASSISTANT_STATUSES];

interface ParagraphCacheEntry {
  recalcId: string;
  text: string;
  annotations: unknown[];
}

const ANNOTATION_PREFIX = "customAssistant_";

export class CustomAssistantManager {
  private _assistants = new Map<string, CustomAnnotator>();
  private _trackChanges = new Map<string, boolean>();
  private _running = new Map<string, boolean>();
  private _paragraphsStack = new Map<string, ParagraphCacheEntry>();
  private _popup: TextAnnotationPopup;

  constructor(popup: TextAnnotationPopup) {
    this._popup = popup;
  }

  createAssistant(
    data: CustomAssistantData,
    isForUpdate = false
  ): CustomAnnotator {
    let assistant: CustomAnnotator;
    switch (data.type) {
      case 0:
        assistant = new AssistantHint(this._popup, data);
        break;
      case 1:
        assistant = new AssistantReplaceHint(this._popup, data);
        break;
      case 2:
        assistant = new AssistantReplace(this._popup, data);
        break;
      default:
        throw new Error(`Unknown custom assistant type: ${data.type}`);
    }

    this._assistants.set(data.id, assistant);
    if (!isForUpdate) {
      this._trackChanges.set(data.id, false);
      this._running.set(data.id, false);
    }
    return assistant;
  }

  updateAssistant(data: CustomAssistantData): CustomAnnotator {
    const old = this._assistants.get(data.id);
    if (!old) throw new Error(`Custom assistant not found: ${data.id}`);

    const isRunning = this._running.get(data.id) ?? false;
    const next = this.createAssistant(data, isRunning);
    if (!isRunning) return next;

    for (const [paraId, value] of this._paragraphsStack) {
      void next.onChangeParagraph(
        paraId,
        value.recalcId,
        value.text,
        value.annotations
      );
    }
    const checkedField = old as unknown as { checked: Set<string> };
    const paraIds = [...checkedField.checked];
    checkedField.checked.clear();
    void next.checkParagraphs(paraIds);

    return next;
  }

  deleteAssistant(id: string): void {
    const assistant = this._assistants.get(id);
    if (assistant) {
      const checkedField = assistant as unknown as { checked: Set<string> };
      const paraIds = [...checkedField.checked];
      if (paraIds.length) void assistant.uncheckParagraphs(paraIds);
    }
    this._assistants.delete(id);
    this._trackChanges.delete(id);
    this._running.delete(id);
  }

  isRunning(id: string): boolean {
    return this._running.get(id) ?? false;
  }

  hasAssistant(id: string): boolean {
    return this._assistants.has(id);
  }

  async run(id: string, paraIds: string[]): Promise<CustomAssistantStatus> {
    const assistant = this._assistants.get(id);
    if (!assistant) return CUSTOM_ASSISTANT_STATUSES.NOT_FOUND;

    this._running.set(id, true);

    if (!this._trackChanges.get(id)) {
      const promises: Promise<boolean | null>[] = [];
      for (const [paraId, value] of this._paragraphsStack) {
        promises.push(
          assistant.onChangeParagraph(
            paraId,
            value.recalcId,
            value.text,
            value.annotations
          )
        );
      }
      await Promise.all(promises);
    }

    const results = await assistant.checkParagraphs(paraIds);
    if (results?.length && results.every((r) => !r)) {
      if (results.some((r) => r === null)) {
        return CUSTOM_ASSISTANT_STATUSES.NO_AI_MODEL_SELECTED;
      }
      return CUSTOM_ASSISTANT_STATUSES.ERROR;
    }

    this._trackChanges.set(id, true);
    return CUSTOM_ASSISTANT_STATUSES.OK;
  }

  disableTracking(id: string): void {
    this._running.set(id, false);
    this._trackChanges.set(id, false);
  }

  async stop(id: string): Promise<void> {
    this._running.set(id, false);
    const assistant = this._assistants.get(id);
    if (!assistant) return;
    const checkedField = assistant as unknown as { checked: Set<string> };
    const paraIds = [...checkedField.checked];
    checkedField.checked.clear();
    this._trackChanges.set(id, false);
    await assistant.uncheckParagraphs(paraIds);
  }

  onParagraphText(
    paragraphId: string,
    recalcId: string,
    text: string,
    annotations: unknown[]
  ): void {
    this._paragraphsStack.set(paragraphId, { recalcId, text, annotations });
    for (const [id, assistant] of this._assistants) {
      if (!this._trackChanges.get(id)) continue;
      void assistant.onChangeParagraph(
        paragraphId,
        recalcId,
        text,
        annotations
      );
      if (this._running.get(id)) {
        void assistant.checkParagraphs([paragraphId]);
      }
    }
  }

  onClickAnnotation(
    name: string,
    paragraphId: string,
    ranges: number[]
  ): boolean {
    if (!name.startsWith(ANNOTATION_PREFIX)) return false;
    const id = name.slice(ANNOTATION_PREFIX.length);
    const assistant = this._assistants.get(id);
    if (!assistant) return false;
    assistant.onClick(paragraphId, ranges);
    return true;
  }

  onBlurAnnotation(name: string): boolean {
    if (!name.startsWith(ANNOTATION_PREFIX)) return false;
    const id = name.slice(ANNOTATION_PREFIX.length);
    const assistant = this._assistants.get(id);
    if (!assistant) return false;
    assistant.onBlur();
    return true;
  }
}
