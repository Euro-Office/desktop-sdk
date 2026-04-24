import { editor } from "../../library/editor";
import { optionalRgbColor } from "../lib/colorValidation";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalBoolean,
  optionalEnum,
  optionalString,
} from "../lib/validation";

const DIRECTIONS = ["xlContext", "xlLTR", "xlRTL"] as const;

export const addDataBars = defineTool({
  name: "addDataBars",
  description:
    "Adds data bar conditional formatting to display values as horizontal bars within cells. Useful for creating in-cell bar charts and comparing values at a glance. Do NOT use for color gradient visualization — use addColorScale.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range to apply data bars (e.g., 'A1:D10'). Omit to use current selection.",
      },
      barColor: {
        type: "object",
        description:
          "Bar color as RGB object {r,g,b}. Integers 0-255. Defaults to blue.",
        properties: {
          r: { type: "number" },
          g: { type: "number" },
          b: { type: "number" },
        },
      },
      showValue: {
        type: "boolean",
        description:
          "Whether to show the cell values along with bars (default: true).",
        default: true,
      },
      direction: {
        type: "string",
        description:
          "Direction of bars - 'xlLTR', 'xlRTL', 'xlContext' (default: 'xlLTR').",
        enum: [...DIRECTIONS],
        default: "xlLTR",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    const barColor = optionalRgbColor(
      params,
      "barColor",
      '{"r":0,"g":112,"b":192}'
    );
    const showValue = optionalBoolean(params, "showValue");
    const direction = optionalEnum(params, "direction", DIRECTIONS);

    Asc.scope.range = range;
    Asc.scope.barColor = barColor;
    Asc.scope.showValue = showValue;
    Asc.scope.direction = direction;

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
        const databar = fc.AddDatabar();
        if (!databar) {
          return {
            error: "Failed to create data bar conditional formatting rule.",
          };
        }

        if (Asc.scope.barColor) {
          databar.SetBarColor(
            Api.CreateColorFromRGB(
              Asc.scope.barColor.r,
              Asc.scope.barColor.g,
              Asc.scope.barColor.b
            )
          );
        } else {
          databar.SetBarColor(Api.CreateColorFromRGB(0, 112, 192));
        }

        if (typeof Asc.scope.showValue === "boolean") {
          databar.SetShowValue(Asc.scope.showValue);
        }
        if (Asc.scope.direction) {
          databar.SetDirection(Asc.scope.direction);
        }

        return { addr: r.GetAddress(false, false) };
      }
    );

    if (result?.error) throw new ToolError(result.error);
    return `Added data bars to ${result?.addr || range || "selection"}.`;
  },
});
