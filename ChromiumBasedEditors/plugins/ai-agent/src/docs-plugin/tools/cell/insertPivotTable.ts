import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalEnum, optionalString, requireString } from "../lib/validation";

const AGG_FUNCS = [
  "Sum",
  "Count",
  "Average",
  "Max",
  "Min",
  "CountNumbers",
  "Product",
  "StdDev",
  "StdDevP",
  "Var",
  "VarP",
] as const;

export const insertPivotTable = defineTool({
  name: "insertPivotTable",
  description: `Creates a pivot table on a new worksheet. Handles simple and medium pivots: row grouping, cross-tabulation (columns), aggregation (sum/count/average/min/max).
Good for: known field names, repeatable pivot creation, structured data with clear headers.
Not for: automatic field discovery, guessing columns from raw data, complex layouts with page fields or multiple value fields — use writeMacro for those.
Call readSheetContext first to get regionAddress (→ range) and column names with their types (text/date → rows/columns; number → valueColumn).
Do NOT pass guessed column names — only exact header names from readSheetContext. Do NOT omit valueColumn.`,
  inputSchema: {
    type: "object",
    properties: {
      sheet: {
        type: "string",
        description: "Sheet name containing the source data.",
      },
      range: {
        type: "string",
        description:
          "Cell range of the source table (e.g. 'A1:I85'). Use regionAddress from readSheetContext.",
      },
      rows: {
        type: "array",
        items: { type: "string" },
        description: "Column names for row grouping (text or date columnType).",
      },
      columns: {
        type: "array",
        items: { type: "string" },
        description: "Column names for cross-tabulation matrix.",
      },
      valueColumn: {
        type: "string",
        description: "Column name to aggregate (number columnType).",
      },
      aggregation: {
        type: "string",
        description: "Aggregation function. Default: Sum.",
        enum: [...AGG_FUNCS],
      },
      outputSheetName: {
        type: "string",
        description: "New pivot sheet name (max 31 chars).",
      },
    },
    required: ["valueColumn"],
  },
  handler: async (params) => {
    const valueColumn = requireString(params, "valueColumn").trim();
    if (!valueColumn) {
      throw new ToolError(
        '"valueColumn" is required (a numeric column). Call readSheetContext first to get column names and types.'
      );
    }

    const rawRows = params.rows;
    const rows = Array.isArray(rawRows)
      ? (rawRows as unknown[])
          .map((c) => (typeof c === "string" ? c.trim() : ""))
          .filter(Boolean)
      : [];
    const rawCols = params.columns;
    const cols = Array.isArray(rawCols)
      ? (rawCols as unknown[])
          .map((c) => (typeof c === "string" ? c.trim() : ""))
          .filter(Boolean)
      : [];

    if (rows.length === 0 && cols.length === 0) {
      throw new ToolError(
        'At least one of "rows" or "columns" must be non-empty (text/date columnType). Call readSheetContext first to get column names.'
      );
    }

    const sheet = optionalString(params, "sheet");
    const range = optionalString(params, "range");
    const aggregation = optionalEnum(params, "aggregation", AGG_FUNCS) ?? "Sum";
    const outputSheetName = optionalString(params, "outputSheetName")?.trim();

    Asc.scope.sheet = sheet ?? null;
    Asc.scope.range = range ?? null;
    Asc.scope.rows = rows;
    Asc.scope.cols = cols;
    Asc.scope.valueColumn = valueColumn;
    Asc.scope.outputSheetName =
      outputSheetName && outputSheetName.length > 0 ? outputSheetName : null;
    Asc.scope.aggFuncConst = aggregation;

    interface PivotResult {
      error?: string;
      sheetName?: string;
      sourceSheet?: string;
      sourceRange?: string;
      rowFields?: string[];
      colFields?: string[];
      valueField?: string;
      aggWarning?: string | null;
    }

    const result = await editor.callCommand<PivotResult>(() => {
      function exactIndex(name: string, headers: string[]): number {
        const n = name.toLowerCase().replace(/[\s\W]/g, "");
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].toLowerCase().replace(/[\s\W]/g, "") === n) return i;
        }
        return -1;
      }

      function sanitizeSheetName(name: string): string {
        const s = name
          .replace(/[\\/*?:[\]]/g, "")
          .replace(/[\s_]+/g, "_")
          .replace(/^_|_$/g, "");
        return s.length > 28 ? s.substring(0, 28) : s || "Pivot";
      }

      function uniqueSheetName(name: string): string {
        const taken: Record<string, boolean> = {};
        const sheetsList = Api.Sheets;
        for (const s of sheetsList) taken[s.Name.toLowerCase()] = true;
        if (!taken[name.toLowerCase()]) return name;
        for (let n = 1; n < 1000; n++) {
          const candidate = `${name}_${n}`;
          if (!taken[candidate.toLowerCase()]) return candidate;
        }
        return name;
      }

      const ws = Asc.scope.sheet
        ? Api.GetSheet(Asc.scope.sheet)
        : Api.GetActiveSheet();
      if (!ws) {
        return {
          error: `Sheet "${Asc.scope.sheet}" not found. Check the sheet name or call readSheetContext to list available sheets.`,
        };
      }

      let sourceRange = null;
      if (Asc.scope.range) {
        sourceRange = ws.GetRange(Asc.scope.range);
        if (!sourceRange) {
          return {
            error: `Range "${Asc.scope.range}" is invalid. Use regionAddress from readSheetContext.`,
          };
        }
      } else {
        const sel = ws.GetSelection();
        sourceRange = sel ? sel.GetCurrentRegion() : null;
        if (!sourceRange) {
          return {
            error:
              'No data found around the selection. Specify "range" from readSheetContext.regionAddress.',
          };
        }
      }

      const colCount = sourceRange.GetColumnsCount();
      const rowCount = sourceRange.GetRowsCount();
      if (colCount < 2) {
        return {
          error: `Range has only ${colCount} column(s); pivot requires at least 2.`,
        };
      }
      if (rowCount < 2) {
        return {
          error: `Range has only ${rowCount} row(s); pivot requires a header row + at least 1 data row.`,
        };
      }

      const raw = sourceRange.Resize(1, colCount).GetValue2();
      const rawRow = Array.isArray(raw[0]) ? raw[0] : raw;
      const headers: string[] = [];
      for (let i = 0; i < colCount; i++) {
        const v =
          i < rawRow.length && rawRow[i] != null ? String(rawRow[i]) : "";
        headers.push(v || `Column_${i + 1}`);
      }
      const avail = ` Available columns: ${JSON.stringify(headers)}.`;

      const badRows: string[] = [];
      let rowIndices: number[] = [];
      for (const name of Asc.scope.rows) {
        const idx = exactIndex(name, headers);
        if (idx < 0) badRows.push(name);
        else rowIndices.push(idx);
      }
      if (badRows.length > 0) {
        return {
          error: `Row field(s) ${JSON.stringify(badRows)} not found in the data.${avail} Retry with exact header names from readSheetContext.`,
        };
      }

      const badCols: string[] = [];
      let colIndices: number[] = [];
      for (const name of Asc.scope.cols) {
        const idx = exactIndex(name, headers);
        if (idx < 0) badCols.push(name);
        else colIndices.push(idx);
      }
      if (badCols.length > 0) {
        return {
          error: `Column field(s) ${JSON.stringify(badCols)} not found in the data.${avail} Retry with exact header names from readSheetContext.`,
        };
      }

      const dataIndex = exactIndex(Asc.scope.valueColumn, headers);
      if (dataIndex < 0) {
        return {
          error: `Value column "${Asc.scope.valueColumn}" not found in the data.${avail} Retry with an exact header name (numeric column) from readSheetContext.`,
        };
      }

      const seen: Record<number, boolean> = {};
      rowIndices = rowIndices.filter((n) => {
        if (seen[n]) return false;
        seen[n] = true;
        return true;
      });
      colIndices = colIndices.filter((n) => {
        if (seen[n]) return false;
        seen[n] = true;
        return true;
      });
      if (seen[dataIndex]) {
        return {
          error: `valueColumn "${Asc.scope.valueColumn}" is already used as a grouping field. Choose a different numeric column for aggregation.${avail}`,
        };
      }

      let outName: string;
      if (Asc.scope.outputSheetName) {
        outName = sanitizeSheetName(Asc.scope.outputSheetName);
      } else {
        const parts: string[] = rowIndices
          .slice(0, 2)
          .map((i: number) => headers[i]);
        if (colIndices.length > 0) parts.push(headers[colIndices[0]]);
        parts.push(headers[dataIndex]);
        outName = sanitizeSheetName(parts.join("_"));
      }
      outName = uniqueSheetName(outName);

      const pivotTable = Api.InsertPivotNewWorksheet(sourceRange, outName);
      if (!pivotTable) {
        return {
          error:
            "Failed to create pivot table. The data range may be invalid or the API is unavailable.",
        };
      }

      const pivotFields = pivotTable.GetPivotFields();
      const rowNames = rowIndices
        .filter((i: number) => i < pivotFields.length)
        .map((i: number) => pivotFields[i].GetName());
      const colNames = colIndices
        .filter((i: number) => i < pivotFields.length)
        .map((i: number) => pivotFields[i].GetName());
      const dataName =
        dataIndex < pivotFields.length ? pivotFields[dataIndex].GetName() : "";

      if (rowNames.length > 0 || colNames.length > 0) {
        pivotTable.AddFields({ rows: rowNames, columns: colNames });
      }

      let aggWarning: string | null = null;
      if (dataName) {
        const dataField = pivotTable.AddDataField(dataName);
        if (dataField) {
          try {
            dataField.SetFunction(Asc.scope.aggFuncConst);
            dataField.SetCaption(`${Asc.scope.aggFuncConst} of ${dataName}`);
          } catch {
            aggWarning = `SetFunction("${Asc.scope.aggFuncConst}") failed — pivot uses default SUM.`;
          }
        }
      }

      return {
        sheetName: outName,
        sourceSheet: ws.Name,
        sourceRange: sourceRange.GetAddress(false, false),
        rowFields: rowNames,
        colFields: colNames,
        valueField: dataName,
        aggWarning,
      };
    });

    if (result?.error) throw new ToolError(result.error);

    if (!result || !result.sheetName) return { isApply: false };

    const parts: string[] = [];
    if (result.rowFields && result.rowFields.length > 0) {
      parts.push(`rows: ${result.rowFields.join(", ")}`);
    }
    if (result.colFields && result.colFields.length > 0) {
      parts.push(`columns: ${result.colFields.join(", ")}`);
    }
    if (result.valueField) {
      parts.push(`values: ${aggregation}(${result.valueField})`);
    }
    let summary = `Pivot table created on sheet "${result.sheetName}" (source: "${result.sourceSheet}"!${result.sourceRange})`;
    if (parts.length > 0) summary += ` — ${parts.join("; ")}`;
    summary += ".";
    if (result.aggWarning) summary += ` Warning: ${result.aggWarning}`;
    return summary;
  },
});
