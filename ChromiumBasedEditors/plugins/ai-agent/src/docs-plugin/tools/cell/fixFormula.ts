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

interface FormulaItem {
  sheet: string;
  address: string;
  row: number;
  col: number;
  formula: string;
  error: string | null;
}

interface SheetFormulas {
  sheetName: string;
  formulas: FormulaItem[];
  hasErrors: boolean;
}

interface FixItem {
  sheet: string;
  address: string;
  formula: string;
}

function parseFixesJson(raw: string): FixItem[] {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const arr = s.match(/\[[\s\S]*\]/);
  if (!arr) throw new Error("No JSON array found in response");
  return JSON.parse(arr[0]);
}

export const fixFormula = defineTool({
  name: "fixFormula",
  description:
    "Scans cells for formulas that produce errors and fixes them using AI. Detects #DIV/0!, #REF!, #NAME?, #VALUE!, #N/A, #NULL!, #NUM! errors. When no range is specified, scans ALL sheets.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range to scan (e.g., 'A1:D10'). If omitted, scans all sheets.",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    Asc.scope.range = range ?? null;

    const sheetData = await editor.callCommand<
      SheetFormulas[] | { error: string }
    >(() => {
      const ERROR_VALUES: Record<string, boolean> = {
        "#DIV/0!": true,
        "#REF!": true,
        "#NAME?": true,
        "#VALUE!": true,
        "#N/A": true,
        "#NULL!": true,
        "#NUM!": true,
      };

      // biome-ignore lint/suspicious/noExplicitAny: editor API dynamic
      function collectSheet(ws: any, scanRange: any): SheetFormulas {
        const sheetName = ws.GetName();
        const formulas: FormulaItem[] = [];
        let hasErrors = false;

        // biome-ignore lint/suspicious/noExplicitAny: editor API dynamic
        scanRange.ForEach((cell: any) => {
          const formula = cell.GetFormula();
          if (!formula || !formula.startsWith("=")) return;
          const value = String(cell.GetValue());
          const isError = ERROR_VALUES[value] === true;
          formulas.push({
            sheet: sheetName,
            address: cell.GetAddress(false, false),
            row: cell.Row,
            col: cell.Col,
            formula,
            error: isError ? value : null,
          });
          if (isError) hasErrors = true;
        });

        return { sheetName, formulas, hasErrors };
      }

      if (Asc.scope.range) {
        const ws = Api.GetActiveSheet();
        const r = ws.GetRange(Asc.scope.range);
        if (!r) {
          return {
            error: `Invalid range "${Asc.scope.range}". Please provide a valid Excel range like 'A1:D10'.`,
          };
        }
        const result = collectSheet(ws, r);
        return result.hasErrors ? [result] : [];
      }

      const results: SheetFormulas[] = [];
      const sheets = Api.GetSheets();
      for (const ws of sheets) {
        const usedRange = ws.GetUsedRange();
        if (!usedRange) continue;
        const result = collectSheet(ws, usedRange);
        if (result.hasErrors) results.push(result);
      }
      return results;
    });

    if (!Array.isArray(sheetData) && sheetData.error) {
      throw new ToolError(sheetData.error);
    }
    if (!Array.isArray(sheetData) || sheetData.length === 0) {
      throw new ToolError("No formula errors found in the specified scope.");
    }

    const contextLines: string[] = [];
    for (const sheet of sheetData) {
      for (const cell of sheet.formulas) {
        const marker = cell.error ? ` → ${cell.error} [FIX THIS]` : "";
        contextLines.push(
          `  ${cell.sheet}!${cell.address}: ${cell.formula}${marker}`
        );
      }
    }

    const prompt = [
      "You are an Excel formula expert. Some formulas in the list below produce errors (marked with [FIX THIS]).",
      "The other formulas are provided as context to help you understand the data structure and patterns.",
      "",
      "Fix guidelines:",
      "- #DIV/0!: wrap division in IF(denominator<>0, ..., 0) — do NOT use IFERROR to hide the error",
      "- #REF!: correct the broken cell reference based on surrounding formula patterns",
      "- #NAME?: fix the function name typo (e.g. VLOOKPU → VLOOKUP)",
      "- #VALUE!: fix argument types (e.g. wrap text in VALUE() or use correct data type)",
      '- #N/A from VLOOKUP/MATCH: wrap in IFERROR(..., "") only if the missing value is expected',
      "- #NULL!: fix the range operator (missing colon or incorrect intersection)",
      "- #NUM!: fix the numeric argument (e.g. negative SQRT input, date overflow)",
      "",
      "Return ONLY a JSON array of objects for cells you are fixing:",
      '[{"sheet": "Sheet1", "address": "A5", "formula": "=fixed_formula"}, ...]',
      "- Only include cells marked [FIX THIS] where the formula actually changes",
      "- If you cannot determine a safe fix, omit that cell",
      "- No markdown, no code blocks — ONLY the raw JSON array",
      "",
      "Formulas:",
      contextLines.join("\n"),
    ].join("\n");

    if (!window.AI) return { isApply: false, reason: "AI not available" };
    const requestEngine = window.AI.Request.create(window.AI.ActionType.Chat);

    await startGroupActions();
    const block = await startBlockAction(
      getAiBlockLabel(window.AI.ActionType.Chat)
    );

    let aiResult = "";
    try {
      aiResult = await requestEngine.chatRequest(prompt);
    } finally {
      await block.end();
    }

    if (!aiResult) {
      await endGroupActions();
      return { isApply: false };
    }

    let fixes: FixItem[];
    try {
      fixes = parseFixesJson(aiResult);
    } catch (err) {
      await endGroupActions();
      throw new ToolError(
        `Failed to parse AI response for formula fixes: ${(err as Error).message}`
      );
    }

    if (!Array.isArray(fixes) || fixes.length === 0) {
      await endGroupActions();
      return { isApply: false };
    }

    const originalMap: Record<string, string> = {};
    for (const sheet of sheetData) {
      for (const cell of sheet.formulas) {
        if (cell.error) {
          originalMap[`${cell.sheet}!${cell.address}`] = cell.formula;
        }
      }
    }

    Asc.scope.fixes = fixes;
    Asc.scope.originalMap = originalMap;

    const applied = await editor.callCommand<
      { sheet: string; address: string; from: string; to: string }[]
    >(() => {
      const applied: {
        sheet: string;
        address: string;
        from: string;
        to: string;
      }[] = [];
      for (const fix of Asc.scope.fixes) {
        if (
          !fix ||
          typeof fix.sheet !== "string" ||
          typeof fix.address !== "string" ||
          typeof fix.formula !== "string"
        )
          continue;
        if (!fix.formula.startsWith("=")) continue;
        const key = `${fix.sheet}!${fix.address}`;
        if (!(key in Asc.scope.originalMap)) continue;
        if (Asc.scope.originalMap[key] === fix.formula) continue;

        const ws = Api.GetSheet(fix.sheet);
        if (!ws) continue;

        const cell = ws.GetRange(fix.address);
        if (cell) {
          cell.SetValue(fix.formula);
          applied.push({
            sheet: fix.sheet,
            address: fix.address,
            from: Asc.scope.originalMap[key],
            to: fix.formula,
          });
        }
      }
      return applied;
    });

    await endGroupActions();

    if (!applied || applied.length === 0) return "No formulas were changed.";

    let lines = "";
    for (const f of applied) {
      lines += `\n${f.sheet}!${f.address}: ${f.from} → ${f.to}`;
    }
    return `Fixed ${applied.length} formula${applied.length > 1 ? "s" : ""}:${lines}`;
  },
});
