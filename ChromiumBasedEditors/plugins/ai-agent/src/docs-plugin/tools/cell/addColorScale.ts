import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalString } from "../lib/validation";

export const addColorScale = defineTool({
  name: "addColorScale",
  description:
    "Applies color scale conditional formatting to visualize data with gradient colors. Creates a heat map effect where values are represented by colors. Use 2-color scale for simple comparisons or 3-color scale for more detailed data visualization. Do NOT use for value-based rules (use addCellValueCondition).",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range to apply color scale (e.g., 'A1:D10'). Omit to use current selection.",
      },
      colorScaleType: {
        type: "number",
        description:
          "Color scale type: 2 = two-color gradient; 3 = three-color gradient. Default: 3.",
        enum: [2, 3],
        default: 3,
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    const colorScaleType = params.colorScaleType;
    if (
      colorScaleType !== undefined &&
      colorScaleType !== null &&
      colorScaleType !== 2 &&
      colorScaleType !== 3
    ) {
      throw new ToolError(
        `Invalid colorScaleType "${String(colorScaleType)}". Available options: [2, 3]`
      );
    }
    const scale = colorScaleType ?? 3;

    Asc.scope.range = range;
    Asc.scope.colorScaleType = scale;

    const result = await editor.callCommand<{
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
        r = ws.Selection;
      }

      const fc = r.GetFormatConditions();
      const cond = fc.AddColorScale(Asc.scope.colorScaleType);
      if (!cond) {
        return {
          error: "Failed to create color scale conditional formatting rule.",
        };
      }
      return { addr: r.GetAddress(false, false) };
    });

    if (result?.error) throw new ToolError(result.error);

    return `Applied ${scale}-color scale to ${result?.addr || range || "selection"}.`;
  },
});
