import { editor } from "../../library/editor";
import { endGroupActions, startGroupActions } from "../lib/aiActions";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalString } from "../lib/validation";

interface FillItem {
  row: number;
  column: number;
  new_value: string | number;
}

function toCsv(data: unknown[][]): string {
  return data
    .map((row) =>
      row
        .map((value) => {
          if (value == null) return "";
          const str = String(value);
          if (
            str.includes(",") ||
            str.includes("\n") ||
            str.includes("\r") ||
            str.includes('"')
          ) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");
}

function parseAiResult(raw: string): FillItem[] | null {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export const fillMissingData = defineTool({
  name: "fillMissingData",
  description:
    "Intelligently fills missing or empty cells in a data range using statistical methods. For numeric columns, fills with median. For categorical, uses mode. For time series, applies forward fill. Filled cells are highlighted light blue.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range to fill missing data (e.g., 'A1:D10'). Omit to use current selection.",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    Asc.scope.range = range;

    const rangeData = await editor.callCommand<
      { error?: string } | [string, unknown[][]] | undefined
    >(() => {
      const ws = Api.GetActiveSheet();
      let r = null;
      if (Asc.scope.range) {
        r = ws.GetRange(Asc.scope.range);
        if (!r) {
          return {
            error: `Invalid range "${Asc.scope.range}". Please provide a valid Excel range like 'A1:D10'.`,
          };
        }
      } else {
        r = ws.Selection;
      }
      return [r.Address, r.GetValue2()];
    });

    if (rangeData && !Array.isArray(rangeData) && rangeData.error) {
      throw new ToolError(rangeData.error);
    }
    if (!rangeData || !Array.isArray(rangeData)) return { isApply: false };

    const [address, data] = rangeData;
    const csv = toCsv(data);

    const prompt = [
      "You are a data analyst.",
      "Input is CSV (comma-separated, ','). Empty cells represent missing values to be filled.",
      "Rules:",
      "1. NUMERIC columns: Fill missing values with MEDIAN of non-empty values.",
      "2. CATEGORICAL columns: Fill missing values with MOST FREQUENT value.",
      "3. TIME_SERIES columns: Fill missing values with FORWARD FILL (previous non-empty value).",
      "",
      "Output format: JSON array with exact row/column coordinates (1-based indexing):",
      "[",
      '  {"row": 2, "column": 1, "new_value": 25.5},',
      '  {"row": 3, "column": 2, "new_value": "Category A"},',
      '  {"row": 4, "column": 3, "new_value": "FORWARD_FILL"}',
      "]",
      '- Use "FORWARD_FILL" as new_value for time series columns',
      "- Row and column numbers are 1-based (first row = 1, first column = 1)",
      "- Only include cells that need to be filled",
      "- The answer MUST be valid JSON array",
      "- No extra text, spaces, or newlines outside JSON",
      "",
      "CSV:",
      csv,
    ].join("\n");

    if (!window.AI) return { isApply: false, reason: "AI not available" };
    const requestEngine = window.AI.Request.create(window.AI.ActionType.Chat);

    await startGroupActions();

    let aiResult = "";
    try {
      aiResult = await requestEngine.chatRequest(prompt);
    } finally {
      await endGroupActions();
    }

    const fillData = parseAiResult(aiResult);
    if (!fillData || fillData.length === 0) return { isApply: false };

    Asc.scope.address = address;
    Asc.scope.fillData = fillData;
    Asc.scope.originalData = data;

    const filled = await editor.callCommand<
      { addr: string; value: unknown }[] | undefined
    >(() => {
      const ws = Api.GetActiveSheet();
      const r = ws.GetRange(Asc.scope.address);
      const fd = Asc.scope.fillData;
      const orig = Asc.scope.originalData;
      const out: { addr: string; value: unknown }[] = [];
      const highlightColor = Api.CreateColorFromRGB(173, 216, 230);

      for (const item of fd) {
        const rowNum = item.row;
        const colNum = item.column;
        const newValue = item.new_value;

        if (newValue === "FORWARD_FILL") {
          let lastValue = null;
          for (let searchRow = rowNum - 1; searchRow >= 1; searchRow--) {
            const searchValue = orig[searchRow - 1][colNum - 1];
            if (searchValue != null && searchValue !== "") {
              lastValue = searchValue;
              break;
            }
          }
          if (lastValue != null) {
            const cell = r.GetCells(rowNum, colNum);
            cell.Value = lastValue;
            cell.FillColor = highlightColor;
            out.push({
              addr: cell.GetAddress(false, false),
              value: lastValue,
            });
          }
        } else {
          const cell = r.GetCells(rowNum, colNum);
          cell.Value = newValue;
          cell.FillColor = highlightColor;
          out.push({
            addr: cell.GetAddress(false, false),
            value: newValue,
          });
        }
      }
      return out;
    });

    if (!filled || filled.length === 0) return { isApply: false };

    const MAX_LISTED = 15;
    let msg = `Filled ${filled.length} cell${filled.length > 1 ? "s" : ""} in ${address}:`;
    const limit = Math.min(filled.length, MAX_LISTED);
    for (let i = 0; i < limit; i++) {
      msg += `\n  ${filled[i].addr} → ${filled[i].value}`;
    }
    if (filled.length > MAX_LISTED) {
      msg += `\n  ... and ${filled.length - MAX_LISTED} more`;
    }
    return msg;
  },
});
