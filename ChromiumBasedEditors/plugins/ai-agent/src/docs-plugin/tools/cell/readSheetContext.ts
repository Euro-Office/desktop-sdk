import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalBoolean,
  optionalInteger,
  optionalString,
} from "../lib/validation";

export const readSheetContext = defineTool({
  name: "readSheetContext",
  description:
    "Scans the sheet and returns every data region found. Call before any action on existing data (writeMacro, sort, filter, conditional formatting, chart) to determine column letters and row bounds. Use allSheets:true for a workbook overview.",
  inputSchema: {
    type: "object",
    properties: {
      sheet: {
        type: "string",
        description:
          "Sheet name. Omit unless user explicitly named a sheet. Default: active sheet.",
      },
      sampleRows: {
        type: "number",
        description:
          "Number of data rows to include as samples. Default 3, max 5, 0 for headers only.",
      },
      allSheets: {
        type: "boolean",
        description:
          "If true, scans ALL sheets. sampleRows defaults to 0 when allSheets is true.",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const sheet = optionalString(params, "sheet");
    const sampleRows = optionalInteger(params, "sampleRows", {
      min: 0,
      max: 5,
    });
    const allSheets = optionalBoolean(params, "allSheets") === true;

    Asc.scope.rcSheet = sheet ?? null;
    Asc.scope.rcAllSheets = allSheets;
    const defaultSample = allSheets ? 0 : 3;
    Asc.scope.rcSampleRows = Math.min(
      sampleRows !== undefined ? sampleRows : defaultSample,
      5
    );

    const result = await editor.callCommand<
      Record<string, unknown> | { error: string }
    >(() => {
      const allSheetsList = Api.GetSheets();
      const sheetNames: string[] = [];
      for (const s of allSheetsList) sheetNames.push(s.GetName());

      function buildTable(
        // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
        ws: any,
        absRow: number,
        absCol: number,
        rowCount: number,
        colCount: number
      ) {
        if (rowCount < 1 || colCount < 1) return null;

        interface ColInfo {
          letter: string;
          header: string | null;
          type: string;
          formulaExample?: string;
        }
        const cols: ColInfo[] = [];
        let unnamedCount = 0;
        for (let c = 0; c < colCount; c++) {
          const hdrCell = ws.GetRangeByNumber(absRow, absCol + c);
          const val = hdrCell.GetValue();
          const colLetter = hdrCell.GetAddress(false, false).replace(/\d/g, "");
          const header =
            val !== null && val !== undefined && val !== ""
              ? String(val)
              : null;
          if (header === null) unnamedCount++;
          cols.push({ letter: colLetter, header, type: "empty" });
        }

        const sampleDepth = Math.min(5, rowCount - 1);
        for (let c = 0; c < colCount; c++) {
          let nFormula = 0;
          let nDate = 0;
          let nNum = 0;
          let nText = 0;
          let nTotal = 0;
          let exampleFormula = "";
          for (let r = 1; r <= sampleDepth; r++) {
            const cell = ws.GetRangeByNumber(absRow + r, absCol + c);
            const v = cell.GetValue();
            if (v === null || v === undefined || v === "") continue;
            nTotal++;
            let formula = "";
            try {
              formula = cell.GetFormula ? String(cell.GetFormula()) : "";
            } catch {
              /* ignore */
            }
            if (formula.charAt(0) === "=") {
              nFormula++;
              if (!exampleFormula) exampleFormula = formula;
            } else if (
              /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(String(v)) ||
              /^\d{4}-\d{2}-\d{2}/.test(String(v))
            ) {
              nDate++;
            } else if (!Number.isNaN(Number(String(v).replace(",", ".")))) {
              nNum++;
            } else {
              nText++;
            }
          }
          const colType =
            nTotal === 0
              ? "empty"
              : nFormula * 2 >= nTotal
                ? "formula"
                : nDate * 2 >= nTotal
                  ? "date"
                  : nNum * 2 >= nTotal
                    ? "number"
                    : "text";
          cols[c].type = colType;
          if (
            !Asc.scope.rcAllSheets &&
            colType === "formula" &&
            exampleFormula
          ) {
            cols[c].formulaExample = exampleFormula;
          }
          // suppress unused var warning on nText
          void nText;
        }

        const sampleRowsData: unknown[][] = [];
        for (let r = 1; r <= Asc.scope.rcSampleRows && r < rowCount; r++) {
          const row: unknown[] = [];
          for (let c = 0; c < colCount; c++) {
            const v = ws.GetRangeByNumber(absRow + r, absCol + c).GetValue();
            row.push(v !== null && v !== undefined && v !== "" ? v : null);
          }
          sampleRowsData.push(row);
        }

        const tl = ws.GetRangeByNumber(absRow, absCol).GetAddress(false, false);
        const br = ws
          .GetRangeByNumber(absRow + rowCount - 1, absCol + colCount - 1)
          .GetAddress(false, false);
        const nextColLetter = ws
          .GetRangeByNumber(absRow, absCol + colCount)
          .GetAddress(false, false)
          .replace(/\d/g, "");

        const result: Record<string, unknown> & {
          _firstCol?: number;
          _lastCol?: number;
        } = {
          regionAddress: `${tl}:${br}`,
          headerRow: absRow + 1,
          dataRowCount: rowCount - 1,
          nextCol: nextColLetter,
          cols,
          sampleRows: sampleRowsData,
          _firstCol: absCol,
          _lastCol: absCol + colCount - 1,
        };
        if (unnamedCount > colCount / 2) {
          result.warning = `${unnamedCount} of ${colCount} header cells are empty (header: null). Check sampleRows to identify what each column actually contains.`;
        }
        return result;
      }

      // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
      function scanSheetTables(ws: any) {
        const usedRange = ws.GetUsedRange();
        if (!usedRange) {
          return { tables: [], activeTableIndex: 0, selection: null };
        }

        const uR0 = usedRange.GetRow() - 1;
        const uC0 = usedRange.GetCol() - 1;
        const uCols = Math.min(usedRange.GetColumnsCount(), 150);
        const limit = Math.min(usedRange.GetRowsCount(), 300);

        // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
        const tables: any[] = [];
        const seen: Record<string, boolean> = {};
        let nextRow = uR0;

        while (nextRow < uR0 + limit) {
          let rowAdvance = nextRow + 1;
          let scanRow = nextRow;

          while (scanRow < Math.min(rowAdvance, uR0 + limit)) {
            let colCursor = uC0;

            while (colCursor < uC0 + uCols) {
              let anchorCol = -1;
              for (let c = colCursor; c < uC0 + uCols; c++) {
                const v = ws.GetRangeByNumber(scanRow, c).GetValue();
                if (v !== null && v !== undefined && v !== "") {
                  anchorCol = c;
                  break;
                }
              }
              if (anchorCol === -1) break;

              const region = ws
                .GetRangeByNumber(scanRow, anchorCol)
                .GetCurrentRegion();
              const rR0 = region.GetRow() - 1;
              const rC0 = region.GetCol() - 1;
              const rKey = `${rR0}:${rC0}`;

              if (!seen[rKey]) {
                seen[rKey] = true;
                const tbl = buildTable(
                  ws,
                  rR0,
                  rC0,
                  region.GetRowsCount(),
                  region.GetColumnsCount()
                );
                if (tbl) tables.push(tbl);
              }
              colCursor = rC0 + region.GetColumnsCount() + 1;
              rowAdvance = Math.max(
                rowAdvance,
                rR0 + region.GetRowsCount() + 1
              );
            }
            scanRow++;
          }
          nextRow = rowAdvance;
        }

        const sel = ws.GetSelection();
        const selAbsRow = sel ? sel.GetRow() - 1 : -1;
        const selAbsCol = sel ? sel.GetCol() - 1 : -1;
        let activeIdx = 0;
        let found = false;
        for (let t = 0; t < tables.length && !found; t++) {
          const tbl = tables[t];
          if (
            selAbsRow >= tbl.headerRow - 1 &&
            selAbsRow <= tbl.headerRow - 1 + tbl.dataRowCount &&
            selAbsCol >= tbl._firstCol &&
            selAbsCol <= tbl._lastCol
          ) {
            activeIdx = t;
            found = true;
          }
        }
        if (!found) {
          for (let t = 0; t < tables.length; t++) {
            const tbl = tables[t];
            if (
              selAbsRow >= tbl.headerRow - 1 &&
              selAbsRow <= tbl.headerRow - 1 + tbl.dataRowCount
            ) {
              activeIdx = t;
              break;
            }
          }
        }
        for (const tbl of tables) {
          tbl._firstCol = undefined;
          tbl._lastCol = undefined;
          tbl._firstCol = undefined;
          tbl._lastCol = undefined;
        }
        return { tables, activeTableIndex: activeIdx };
      }

      if (Asc.scope.rcAllSheets) {
        const sheetsContext: Record<string, unknown>[] = [];
        for (const sheetWs of allSheetsList) {
          const ctx = scanSheetTables(sheetWs);
          sheetsContext.push({
            sheetName: sheetWs.GetName(),
            tables: ctx.tables,
            activeTableIndex: ctx.activeTableIndex,
          });
        }
        return {
          activeSheet: Api.GetActiveSheet().GetName(),
          sheets: sheetNames,
          allSheetsContext: sheetsContext,
        };
      }

      const ws = Asc.scope.rcSheet
        ? Api.GetSheet(Asc.scope.rcSheet)
        : Api.GetActiveSheet();

      if (!ws) {
        return {
          error: `Sheet not found: "${Asc.scope.rcSheet}". Do NOT retry with the same name. To read the active sheet — omit the sheet parameter. Available sheets: ${sheetNames.join(", ")}`,
        };
      }

      const realActiveName = Api.GetActiveSheet().GetName();
      const scan = scanSheetTables(ws);
      return {
        activeSheet: realActiveName,
        sheets: sheetNames,
        selection: ws.GetSelection() ? ws.GetSelection().GetAddress() : null,
        tables: scan.tables,
        activeTableIndex: scan.activeTableIndex,
      };
    });

    if (result && "error" in result && (result as { error?: string }).error) {
      throw new ToolError((result as { error: string }).error);
    }
    return result;
  },
});
