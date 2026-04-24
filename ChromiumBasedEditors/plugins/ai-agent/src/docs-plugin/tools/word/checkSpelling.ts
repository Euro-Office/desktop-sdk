import { editor } from "../../library/editor";
import {
  cancelGroupActions,
  endGroupActions,
  getAiBlockLabel,
  getModelAttribution,
  startBlockAction,
  startGroupActions,
} from "../lib/aiActions";
import { defineTool } from "../lib/defineTool";

export const checkSpelling = defineTool({
  name: "checkSpelling",
  description:
    "Checks spelling and fixes text errors in the current paragraph.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async () => {
    const originalText = await editor.callCommand<string>(() => {
      const par = Api.GetDocument().GetCurrentParagraph();
      if (!par) return "";
      par.Select();
      return par.GetText();
    });

    if (!originalText) {
      return { isApply: false, reason: "No current paragraph found" };
    }

    const aiPrompt = `Check spelling and grammar for text:\n${originalText}\n Answer with only the new corrected text, no need of any explanations.`;

    const wasTrackChanges = await editor.callCommand<boolean>(() => {
      const doc = Api.GetDocument();
      const on = doc.IsTrackRevisions();
      if (on) doc.SetTrackRevisions(false);
      return on;
    });

    if (!window.AI) return { isApply: false, reason: "AI not available" };
    const requestEngine = window.AI.Request.create(window.AI.ActionType.Chat);
    const modelName = getModelAttribution(window.AI.ActionType.Chat);

    await startGroupActions();
    const block = await startBlockAction(
      getAiBlockLabel(window.AI.ActionType.Chat)
    );

    let accumulated = "";
    await requestEngine.chatRequest(aiPrompt, false, async (delta, isFinal) => {
      if (!delta && !isFinal) return;
      await block.end();

      accumulated += delta;

      // Redo streaming group each chunk so there's only one cumulative insert.
      await cancelGroupActions();
      await startGroupActions();

      Asc.scope.text = accumulated;
      await editor.callCommand(() => {
        const par = Api.GetDocument().GetCurrentParagraph();
        if (!par) return;
        par.Select();
        Api.ReplaceTextSmart([Asc.scope.text]);
      });
    });

    await block.end();

    // Cancel the accumulated streaming group and re-apply the final text
    // inside SetAssistantTrackRevisions — so the result shows as a single
    // AI revision attributed to the model, not a chain of streamed edits.
    await cancelGroupActions();
    await startGroupActions();

    Asc.scope.modelName = modelName;
    await editor.callCommand(() => {
      Api.GetDocument().SetAssistantTrackRevisions(true, Asc.scope.modelName);
    });

    Asc.scope.text = accumulated;
    await editor.callCommand(() => {
      const par = Api.GetDocument().GetCurrentParagraph();
      if (!par) return;
      par.Select();
      Api.ReplaceTextSmart([Asc.scope.text]);
    });

    await editor.callCommand(() => {
      Api.GetDocument().SetAssistantTrackRevisions(false);
    });

    if (wasTrackChanges) {
      await editor.callCommand(() => {
        Api.GetDocument().SetTrackRevisions(true);
      });
    }

    await endGroupActions();
    return { isApply: true };
  },
});
