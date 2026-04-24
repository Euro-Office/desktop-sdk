import { editor } from "../../library/editor";
import { optionalRgbColor } from "../lib/colorValidation";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalString, requireEnum } from "../lib/validation";

const OPERATORS = [
  "xlGreater",
  "xlLess",
  "xlEqual",
  "xlNotEqual",
  "xlGreaterEqual",
  "xlLessEqual",
  "xlBetween",
  "xlNotBetween",
] as const;

const OP_LABELS: Record<string, string> = {
  xlGreater: ">",
  xlLess: "<",
  xlEqual: "=",
  xlNotEqual: "≠",
  xlGreaterEqual: "≥",
  xlLessEqual: "≤",
  xlBetween: "between",
  xlNotBetween: "not between",
};

export const addCellValueCondition = defineTool({
  name: "addCellValueCondition",
  description:
    "Creates conditional formatting rules based on cell values using comparison operators (greater than, less than, equal to, between, etc.). This is the primary tool for all value-based conditional formatting. If the user specifies an operator and value — use them directly. If the user asks for conditional formatting without a concrete threshold (e.g. 'highlight high values', 'mark important cells') — first call getRangeData to read the range, analyze the values, choose a meaningful threshold yourself, then call this tool. Do NOT use for above/below average rules — use addAboveAverage. Do NOT use for color scale/heat map — use addColorScale",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range to apply condition (e.g., 'E2:E81'). Omit to use current selection.",
      },
      operator: {
        type: "string",
        description:
          "Comparison operator - 'xlGreater', 'xlLess', 'xlEqual', 'xlNotEqual', 'xlGreaterEqual', 'xlLessEqual', 'xlBetween', 'xlNotBetween'.",
        enum: [...OPERATORS],
      },
      value1: {
        type: ["string", "number"],
        description:
          "First comparison value or formula. Required for all operators.",
      },
      value2: {
        type: ["string", "number"],
        description:
          "Second boundary value — required only for 'xlBetween' and 'xlNotBetween'.",
      },
      fillColor: {
        type: "object",
        description:
          "Background fill color as RGB object {r,g,b}. Integers 0-255. Defaults to yellow.",
        properties: {
          r: { type: "number" },
          g: { type: "number" },
          b: { type: "number" },
        },
      },
      fontColor: {
        type: "object",
        description: "Font color as RGB object {r,g,b}. Integers 0-255.",
        properties: {
          r: { type: "number" },
          g: { type: "number" },
          b: { type: "number" },
        },
      },
    },
    required: ["operator", "value1"],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    const operator = requireEnum(params, "operator", OPERATORS);
    const value1 = params.value1;
    if (value1 === undefined || value1 === null) {
      throw new ToolError('Parameter "value1" is required.');
    }
    const value2 = params.value2;
    if (
      (operator === "xlBetween" || operator === "xlNotBetween") &&
      value2 === undefined
    ) {
      throw new ToolError(
        `Operator "${operator}" requires value2 parameter (the second boundary value).`
      );
    }
    const fillColor = optionalRgbColor(
      params,
      "fillColor",
      '{"r":255,"g":0,"b":0}'
    );
    const fontColor = optionalRgbColor(
      params,
      "fontColor",
      '{"r":255,"g":0,"b":0}'
    );

    Asc.scope.range = range;
    Asc.scope.operator = operator;
    Asc.scope.value1 = value1;
    Asc.scope.value2 = value2;
    Asc.scope.fillColor = fillColor;
    Asc.scope.fontColor = fontColor;

    const result = await editor.callCommand<{ addr?: string; error?: string }>(
      () => {
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

        const fc = r.GetFormatConditions();
        const cond = fc.Add(
          "xlCellValue",
          Asc.scope.operator,
          Asc.scope.value1,
          Asc.scope.value2
        );
        if (!cond) {
          return {
            error:
              "Failed to create conditional formatting rule. Check that operator and value1 are valid.",
          };
        }

        if (Asc.scope.fontColor) {
          const c = Api.CreateColorFromRGB(
            Asc.scope.fontColor.r,
            Asc.scope.fontColor.g,
            Asc.scope.fontColor.b
          );
          const font = cond.GetFont();
          if (font?.SetColor) font.SetColor(c);
        }

        if (Asc.scope.fillColor) {
          cond.SetFillColor(
            Api.CreateColorFromRGB(
              Asc.scope.fillColor.r,
              Asc.scope.fillColor.g,
              Asc.scope.fillColor.b
            )
          );
        } else {
          cond.SetFillColor(Api.CreateColorFromRGB(255, 255, 0));
        }

        return { addr: r.GetAddress(false, false) };
      }
    );

    if (result?.error) throw new ToolError(result.error);

    const condStr =
      operator === "xlBetween" || operator === "xlNotBetween"
        ? `value ${OP_LABELS[operator]} ${value1} and ${value2}`
        : `value ${OP_LABELS[operator]} ${value1}`;
    return `Conditional formatting applied to ${result?.addr || range || "selection"}: ${condStr}.`;
  },
});
