import { editor } from "../library/editor";
import { library } from "../library/library";
import { prompts } from "../library/prompts";
import { findAction } from "./storage";
import type { CustomAiAction } from "./types";

export async function runAction(id: string): Promise<void> {
  const action = findAction(id);
  if (!action) return;

  switch (action.type) {
    case "in-chat":
      await dispatchInChatAction(action);
      break;
    case "replace-in-chat":
      await dispatchReplaceInChatAction(action);
      break;
    case "replace":
      await dispatchReplaceAction(action);
      break;
    case "as-review":
      await dispatchAsReviewAction(action);
      break;
    case "in-comment":
      await dispatchInCommentAction(action);
      break;
    case "to-end":
      await dispatchToEndAction(action);
      break;
  }
}

async function dispatchInChatAction(action: CustomAiAction): Promise<void> {
  let sourceText = (await library.GetSelectedText()) ?? "";
  if (!sourceText.trim()) {
    sourceText = (await library.GetFullText()) ?? "";
  }

  window.openChat?.({
    prompt: prompts.getActionInChatPrompt(sourceText.trim(), action.query),
    action: "send",
  });
}

async function dispatchReplaceInChatAction(
  action: CustomAiAction
): Promise<void> {
  if (!window.AI) {
    console.error("[Docs bg] replace-in-chat: AI library not initialized");
    return;
  }

  let sourceText = (await library.GetSelectedText()) ?? "";
  let usedFullDocumentFallback = false;
  if (!sourceText.trim()) {
    sourceText = await library.GetFullText();
    usedFullDocumentFallback = true;
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] replace-in-chat: no source text to rewrite");
    return;
  }

  const replacementPrompt = prompts.getActionReplaceInChatReplacementPrompt(
    original,
    action.query
  );

  let replacement = "";
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    replacement = (await request.chatRequest(replacementPrompt)) ?? "";
  } catch (e) {
    console.error("[Docs bg] replace-in-chat: AI request failed", e);
    return;
  }

  replacement = replacement.trim();
  if (!replacement) {
    console.error("[Docs bg] replace-in-chat: empty replacement");
    return;
  }

  if (usedFullDocumentFallback) {
    await editor.callCommand(() => {
      const doc = Api.GetDocument();
      const range = doc.GetRange() as { Select?: () => void } | null;
      range?.Select?.();
    });
  }

  await library.PasteText(replacement);

  window.openChat?.({
    prompt: prompts.getActionReplaceInChatExplanationPrompt(
      original,
      replacement,
      action.query
    ),
    action: "send",
  });
}

async function dispatchReplaceAction(action: CustomAiAction): Promise<void> {
  if (!window.AI) {
    console.error("[Docs bg] replace: AI library not initialized");
    return;
  }

  let sourceText = (await library.GetSelectedText()) ?? "";
  let usedFullDocumentFallback = false;
  if (!sourceText.trim()) {
    sourceText = await library.GetFullText();
    usedFullDocumentFallback = true;
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] replace: no source text to rewrite");
    return;
  }

  const replacementPrompt = prompts.getActionReplacePrompt(
    original,
    action.query
  );

  let replacement = "";
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    replacement = (await request.chatRequest(replacementPrompt)) ?? "";
  } catch (e) {
    console.error("[Docs bg] replace: AI request failed", e);
    return;
  }

  replacement = replacement.trim();
  if (!replacement) {
    console.error("[Docs bg] replace: empty replacement");
    return;
  }

  if (usedFullDocumentFallback) {
    await editor.callCommand(() => {
      const doc = Api.GetDocument();
      const range = doc.GetRange() as { Select?: () => void } | null;
      range?.Select?.();
    });
  }

  await library.PasteText(replacement);
}

async function dispatchAsReviewAction(action: CustomAiAction): Promise<void> {
  if (!window.AI) {
    console.error("[Docs bg] as-review: AI library not initialized");
    return;
  }

  let sourceText = (await library.GetSelectedText()) ?? "";
  let usedFullDocumentFallback = false;
  if (!sourceText.trim()) {
    sourceText = await library.GetFullText();
    usedFullDocumentFallback = true;
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] as-review: no source text to rewrite");
    return;
  }

  const reviewPrompt = prompts.getActionAsReviewPrompt(original, action.query);

  let replacement = "";
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    replacement = (await request.chatRequest(reviewPrompt)) ?? "";
  } catch (e) {
    console.error("[Docs bg] as-review: AI request failed", e);
    return;
  }

  replacement = replacement.trim();
  if (!replacement) {
    console.error("[Docs bg] as-review: empty replacement");
    return;
  }

  const editorType = window.Asc.plugin.info?.editorType;
  if (editorType === "word") {
    if (usedFullDocumentFallback) {
      await editor.callCommand(() => {
        const doc = Api.GetDocument();
        const range = doc.GetRange() as { Select?: () => void } | null;
        range?.Select?.();
      });
    }
    void library.InsertAsReview(replacement, false);
  } else {
    void library.InsertAsComment(replacement);
  }
}

async function dispatchInCommentAction(action: CustomAiAction): Promise<void> {
  if (!window.AI) {
    console.error("[Docs bg] in-comment: AI library not initialized");
    return;
  }

  let sourceText = (await library.GetSelectedText()) ?? "";
  let usedFullDocumentFallback = false;
  if (!sourceText.trim()) {
    sourceText = await library.GetFullText();
    usedFullDocumentFallback = true;
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] in-comment: no source text");
    return;
  }

  const commentPrompt = prompts.getActionInCommentPrompt(
    original,
    action.query
  );

  let comment = "";
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    comment = (await request.chatRequest(commentPrompt)) ?? "";
  } catch (e) {
    console.error("[Docs bg] in-comment: AI request failed", e);
    return;
  }

  comment = comment.trim();
  if (!comment) {
    console.error("[Docs bg] in-comment: empty response");
    return;
  }

  if (
    usedFullDocumentFallback &&
    window.Asc.plugin.info?.editorType === "word"
  ) {
    await editor.callCommand(() => {
      const doc = Api.GetDocument();
      const range = doc.GetRange() as { Select?: () => void } | null;
      range?.Select?.();
    });
  }

  void library.InsertAsComment(comment);
}

async function dispatchToEndAction(action: CustomAiAction): Promise<void> {
  if (!window.AI) {
    console.error("[Docs bg] to-end: AI library not initialized");
    return;
  }

  let sourceText = (await library.GetSelectedText()) ?? "";
  if (!sourceText.trim()) {
    sourceText = await library.GetFullText();
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] to-end: no source text");
    return;
  }

  const toEndPrompt = prompts.getActionToEndPrompt(original, action.query);

  let result = "";
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    result = (await request.chatRequest(toEndPrompt)) ?? "";
  } catch (e) {
    console.error("[Docs bg] to-end: AI request failed", e);
    return;
  }

  result = result.trim();
  if (!result) {
    console.error("[Docs bg] to-end: empty response");
    return;
  }

  void library.InsertAsText(result);
}
