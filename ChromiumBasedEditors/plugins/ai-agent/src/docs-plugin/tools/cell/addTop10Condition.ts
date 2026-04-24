import { editor } from "../../library/editor";
import { optionalRgbColor } from "../lib/colorValidation";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalBoolean,
  optionalNumber,
  optionalString,
} from "../lib/validation";

export const addTop10Condition = defineTool({
  name: "addTop10Condition",
  description:
    "Highlights the top or bottom ranked values in a range. Can highlight by item count (e.g., top 10) or percentage (e.g., top 20%). Do NOT use for above/below average — use addAboveAverage.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range to apply condition. Omit to use current selection.",
      },
      rank: {
        type: "number",
        description: "Number of top/bottom items to highlight (default: 10).",
        default: 10,
      },
      isBottom: {
        type: "boolean",
        description: "True for bottom values, false for top (default: false).",
        default: false,
      },
      isPercent: {
        type: "boolean",
        description: "True to treat rank as percentage, false as item count.",
        default: false,
      },
      fillColor: {
        type: "object",
        description:
          "Fill color as RGB object {r,g,b}. Defaults to light green.",
        properties: {
          r: { type: "number" },
          g: { type: "number" },
          b: { type: "number" },
        },
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    const rank = optionalNumber(params, "rank");
    if (rank !== undefined && rank < 1) {
      throw new ToolError(
        `Invalid rank "${rank}". Must be a positive number (e.g., 10).`
      );
    }
    const isBottom = optionalBoolean(params, "isBottom") ?? false;
    const isPercent = optionalBoolean(params, "isPercent") ?? false;
    const fillColor = optionalRgbColor(
      params,
      "fillColor",
      '{"r":255,"g":0,"b":0}'
    );

    Asc.scope.range = range;
    Asc.scope.rank = rank ?? 10;
    Asc.scope.isBottom = isBottom;
    Asc.scope.isPercent = isPercent;
    Asc.scope.fillColor = fillColor;

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
        const cond = fc.AddTop10();
        if (!cond) {
          return {
            error: "Failed to create top/bottom conditional formatting rule.",
          };
        }
        if (cond.SetRank) cond.SetRank(Asc.scope.rank);
        if (cond.SetBottom) cond.SetBottom(Asc.scope.isBottom);
        if (cond.SetPercent) cond.SetPercent(Asc.scope.isPercent);

        if (Asc.scope.fillColor) {
          cond.SetFillColor(
            Api.CreateColorFromRGB(
              Asc.scope.fillColor.r,
              Asc.scope.fillColor.g,
              Asc.scope.fillColor.b
            )
          );
        } else {
          cond.SetFillColor(Api.CreateColorFromRGB(144, 238, 144));
        }
        return { addr: r.GetAddress(false, false) };
      }
    );

    if (result?.error) throw new ToolError(result.error);

    const direction = isBottom ? "Bottom" : "Top";
    const effectiveRank = rank ?? 10;
    const suffix = isPercent ? "%" : ` item${effectiveRank > 1 ? "s" : ""}`;
    return `Highlighted ${direction} ${effectiveRank}${suffix} in ${result?.addr || range || "selection"}.`;
  },
});
