import type { CustomAiAction } from "../../ai-actions/types";
import type { TextAnnotationPopup } from "../annotation-popup";
import {
  ACTION_ANNOTATION_PREFIX,
  type CustomActionAnnotator,
} from "./action-annotator";
import { ActionHint } from "./action-hint";
import { ActionInChat } from "./action-in-chat";
import { ActionReplace } from "./action-replace";
import { ActionReplaceHint } from "./action-replace-hint";

export const CUSTOM_ACTION_STATUSES = {
  OK: 0,
  NOT_FOUND: 1,
  ERROR: 2,
  NO_AI_MODEL_SELECTED: 3,
} as const;

export type CustomActionStatus =
  (typeof CUSTOM_ACTION_STATUSES)[keyof typeof CUSTOM_ACTION_STATUSES];

export class CustomActionManager {
  private _annotators = new Map<string, CustomActionAnnotator>();
  private _popup: TextAnnotationPopup;

  constructor(popup: TextAnnotationPopup) {
    this._popup = popup;
  }

  createAction(action: CustomAiAction): CustomActionAnnotator {
    let annotator: CustomActionAnnotator;
    switch (action.type) {
      case "hint":
        annotator = new ActionHint(this._popup, action);
        break;
      case "replace-hint":
        annotator = new ActionReplaceHint(this._popup, action);
        break;
      case "replace":
        annotator = new ActionReplace(this._popup, action);
        break;
      case "in-chat":
      case "replace-in-chat":
        // Both bypass the annotation pipeline via runAction's early
        // return; ActionInChat is a no-op annotator that satisfies the
        // manager's bookkeeping.
        annotator = new ActionInChat(this._popup, action);
        break;
      default:
        throw new Error(`Unknown custom action type: ${action.type}`);
    }

    this._annotators.set(action.id, annotator);
    return annotator;
  }

  updateAction(action: CustomAiAction): CustomActionAnnotator {
    const old = this._annotators.get(action.id);
    if (old) {
      const checkedField = old as unknown as { checked: Set<string> };
      const paraIds = [...checkedField.checked];
      if (paraIds.length) void old.uncheckParagraphs(paraIds);
    }
    const next = this.createAction(action);
    if (old) next.inheritParagraphCache(old);
    return next;
  }

  deleteAction(id: string): void {
    const annotator = this._annotators.get(id);
    if (annotator) {
      const checkedField = annotator as unknown as { checked: Set<string> };
      const paraIds = [...checkedField.checked];
      if (paraIds.length) void annotator.uncheckParagraphs(paraIds);
    }
    this._annotators.delete(id);
  }

  hasAction(id: string): boolean {
    return this._annotators.has(id);
  }

  // Forward editor paragraph events into every registered annotator so
  // their waitParagraphs / annotation-range tracking stays current. The
  // manager itself caches nothing — runOnce later consumes whatever the
  // base TextAnnotator has accumulated for the requested paraIds.
  onParagraphText(
    paragraphId: string,
    recalcId: string,
    text: string,
    annotations: unknown[]
  ): void {
    for (const annotator of this._annotators.values()) {
      void annotator.onChangeParagraph(
        paragraphId,
        recalcId,
        text,
        annotations
      );
    }
  }

  async runOnce(id: string, paraIds: string[]): Promise<CustomActionStatus> {
    const annotator = this._annotators.get(id);
    if (!annotator) return CUSTOM_ACTION_STATUSES.NOT_FOUND;

    const results = await annotator.checkParagraphs(paraIds);
    if (results?.length && results.every((r) => !r)) {
      if (results.some((r) => r === null)) {
        return CUSTOM_ACTION_STATUSES.NO_AI_MODEL_SELECTED;
      }
      return CUSTOM_ACTION_STATUSES.ERROR;
    }
    return CUSTOM_ACTION_STATUSES.OK;
  }

  onClickAnnotation(
    name: string,
    paragraphId: string,
    ranges: number[]
  ): boolean {
    if (!name.startsWith(ACTION_ANNOTATION_PREFIX)) return false;
    const id = name.slice(ACTION_ANNOTATION_PREFIX.length);
    const annotator = this._annotators.get(id);
    if (!annotator) return false;
    annotator.onClick(paragraphId, ranges);
    return true;
  }

  onBlurAnnotation(name: string): boolean {
    if (!name.startsWith(ACTION_ANNOTATION_PREFIX)) return false;
    const id = name.slice(ACTION_ANNOTATION_PREFIX.length);
    const annotator = this._annotators.get(id);
    if (!annotator) return false;
    annotator.onBlur();
    return true;
  }
}
