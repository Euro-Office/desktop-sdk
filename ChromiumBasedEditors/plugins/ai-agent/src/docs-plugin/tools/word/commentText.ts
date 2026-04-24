import { editor } from "../../library/editor";
import {
  endGroupActions,
  getAiBlockLabel,
  getModelAttribution,
  startBlockAction,
  startGroupActions,
} from "../lib/aiActions";
import { defineTool } from "../lib/defineTool";
import { optionalEnum, requireString } from "../lib/validation";

const TYPES = ["comment", "footnote"] as const;

export const commentText = defineTool({
  name: "commentText",
  description:
    "Adds a comment or footnote to explain or annotate the selected text. If no text is selected, works with the current paragraph.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "The instruction for what to explain or comment about the text.",
      },
      type: {
        type: "string",
        enum: [...TYPES],
        description: "Whether to add as a comment or as a footnote.",
        default: "comment",
      },
    },
    required: ["prompt"],
  },
  handler: async (params) => {
    const userPrompt = requireString(params, "prompt");
    const type = optionalEnum(params, "type", TYPES) ?? "comment";
    const isFootnote = type === "footnote";

    const selectedText = await editor.callCommand<string>(() => {
      const doc = Api.GetDocument();
      const range = doc.GetRangeBySelect();
      let text = range ? range.GetText() : "";
      if (!text) {
        text = doc.GetCurrentWord();
        doc.SelectCurrentWord();
      }
      return text;
    });

    if (!selectedText) {
      return { isApply: false, reason: "No text to comment on" };
    }

    const aiPrompt = `${userPrompt}:\n${selectedText}`;

    if (!window.AI) return { isApply: false, reason: "AI not available" };
    const requestEngine = window.AI.Request.create(window.AI.ActionType.Chat);
    const modelName = getModelAttribution(window.AI.ActionType.Chat);

    await startGroupActions();
    const block = await startBlockAction(
      getAiBlockLabel(window.AI.ActionType.Chat)
    );

    if (isFootnote) {
      // Footnote: create it on the first non-empty chunk, then PasteText each
      // subsequent chunk into it.
      let footnoteCreated = false;
      await requestEngine.chatRequest(
        aiPrompt,
        false,
        async (delta, isFinal) => {
          if (!delta && !isFinal) return;
          await block.end();
          if (!delta) return;

          if (!footnoteCreated) {
            await editor.callCommand(() => {
              Api.GetDocument().AddFootnote();
            });
            footnoteCreated = true;
          }
          await window.Asc.Library?.PasteText(delta);
        }
      );
    } else {
      // Comment: create on first chunk with the initial delta, then append via
      // SetText(getText() + delta) on each subsequent chunk.
      let commentId: string | null = null;
      await requestEngine.chatRequest(
        aiPrompt,
        false,
        async (delta, isFinal) => {
          if (!delta && !isFinal) return;
          await block.end();
          if (!delta) return;

          Asc.scope.commentDelta = delta;
          Asc.scope.commentModel = modelName;
          Asc.scope.commentId = commentId;

          commentId = await editor.callCommand<string | null>(() => {
            const doc = Api.GetDocument();
            const existingId = Asc.scope.commentId as string | null;

            if (!existingId) {
              const range = doc.GetRangeBySelect();
              if (!range) return null;
              const comment = range.AddComment(
                Asc.scope.commentDelta,
                Asc.scope.commentModel,
                `uid${Asc.scope.commentModel}`
              );
              if (!comment) return null;
              doc.ShowComment([comment.GetId()]);
              return comment.GetId();
            }

            const comment = doc.GetCommentById(existingId);
            if (!comment) return existingId;
            comment.SetText(comment.GetText() + Asc.scope.commentDelta);
            return existingId;
          });
        }
      );
    }

    await block.end();
    await endGroupActions();
    return { isApply: true };
  },
});
