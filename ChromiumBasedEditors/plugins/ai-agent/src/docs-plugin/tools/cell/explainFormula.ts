import { editor } from "../../library/editor";
import {
  endGroupActions,
  getAiBlockLabel,
  startBlockAction,
  startGroupActions,
} from "../lib/aiActions";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalString } from "../lib/validation";

export const explainFormula = defineTool({
  name: "explainFormula",
  description:
    "Analyzes and explains Excel formulas in natural language. Uses AI to provide detailed explanations of formula logic, function parameters, and expected results.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range containing formula to explain (e.g., 'A1'). If omitted, uses active/selected cell.",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    Asc.scope.range = range;

    const formulaData = await editor.callCommand<
      { error?: string; formula?: string; address?: string } | undefined
    >(() => {
      const ws = Api.GetActiveSheet();
      let _range = null;
      if (!Asc.scope.range) {
        _range = Api.GetSelection();
      } else {
        _range = ws.GetRange(Asc.scope.range);
        if (!_range) {
          return {
            error: `Invalid range "${Asc.scope.range}". Please provide a valid Excel cell address like 'A1'.`,
          };
        }
      }

      const cell = _range.GetCells(1, 1);
      if (!cell)
        return { error: "Could not access cell in the specified range." };

      const formula = cell.GetFormula();
      const cellAddress = cell.GetAddress();
      const hasFormula = !!formula?.toString().startsWith("=");
      if (!hasFormula) {
        return {
          error: `Cell ${cellAddress} does not contain a formula. Its current value is: ${cell.GetValue()}`,
        };
      }
      return { formula, address: cellAddress };
    });

    if (formulaData?.error) throw new ToolError(formulaData.error);
    if (!formulaData) return { isApply: false };

    const prompt =
      `Explain the following Excel formula in detail:\n\n` +
      `Formula: ${formulaData.formula}\n` +
      `Cell: ${formulaData.address}\n\n` +
      `IMPORTANT RULES:\n` +
      `1. Provide a clear, detailed explanation of what the formula does.\n` +
      `2. Break down each part of the formula if it's complex.\n` +
      `3. Explain the functions used and their parameters.\n` +
      `4. Describe the expected result or output.\n` +
      `5. Use simple, understandable language.\n` +
      `6. If there are nested functions, explain the order of operations.\n` +
      `7. Mention any potential issues or common mistakes.\n` +
      `8. Keep the explanation concise but comprehensive.\n` +
      `9. Be brief and avoid unnecessary verbose explanations.\n` +
      `10. Get straight to the point without filler text.\n` +
      `11. Focus only on essential information.\n` +
      `12. Keep response length under 1024 characters (recommended), maximum 32767 characters.\n` +
      `13. Prioritize the most important information if length constraint requires cuts.\n\n` +
      `Please provide a detailed but concise explanation of this formula.`;

    if (!window.AI) return { isApply: false, reason: "AI not available" };
    const requestEngine = window.AI.Request.create(window.AI.ActionType.Chat);

    await startGroupActions();
    const block = await startBlockAction(
      getAiBlockLabel(window.AI.ActionType.Chat)
    );

    let explanation = "";
    try {
      explanation = await requestEngine.chatRequest(prompt);
    } finally {
      await block.end();
      await endGroupActions();
    }

    return explanation || { isApply: false, reason: "Empty AI response" };
  },
});
