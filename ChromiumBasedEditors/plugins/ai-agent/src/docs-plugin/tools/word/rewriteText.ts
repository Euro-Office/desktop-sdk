import { editor } from "../../library/editor";
import {
  endGroupActions,
  getAiBlockLabel,
  startBlockAction,
  startGroupActions,
} from "../lib/aiActions";
import { defineTool } from "../lib/defineTool";
import {
  optionalBoolean,
  optionalEnum,
  optionalNumber,
  requireString,
} from "../lib/validation";

const TYPES = ["sentence", "paragraph"] as const;

export const rewriteText = defineTool({
  name: "rewriteText",
  description:
    "Use this function when you asked to rewrite or replace some text. If text or paragraph number is not specified assume that we are working with the current paragraph.",
  inputSchema: {
    type: "object",
    properties: {
      parNumber: {
        type: "number",
        description: "The paragraph number to change.",
      },
      prompt: {
        type: "string",
        description: "Instructions on how to change the text.",
      },
      showDifference: {
        type: "boolean",
        description:
          "Whether to show the difference between the original and new text, or just replace it.",
      },
      type: {
        type: "string",
        enum: [...TYPES],
        default: "paragraph",
        description:
          "Which part of the text to be rewritten (e.g., 'sentence' or 'paragraph').",
      },
    },
    required: ["prompt"],
  },
  handler: async (params) => {
    const userPrompt = requireString(params, "prompt");
    const type = optionalEnum(params, "type", TYPES) ?? "paragraph";
    const parNumber = optionalNumber(params, "parNumber");
    const showDifference = optionalBoolean(params, "showDifference") ?? false;

    let originalText = "";
    if (type === "paragraph") {
      Asc.scope.parNumber = parNumber;
      originalText = await editor.callCommand<string>(() => {
        const doc = Api.GetDocument();
        let par = null;

        if (Asc.scope.parNumber !== undefined) {
          par = doc.GetElement(Asc.scope.parNumber - 1);
        } else {
          // Prefer the paragraph of the user's current selection. Going
          // through GetRangeBySelect first also resyncs the internal cursor
          // state — after the user makes a selection and clicks into the
          // chat panel, GetCurrentParagraph alone can return the previous
          // paragraph where the cursor was before the selection was made.
          const range = doc.GetRangeBySelect();
          if (range && typeof range.GetParagraphs === "function") {
            const paragraphs = range.GetParagraphs();
            if (paragraphs && paragraphs.length > 0) par = paragraphs[0];
          }
          if (!par) par = doc.GetCurrentParagraph();
        }

        if (!par) return "";
        par.Select();
        return par.GetText();
      });
    } else {
      originalText = await editor.callCommand<string>(() => {
        const doc = Api.GetDocument();
        // Same resync as above, in case GetCurrentSentence relies on the
        // same stale cursor state.
        doc.GetRangeBySelect();
        return doc.GetCurrentSentence();
      });
    }

    if (!originalText) {
      return {
        isApply: false,
        reason:
          type === "paragraph"
            ? "No paragraph found at the specified position"
            : "No current sentence found at the cursor",
      };
    }

    const aiPrompt = `${userPrompt}:\n${originalText}\n Answer with only the new ${type}, no need of any explanations`;

    if (!window.AI) return { isApply: false, reason: "AI not available" };
    const requestEngine = window.AI.Request.create(window.AI.ActionType.Chat);

    await startGroupActions();

    let turnOffTrackChanges = false;
    if (showDifference) {
      const isTrackChanges = await editor.callCommand<boolean>(() => {
        return Api.GetDocument().IsTrackRevisions();
      });
      if (!isTrackChanges) {
        await editor.callCommand(() => {
          Api.GetDocument().SetTrackRevisions(true);
        });
        turnOffTrackChanges = true;
      }
    }

    const block = await startBlockAction(
      getAiBlockLabel(window.AI.ActionType.Chat)
    );

    // Stream paste pattern from legacy plugin: for sentence-type, clear the
    // selected sentence on first chunk; for paragraph-type, the selection was
    // already made above, so first PasteText replaces it and subsequent pastes
    // append after the cursor.
    let needsSentenceClear = type === "sentence";
    await requestEngine.chatRequest(aiPrompt, false, async (delta, isFinal) => {
      if (!delta && !isFinal) return;
      await block.end();

      if (delta) {
        if (needsSentenceClear) {
          await editor.callCommand(() => {
            Api.GetDocument().ReplaceCurrentSentence("");
          });
          needsSentenceClear = false;
        }
        await window.Asc.Library?.PasteText(delta);
      }
    });

    await block.end();

    if (turnOffTrackChanges) {
      await editor.callCommand(() => {
        Api.GetDocument().SetTrackRevisions(false);
      });
    }

    await endGroupActions();
    return { isApply: true };
  },
});
