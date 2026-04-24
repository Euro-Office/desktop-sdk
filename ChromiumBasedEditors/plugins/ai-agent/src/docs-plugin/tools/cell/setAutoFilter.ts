import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalBoolean,
  optionalEnum,
  optionalInteger,
  optionalString,
} from "../lib/validation";

const OPERATORS = [
  "xlAnd",
  "xlOr",
  "xlFilterValues",
  "xlTop10Items",
  "xlTop10Percent",
  "xlBottom10Items",
  "xlBottom10Percent",
  "xlFilterCellColor",
  "xlFilterFontColor",
  "xlFilterDynamic",
] as const;

export const setAutoFilter = defineTool({
  name: "setAutoFilter",
  description:
    "Applies autofilter to a data range. Supports filtering by column number or name, value comparison, multiple values, top/bottom N, color-based and dynamic filters.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description: "Cell range to apply autofilter.",
      },
      field: {
        type: "number",
        description: "Field number (starting from 1, left-most field).",
      },
      fieldName: {
        type: "string",
        description:
          "Column name/header for filtering (auto-resolves to field number).",
      },
      criteria1: {
        type: "string",
        description:
          'Criteria string (e.g., ">10"), JSON-encoded color ({"r":255,"g":0,"b":0}), or dynamic filter constant.',
      },
      criteria1Array: {
        type: "array",
        items: { type: ["string", "number"] },
        description: "Array of values for xlFilterValues operator.",
      },
      operator: {
        type: "string",
        description: "Filter operator.",
        enum: [...OPERATORS],
      },
      criteria2: {
        type: "string",
        description: "Second criteria for compound filters (xlAnd/xlOr).",
      },
      visibleDropDown: {
        type: "boolean",
        description: "Show/hide filter dropdown arrow (default: true).",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    const field = optionalInteger(params, "field", { min: 1 });
    const fieldName = optionalString(params, "fieldName");
    const criteria1 = params.criteria1;
    const criteria2 = params.criteria2;
    const criteria1Array = params.criteria1Array;
    const operator = optionalEnum(params, "operator", OPERATORS);
    const visibleDropDown = optionalBoolean(params, "visibleDropDown");

    if (Array.isArray(criteria1)) {
      throw new ToolError(
        "Invalid criteria1: must be a string, not an array. Use criteria1Array parameter for multiple values."
      );
    }
    if (Array.isArray(criteria2)) {
      throw new ToolError(
        "Invalid criteria2: must be a string, not an array. Use criteria1Array parameter for multiple values."
      );
    }

    Asc.scope.range = range;
    Asc.scope.field = field;
    Asc.scope.fieldName = fieldName;
    Asc.scope.criteria1 = criteria1;
    Asc.scope.criteria1Array = criteria1Array;
    Asc.scope.operator = operator;
    Asc.scope.criteria2 = criteria2;
    Asc.scope.visibleDropDown = visibleDropDown;

    // Resolve fieldName → field index on the fly (header lookup in range)
    if (Asc.scope.fieldName && !Asc.scope.field) {
      const fieldRes = await editor.callCommand<{
        error?: string;
        field?: number;
      }>(() => {
        const ws = Api.GetActiveSheet();
        let _range = null;
        if (Asc.scope.range) {
          _range = ws.GetRange(Asc.scope.range);
          if (!_range) {
            return {
              error: `Invalid range "${Asc.scope.range}". Please provide a valid Excel range like 'A1:D10'.`,
            };
          }
        } else {
          _range = Api.GetSelection();
        }

        const cols = _range.GetColumnsCount();
        const startCol = _range.GetCol();
        const startRow = _range.GetRow();
        const needle = String(Asc.scope.fieldName).toLowerCase();

        let exactIdx = -1;
        let partialIdx = -1;
        for (let c = 0; c < cols; c++) {
          const header = String(
            ws.GetRangeByNumber(startRow - 1, startCol - 1 + c).GetValue()
          ).toLowerCase();
          if (header === needle) {
            exactIdx = c + 1;
            break;
          }
          if (partialIdx === -1 && header.indexOf(needle) !== -1) {
            partialIdx = c + 1;
          }
        }
        const idx = exactIdx !== -1 ? exactIdx : partialIdx;
        if (idx === -1) {
          return {
            error: `Column "${Asc.scope.fieldName}" not found in the header row.`,
          };
        }
        return { field: idx };
      });
      if (fieldRes?.error) throw new ToolError(fieldRes.error);
      Asc.scope.field = fieldRes?.field;
    }

    const filterResult = await editor.callCommand<{
      addr?: string;
      error?: string;
    }>(() => {
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
        r = Api.GetSelection();
        if (!r) {
          return {
            error:
              "No range specified and no cells are currently selected. Please provide a range parameter (e.g., 'A1:D10').",
          };
        }
      }

      if (Asc.scope.field != null && typeof Asc.scope.field !== "number") {
        return {
          error: `Invalid field "${Asc.scope.field}". Must be a number (e.g., 1)`,
        };
      }

      let c1 = Array.isArray(Asc.scope.criteria1Array)
        ? Asc.scope.criteria1Array
        : Asc.scope.criteria1;
      if (c1 && typeof c1 === "string" && c1.startsWith("{")) {
        try {
          c1 = JSON.parse(c1);
        } catch {
          /* ignore */
        }
      }
      if (
        Asc.scope.operator === "xlFilterCellColor" ||
        Asc.scope.operator === "xlFilterFontColor"
      ) {
        if (
          c1 &&
          typeof c1 === "object" &&
          c1.r !== undefined &&
          c1.g !== undefined &&
          c1.b !== undefined
        ) {
          c1 = Api.CreateColorFromRGB(c1.r, c1.g, c1.b);
        }
      }

      r.SetAutoFilter(
        Asc.scope.field,
        c1,
        Asc.scope.operator,
        Asc.scope.criteria2,
        Asc.scope.visibleDropDown
      );

      return { addr: r.GetAddress(false, false) };
    });

    if (filterResult?.error) throw new ToolError(filterResult.error);

    const addr = filterResult?.addr || range || "selection";
    let msg = `Applied autofilter to ${addr}`;
    const colLabel = fieldName
      ? `"${fieldName}" (col ${Asc.scope.field})`
      : field != null
        ? `col ${field}`
        : null;

    if (colLabel) {
      let criteriaDesc: string | undefined;
      if (operator === "xlFilterValues" && Array.isArray(criteria1Array)) {
        criteriaDesc = `values [${criteria1Array.join(", ")}]`;
      } else if (operator === "xlTop10Items") {
        criteriaDesc = `top ${criteria1} items`;
      } else if (operator === "xlBottom10Items") {
        criteriaDesc = `bottom ${criteria1} items`;
      } else if (operator === "xlTop10Percent") {
        criteriaDesc = `top ${criteria1}%`;
      } else if (operator === "xlBottom10Percent") {
        criteriaDesc = `bottom ${criteria1}%`;
      } else if (operator === "xlFilterCellColor") {
        criteriaDesc = "cell color";
      } else if (operator === "xlFilterFontColor") {
        criteriaDesc = "font color";
      } else if (criteria1 && criteria2 && operator) {
        criteriaDesc = `${criteria1} ${operator} ${criteria2}`;
      } else if (criteria1) {
        criteriaDesc = String(criteria1);
      }

      msg += `, filtered ${colLabel}${criteriaDesc ? ` by ${criteriaDesc}` : ""}`;
    }
    return `${msg}.`;
  },
});
