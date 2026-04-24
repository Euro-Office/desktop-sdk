import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalBoolean,
  optionalInteger,
  optionalString,
} from "../lib/validation";

export const getCellDetails = defineTool({
  name: "getCellDetails",
  description:
    "READ. Returns detailed cell info grouped by style similarity (compact format). Use for auditing, formula inspection, or style checks. For bulk data reading use getRangeData.",
  inputSchema: {
    type: "object",
    properties: {
      sheet: {
        type: "string",
        description: "Sheet name. If omitted, uses the active sheet.",
      },
      ranges: {
        type: "array",
        items: { type: "string" },
        description: 'A1 notation ranges, e.g. ["G2:G20", "B1:F1"].',
      },
      includeStyles: {
        type: "boolean",
        description: "Include styles in response (default: true).",
      },
      cellLimit: {
        type: "number",
        description: "Max total cells across all ranges (default: 200).",
      },
    },
    required: ["ranges"],
  },
  handler: async (params) => {
    const raw = params.ranges;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new ToolError(
        'Parameter "ranges" must be a non-empty array of A1 range strings, e.g. ["G2:G10"].'
      );
    }
    const ranges: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      if (typeof raw[i] !== "string" || !(raw[i] as string).trim()) {
        throw new ToolError(
          `Parameter "ranges[${i}]" must be a non-empty string. Got: ${JSON.stringify(raw[i])}`
        );
      }
      ranges.push(raw[i] as string);
    }
    const sheet = optionalString(params, "sheet");
    const includeStyles = optionalBoolean(params, "includeStyles") !== false;
    const cellLimit = optionalInteger(params, "cellLimit", { min: 1 }) ?? 200;

    Asc.scope.sheet = sheet ?? null;
    Asc.scope.ranges = ranges;
    Asc.scope.includeStyles = includeStyles;
    Asc.scope.cellLimit = cellLimit;

    const result = await editor.callCommand<
      Record<string, unknown> | { error: string }
    >(() => {
      const ws = Asc.scope.sheet
        ? Api.GetSheet(Asc.scope.sheet)
        : Api.GetActiveSheet();
      if (!ws) return { error: `Sheet "${Asc.scope.sheet}" not found.` };

      function colNumToLetter(n: number): string {
        let s = "";
        let remaining = n;
        while (remaining > 0) {
          const rem = (remaining - 1) % 26;
          s = String.fromCharCode(65 + rem) + s;
          remaining = Math.floor((remaining - 1) / 26);
        }
        return s;
      }

      function cellAddr(row1: number, col1: number): string {
        return colNumToLetter(col1) + row1;
      }

      function rangeAddr(
        r1: number,
        c1: number,
        r2: number,
        c2: number
      ): string {
        const a = cellAddr(r1, c1);
        const b = cellAddr(r2, c2);
        return r1 === r2 && c1 === c2 ? a : `${a}:${b}`;
      }

      function toHex(v: number): string {
        return (v < 16 ? "0" : "") + v.toString(16);
      }

      function packedRgbToHex(rgb: number): string {
        return `#${toHex((rgb >> 16) & 0xff)}${toHex((rgb >> 8) & 0xff)}${toHex(rgb & 0xff)}`;
      }

      // biome-ignore lint/suspicious/noExplicitAny: editor API dynamic
      function getCellStyle(cell: any): Record<string, unknown> {
        const style: Record<string, unknown> = {};
        try {
          const font = cell.GetCharacters(1).GetFont();
          if (font) {
            if (font.GetBold() === true) style.b = true;
            if (font.GetItalic() === true) style.i = true;
            const sz = font.GetSize();
            if (sz) style.sz = sz;
            const fn = font.GetName();
            if (fn) style.fn = fn;
            try {
              const c = font.GetColor();
              if (c) style.fc = packedRgbToHex(c.GetRGB());
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
        try {
          const fc = cell.GetFillColor();
          if (fc && fc !== "No Fill") style.bg = packedRgbToHex(fc.GetRGB());
        } catch {
          /* ignore */
        }
        try {
          const fmt = cell.GetNumberFormat();
          if (fmt && fmt !== "General" && fmt !== "") style.fmt = fmt;
        } catch {
          /* ignore */
        }
        try {
          if (cell.GetWrapText() === true) style.wt = true;
        } catch {
          /* ignore */
        }
        try {
          const or = cell.GetOrientation();
          if (or) style.or = or;
        } catch {
          /* ignore */
        }
        return style;
      }

      function groupGrid(
        // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
        grid: any[][],
        rows: number,
        cols: number,
        baseRow1: number,
        baseCol1: number
      ): Record<string, unknown> {
        if (rows === 0 || cols === 0) return {};
        interface Run {
          c1: number;
          c2: number;
          fp: string;
          obj: unknown;
        }
        const rowRuns: Run[][] = [];
        for (let r = 0; r < rows; r++) {
          const runs: Run[] = [];
          let cur: Run | null = null;
          for (let c = 0; c < cols; c++) {
            const cell = grid[r][c];
            if (cur && cur.fp === cell.fp) {
              cur.c2 = c;
            } else {
              cur = { c1: c, c2: c, fp: cell.fp, obj: cell.obj };
              runs.push(cur);
            }
          }
          rowRuns.push(runs);
        }

        interface Rect {
          r1: number;
          r2: number;
          c1: number;
          c2: number;
          fp: string;
          obj: unknown;
        }
        let rects: Rect[] = rowRuns[0].map((run) => ({
          r1: 0,
          r2: 0,
          c1: run.c1,
          c2: run.c2,
          fp: run.fp,
          obj: run.obj,
        }));

        for (let r = 1; r < rows; r++) {
          const cur = rowRuns[r];
          const matched = new Array(cur.length).fill(false);
          const newRects: Rect[] = [];
          for (const rect of rects) {
            if (rect.r2 === r - 1) {
              for (let ci = 0; ci < cur.length; ci++) {
                if (
                  !matched[ci] &&
                  cur[ci].c1 === rect.c1 &&
                  cur[ci].c2 === rect.c2 &&
                  cur[ci].fp === rect.fp
                ) {
                  rect.r2 = r;
                  matched[ci] = true;
                  break;
                }
              }
            }
            newRects.push(rect);
          }
          for (let ci = 0; ci < cur.length; ci++) {
            if (!matched[ci]) {
              newRects.push({
                r1: r,
                r2: r,
                c1: cur[ci].c1,
                c2: cur[ci].c2,
                fp: cur[ci].fp,
                obj: cur[ci].obj,
              });
            }
          }
          rects = newRects;
        }

        const out: Record<string, unknown> = {};
        for (const rect of rects) {
          if (!rect.obj || !rect.fp || rect.fp === "{}") continue;
          const key = rangeAddr(
            baseRow1 + rect.r1,
            baseCol1 + rect.c1,
            baseRow1 + rect.r2,
            baseCol1 + rect.c2
          );
          out[key] = rect.obj;
        }
        return out;
      }

      const incl = Asc.scope.includeStyles;
      const limit = Asc.scope.cellLimit;
      let totalCells = 0;
      let globalHasMore = false;
      const out = [];

      for (let ri = 0; ri < Asc.scope.ranges.length; ri++) {
        const rangeRef = Asc.scope.ranges[ri];
        const range = ws.GetRange(rangeRef);
        if (!range) {
          out.push({
            range: rangeRef,
            error: `Range "${rangeRef}" is invalid.`,
          });
          continue;
        }

        let rows = range.GetRowsCount();
        const cols = range.GetColumnsCount();
        const r0 = range.GetRow();
        const c0 = range.GetCol();

        if (totalCells >= limit) {
          globalHasMore = true;
          break;
        }
        const remaining = limit - totalCells;
        const maxRows = Math.min(rows, Math.floor(remaining / cols));
        if (maxRows <= 0) {
          globalHasMore = true;
          break;
        }
        if (maxRows < rows) globalHasMore = true;
        rows = maxRows;

        const cells: Record<string, unknown> = {};
        // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
        const styleGrid: any[][] = [];

        for (let r = 0; r < rows; r++) {
          if (incl) styleGrid.push([]);
          for (let c = 0; c < cols; c++) {
            const cell = ws.GetRangeByNumber(r0 - 1 + r, c0 - 1 + c);
            const addr = cellAddr(r0 + r, c0 + c);
            const value = cell.GetValue();
            const rawFormula = cell.GetFormula();
            const formula =
              rawFormula && rawFormula.charAt(0) === "=" ? rawFormula : null;
            const hasValue =
              value !== null && value !== undefined && value !== "";
            if (formula) {
              cells[addr] = [hasValue ? value : null, formula];
            } else if (hasValue) {
              cells[addr] = value;
            }
            if (incl) {
              const styleObj = getCellStyle(cell);
              styleGrid[r].push({
                fp: JSON.stringify(styleObj),
                obj: styleObj,
              });
            }
          }
        }

        totalCells += rows * cols;

        const entry: Record<string, unknown> = { range: rangeRef };
        if (Object.keys(cells).length) entry.cells = cells;
        if (incl) {
          const styles = groupGrid(styleGrid, rows, cols, r0, c0);
          if (Object.keys(styles).length) entry.styles = styles;
        }
        out.push(entry);

        if (totalCells >= limit) {
          if (ri < Asc.scope.ranges.length - 1) globalHasMore = true;
          break;
        }
      }

      return { hasMore: globalHasMore, ranges: out };
    });

    if (result && "error" in result && (result as { error?: string }).error) {
      throw new ToolError((result as { error: string }).error);
    }
    return result;
  },
});
