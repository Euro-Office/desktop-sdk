import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalBoolean,
  optionalInteger,
  optionalString,
  requireString,
} from "../lib/validation";

export const getRangeData = defineTool({
  name: "getRangeData",
  description:
    "READ. Returns headers (first-row array) and rows (2-D array, empty cells null). Leading and trailing empty rows/columns are trimmed to the data bounding box; returnedRange shows actual extent. If nextRange is not null, call again with it as range and includeHeaders:false.",
  inputSchema: {
    type: "object",
    properties: {
      sheet: {
        type: "string",
        description: "Sheet name. If omitted, uses the active sheet.",
      },
      range: {
        type: "string",
        description: 'A1 notation range, e.g. "A1:D10".',
      },
      maxRows: {
        type: "number",
        description: "Maximum rows to return. Default: 500.",
      },
      includeHeaders: {
        type: "boolean",
        description: "Extract first row as headers (default: true).",
      },
    },
    required: ["range"],
  },
  handler: async (params) => {
    const sheet = optionalString(params, "sheet");
    const range = requireString(params, "range");
    const maxRows = optionalInteger(params, "maxRows", { min: 1 });
    const includeHeaders = optionalBoolean(params, "includeHeaders");

    Asc.scope.sheet = sheet ?? null;
    Asc.scope.range = range.trim();
    Asc.scope.maxRows = maxRows ?? 500;
    Asc.scope.includeHeaders = includeHeaders !== false;

    const result = await editor.callCommand<
      { error?: string } | Record<string, unknown>
    >(() => {
      function isEmptyValue(v: unknown): boolean {
        return v === null || v === undefined || v === "";
      }

      function normalizeLineBreaks(v: unknown): unknown {
        return typeof v === "string"
          ? v.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
          : v;
      }

      function normalizeTo2D(raw: unknown, colCount: number): unknown[][] {
        let output: unknown[][];
        if (raw === null || raw === undefined) {
          output = [[]];
        } else if (!Array.isArray(raw)) {
          output = [[raw]];
        } else if (raw.length > 0 && !Array.isArray(raw[0])) {
          output = [raw as unknown[]];
        } else {
          output = raw as unknown[][];
        }
        return output.map((row) => {
          const r = Array.isArray(row)
            ? (row as unknown[]).slice(0, colCount)
            : [];
          while (r.length < colCount) r.push(null);
          return r;
        });
      }

      function findBoundingBox(output: unknown[][], colCount: number) {
        let firstRow = -1;
        let lastRow = -1;
        let firstCol = colCount;
        let lastCol = -1;
        for (let r = 0; r < output.length; r++) {
          for (let c = 0; c < colCount; c++) {
            if (!isEmptyValue(output[r][c])) {
              if (firstRow === -1) firstRow = r;
              lastRow = r;
              if (c < firstCol) firstCol = c;
              if (c > lastCol) lastCol = c;
            }
          }
        }
        if (firstRow === -1) {
          return {
            rows: [] as unknown[][],
            rowCount: 0,
            columnCount: 0,
            rowOffset: 0,
            colOffset: 0,
          };
        }
        const trimmed: unknown[][] = [];
        for (let r = firstRow; r <= lastRow; r++) {
          trimmed.push(output[r].slice(firstCol, lastCol + 1));
        }
        return {
          rows: trimmed,
          rowCount: lastRow - firstRow + 1,
          columnCount: lastCol - firstCol + 1,
          rowOffset: firstRow,
          colOffset: firstCol,
        };
      }

      function normalizeMatrix(rows: unknown[][]): unknown[][] {
        return rows.map((row) =>
          row.map((v) => (isEmptyValue(v) ? null : normalizeLineBreaks(v)))
        );
      }

      function colNumberToLetter(n: number): string {
        let out = "";
        let remaining = n;
        while (remaining > 0) {
          const rem = (remaining - 1) % 26;
          out = String.fromCharCode(65 + rem) + out;
          remaining = Math.floor((remaining - 1) / 26);
        }
        return out;
      }

      function buildRangeAddress(
        startRow: number,
        startCol: number,
        rowCount: number,
        colCount: number
      ): string {
        const topLeft = colNumberToLetter(startCol) + startRow;
        if (rowCount < 1 || colCount < 1) return topLeft;
        if (rowCount === 1 && colCount === 1) return topLeft;
        const bottomRight =
          colNumberToLetter(startCol + colCount - 1) +
          (startRow + rowCount - 1);
        return `${topLeft}:${bottomRight}`;
      }

      const ws = Asc.scope.sheet
        ? Api.GetSheet(Asc.scope.sheet)
        : Api.GetActiveSheet();
      if (!ws) return { error: `Sheet "${Asc.scope.sheet}" not found.` };

      const range = ws.GetRange(Asc.scope.range);
      if (!range) {
        return { error: `Range "${Asc.scope.range}" is invalid.` };
      }

      const totalRows = range.GetRowsCount();
      const cols = range.GetColumnsCount();
      const startRow = range.GetRow();
      const startCol = range.GetCol();

      function emptyPage(nextRange: string | null) {
        return {
          sheet: ws.GetName(),
          requestedRange: Asc.scope.range,
          returnedRange: null,
          headers: [],
          rows: [],
          nextRange,
        };
      }

      if (totalRows === 0) return emptyPage(null);

      const take = Math.min(totalRows, Asc.scope.maxRows);
      const nextRange =
        take < totalRows
          ? buildRangeAddress(startRow + take, startCol, totalRows - take, cols)
          : null;
      const readRange = take < totalRows ? range.Resize(take, cols) : range;
      const raw = readRange.GetValue();
      const output = normalizeTo2D(raw, cols);
      const bbox = findBoundingBox(output, cols);

      if (bbox.rowCount === 0) return emptyPage(nextRange);

      const matrix = normalizeMatrix(bbox.rows);
      const returnedStartRow = startRow + bbox.rowOffset;
      const returnedStartCol = startCol + bbox.colOffset;
      const returnedRange = buildRangeAddress(
        returnedStartRow,
        returnedStartCol,
        bbox.rowCount,
        bbox.columnCount
      );
      const headers =
        Asc.scope.includeHeaders && matrix.length > 0 ? matrix[0] : [];
      const dataRows = Asc.scope.includeHeaders ? matrix.slice(1) : matrix;

      return {
        sheet: ws.GetName(),
        requestedRange: Asc.scope.range,
        returnedRange,
        headers,
        rows: dataRows,
        nextRange,
      };
    });

    if (result && "error" in result && result.error) {
      throw new ToolError(result.error as string);
    }
    return result;
  },
});
