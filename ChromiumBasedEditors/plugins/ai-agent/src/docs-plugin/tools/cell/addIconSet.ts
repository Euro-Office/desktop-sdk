import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalBoolean,
  optionalEnum,
  optionalString,
} from "../lib/validation";

const ICON_SET_TYPES = [
  "xl3Arrows",
  "xl3ArrowsGray",
  "xl3Flags",
  "xl3TrafficLights1",
  "xl3TrafficLights2",
  "xl3Signs",
  "xl3Symbols",
  "xl3Symbols2",
  "xl4Arrows",
  "xl4ArrowsGray",
  "xl4RedToBlack",
  "xl4CRV",
  "xl4TrafficLights",
  "xl5Arrows",
  "xl5ArrowsGray",
  "xl5CRV",
  "xl5Quarters",
  "xl3Stars",
  "xl3Triangles",
  "xl5Boxes",
] as const;

const ICON_SET_LABELS: Record<string, string> = {
  xl3Arrows: "3 Arrows",
  xl3ArrowsGray: "3 Arrows (Gray)",
  xl3Flags: "3 Flags",
  xl3TrafficLights1: "3 Traffic Lights",
  xl3TrafficLights2: "3 Traffic Lights (Rimmed)",
  xl4TrafficLights: "4 Traffic Lights",
  xl3Signs: "3 Signs",
  xl3Symbols: "3 Symbols",
  xl3Symbols2: "3 Symbols (Uncircled)",
  xl4Arrows: "4 Arrows",
  xl4ArrowsGray: "4 Arrows (Gray)",
  xl4RedToBlack: "4 Red to Black",
  xl4CRV: "4 Ratings",
  xl5Arrows: "5 Arrows",
  xl5ArrowsGray: "5 Arrows (Gray)",
  xl5CRV: "5 Ratings",
  xl5Quarters: "5 Quarters",
  xl5Boxes: "5 Boxes",
  xl3Stars: "3 Stars",
  xl3Triangles: "3 Triangles",
};

export const addIconSet = defineTool({
  name: "addIconSet",
  description:
    "Applies icon set conditional formatting to display icons (arrows, traffic lights, symbols) based on value ranges. Do NOT use for color gradients — use addColorScale. Do NOT use for bar-based visualization — use addDataBars.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range to apply icon set. Omit to use current selection.",
      },
      iconSetType: {
        type: "string",
        description: `Type of icon set. Default: 'xl3Arrows'. Options: ${ICON_SET_TYPES.join(", ")}`,
        enum: [...ICON_SET_TYPES],
        default: "xl3Arrows",
      },
      showIconOnly: {
        type: "boolean",
        description:
          "Whether to show only icons without values (default: false).",
        default: false,
      },
      reverseOrder: {
        type: "boolean",
        description: "Whether to reverse the icon order (default: false).",
        default: false,
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    const iconSetType = optionalEnum(params, "iconSetType", ICON_SET_TYPES);
    const showIconOnly = optionalBoolean(params, "showIconOnly");
    const reverseOrder = optionalBoolean(params, "reverseOrder");

    Asc.scope.range = range;
    Asc.scope.iconSetType = iconSetType;
    Asc.scope.showIconOnly = showIconOnly;
    Asc.scope.reverseOrder = reverseOrder;

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
          r = ws.GetSelection();
        }

        const fc = r.GetFormatConditions();
        const iconSet = fc.AddIconSetCondition();
        if (!iconSet) {
          return {
            error: "Failed to create icon set conditional formatting rule.",
          };
        }
        if (Asc.scope.iconSetType) iconSet.SetIconSet(Asc.scope.iconSetType);
        if (typeof Asc.scope.showIconOnly === "boolean") {
          iconSet.SetShowIconOnly(Asc.scope.showIconOnly);
        }
        if (typeof Asc.scope.reverseOrder === "boolean") {
          iconSet.SetReverseOrder(Asc.scope.reverseOrder);
        }
        return { addr: r.GetAddress(false, false) };
      }
    );

    if (result?.error) throw new ToolError(result.error);

    const key = iconSetType ?? "xl3Arrows";
    const label = ICON_SET_LABELS[key] ?? key;
    return `Added icon set "${label}" to ${result?.addr || range || "selection"}.`;
  },
});
