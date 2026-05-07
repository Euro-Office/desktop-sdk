import type { TextAnnotationPopup } from "../text-annotations/annotation-popup";
import { CustomAssistantAnnotator } from "./assistant-annotator";
import { ANNOTATION_NAME_PREFIX, type CustomAssistant } from "./types";

interface ParagraphSnapshot {
  recalcId: string;
  text: string;
  annotations: unknown[];
}

export const ASSISTANT_RUN_STATUS = {
  ok: 0,
  notFound: 1,
  error: 2,
  noAiModel: 3,
} as const;

export type AssistantRunStatus =
  (typeof ASSISTANT_RUN_STATUS)[keyof typeof ASSISTANT_RUN_STATUS];

export class CustomAssistantManager {
  private readonly popup: TextAnnotationPopup;
  private readonly annotators = new Map<string, CustomAssistantAnnotator>();
  private readonly active = new Set<string>();
  private readonly tracking = new Set<string>();
  private readonly paragraphsStack = new Map<string, ParagraphSnapshot>();

  constructor(popup: TextAnnotationPopup) {
    this.popup = popup;
  }

  has(id: string): boolean {
    return this.annotators.has(id);
  }

  isActive(id: string): boolean {
    return this.active.has(id);
  }

  create(assistant: CustomAssistant): CustomAssistantAnnotator {
    const annotator = new CustomAssistantAnnotator(this.popup, assistant);
    this.annotators.set(assistant.id, annotator);
    return annotator;
  }

  update(assistant: CustomAssistant): CustomAssistantAnnotator {
    const wasActive = this.active.has(assistant.id);
    const wasTracking = this.tracking.has(assistant.id);
    const old = this.annotators.get(assistant.id);
    const paragraphIdsToReplay = old ? old.takeCheckedParagraphIds() : [];

    const next = this.create(assistant);

    if (wasActive) this.active.add(assistant.id);
    if (wasTracking) {
      this.paragraphsStack.forEach((snap, paraId) => {
        void next.onChangeParagraph(
          paraId,
          snap.recalcId,
          snap.text,
          snap.annotations
        );
      });
      if (paragraphIdsToReplay.length) {
        void next.checkParagraphs(paragraphIdsToReplay);
      }
      this.tracking.add(assistant.id);
    }
    return next;
  }

  async remove(id: string): Promise<void> {
    const annotator = this.annotators.get(id);
    if (annotator) await annotator.uncheckAllParagraphs();
    this.annotators.delete(id);
    this.active.delete(id);
    this.tracking.delete(id);
  }

  async start(id: string, paraIds: string[]): Promise<AssistantRunStatus> {
    const annotator = this.annotators.get(id);
    if (!annotator) return ASSISTANT_RUN_STATUS.notFound;

    this.active.add(id);

    if (!this.tracking.has(id)) {
      const seedPromises: Array<Promise<unknown>> = [];
      this.paragraphsStack.forEach((snap, paraId) => {
        seedPromises.push(
          annotator.onChangeParagraph(
            paraId,
            snap.recalcId,
            snap.text,
            snap.annotations
          )
        );
      });
      await Promise.all(seedPromises);
    }

    if (!paraIds.length) {
      this.tracking.add(id);
      return ASSISTANT_RUN_STATUS.ok;
    }

    const results = await annotator.checkParagraphs(paraIds);
    if (results.length && results.every((r) => !r)) {
      if (results.some((r) => r === null))
        return ASSISTANT_RUN_STATUS.noAiModel;
      return ASSISTANT_RUN_STATUS.error;
    }

    this.tracking.add(id);
    return ASSISTANT_RUN_STATUS.ok;
  }

  async stop(id: string): Promise<void> {
    const annotator = this.annotators.get(id);
    this.active.delete(id);
    this.tracking.delete(id);
    if (annotator) await annotator.uncheckAllParagraphs();
  }

  onChangeParagraph(
    paraId: string,
    recalcId: string,
    text: string,
    annotations: unknown[]
  ): void {
    this.paragraphsStack.set(paraId, { recalcId, text, annotations });
    this.annotators.forEach((annotator, id) => {
      if (!this.tracking.has(id)) return;

      void annotator.onChangeParagraph(paraId, recalcId, text, annotations);
      if (this.active.has(id)) void annotator.checkParagraphs([paraId]);
    });
  }

  onClickAnnotation(name: string, paraId: string, ranges: number[]): void {
    if (!name.startsWith(ANNOTATION_NAME_PREFIX)) return;
    const id = name.slice(ANNOTATION_NAME_PREFIX.length);
    const annotator = this.annotators.get(id);
    if (!annotator) return;
    annotator.onClick(paraId, ranges);
  }

  onBlurAnnotation(name: string): void {
    if (!name.startsWith(ANNOTATION_NAME_PREFIX)) return;
    const id = name.slice(ANNOTATION_NAME_PREFIX.length);
    const annotator = this.annotators.get(id);
    if (!annotator) return;
    annotator.onBlur();
  }
}
