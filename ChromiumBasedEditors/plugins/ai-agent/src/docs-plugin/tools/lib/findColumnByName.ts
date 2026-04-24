import { editor } from "../../library/editor";
import {
  endGroupActions,
  getAiBlockLabel,
  startBlockAction,
  startGroupActions,
} from "./aiActions";
import { ToolError } from "./ToolError";

function rangeToCsv(data: unknown[][]): string {
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

/**
 * Resolves a column name (like "Revenue") to a 1-based column index inside a
 * range by asking the model. Used by sort tools when the user refers to a
 * column by header name rather than letter/number.
 */
export async function findColumnByName(
  fieldName: string,
  rangeAddress: string | undefined
): Promise<number> {
  Asc.scope.__fcRange = rangeAddress;

  const rows = await editor.callCommand<
    { error?: string } | unknown[][] | null
  >(() => {
    const ws = Api.GetActiveSheet();
    let _range = null;
    if (Asc.scope.__fcRange) {
      _range = ws.GetRange(Asc.scope.__fcRange);
      if (!_range) {
        return {
          error: `Invalid range "${Asc.scope.__fcRange}". Please provide a valid Excel range like 'A1:D10'.`,
        };
      }
    } else {
      _range = Api.GetSelection();
    }
    return _range.GetValue2();
  });

  if (rows && !Array.isArray(rows) && "error" in rows && rows.error) {
    throw new ToolError(rows.error);
  }
  if (!rows || !Array.isArray(rows)) {
    throw new ToolError("Failed to retrieve data from the specified range.");
  }

  const csv = rangeToCsv(rows as unknown[][]);
  const prompt = `Find column index for header '${fieldName}' in the following CSV data.

IMPORTANT RULES:
1. Return ONLY a single number (column index starting from 1). No text, no explanations, no additional characters.
2. Find EXACT match first. If exact match exists, return its index.
3. If no exact match, then look for partial matches.
4. Case-insensitive comparison allowed.
5. Data is CSV format (comma-separated). Look ONLY at the first row (header row).
6. Count positions carefully: each comma marks a column boundary.
7. Example: if searching for 'test2' and headers are 'test1,test2,test', return 2 (not 1 or 3).
8. If the header is in the 3rd column, return only: 3

CSV data:
${csv}`;

  if (!window.AI) throw new ToolError("AI not available for column lookup");
  const requestEngine = window.AI.Request.create(window.AI.ActionType.Chat);

  await startGroupActions();
  const block = await startBlockAction(
    getAiBlockLabel(window.AI.ActionType.Chat)
  );

  let result = "";
  try {
    result = await requestEngine.chatRequest(prompt);
  } finally {
    await block.end();
    await endGroupActions();
  }

  const idx = Number(result);
  if (!Number.isFinite(idx) || idx < 1 || !Number.isInteger(idx)) {
    throw new ToolError(
      `Column "${fieldName}" not found in the range headers.`
    );
  }
  return idx;
}
