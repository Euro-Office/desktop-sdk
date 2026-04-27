import { editor } from "../../library/editor";
import { CHART_TYPE_DESCRIPTION, VALID_CHART_TYPES } from "../lib/chartTypes";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalString } from "../lib/validation";

export const addChart = defineTool({
  name: "addChart",
  description:
    "Creates charts from data ranges. Supports bar, line, pie, scatter, area variants (stacked, 3D, percentage). Charts are positioned below the source data. Optional title.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range with data for chart (e.g., 'A1:D10'). REQUIRED unless user explicitly says 'current selection'. Otherwise resolve via readSheetContext.",
      },
      chartType: {
        type: "string",
        description: `Type of chart. Available: ${CHART_TYPE_DESCRIPTION}`,
        enum: [...VALID_CHART_TYPES],
        default: "bar",
      },
      title: { type: "string", description: "Chart title text." },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    const chartType = optionalString(params, "chartType") ?? "bar";
    const title = optionalString(params, "title");

    Asc.scope.range = range;
    Asc.scope.chartType = chartType;
    Asc.scope.title = title;
    Asc.scope.validChartTypes = [...VALID_CHART_TYPES];

    const callResult = await editor.callCommand<
      { error?: string; addr?: string; validTypes?: string[] } | undefined
    >(() => {
      if (Asc.scope.validChartTypes.indexOf(Asc.scope.chartType) === -1) {
        return {
          error: "invalid_chart_type",
          validTypes: Asc.scope.validChartTypes,
        };
      }

      const ws = Api.GetActiveSheet();
      let chartRange: string;
      if (Asc.scope.range) {
        chartRange = Asc.scope.range;
      } else {
        const selection = Api.GetSelection();
        chartRange = selection.GetAddress(true, true, "xlA1", false);
      }

      const r = ws.GetRange(chartRange);
      const fromRow = r.GetRow() + 3;
      const fromCol = r.GetCol();

      const widthEMU = 130 * 36000;
      const heightEMU = 80 * 36000;

      const chart = ws.AddChart(
        chartRange,
        true,
        Asc.scope.chartType,
        2,
        widthEMU,
        heightEMU,
        fromCol,
        0,
        fromRow,
        0
      );
      if (chart && Asc.scope.title) {
        chart.SetTitle(Asc.scope.title, 14);
      }

      return { addr: chartRange };
    });

    if (callResult?.error === "invalid_chart_type") {
      throw new ToolError(
        `The chart type "${chartType}" is not valid! Here is a list of available chart types: ${JSON.stringify(callResult.validTypes)}`
      );
    }

    let msg = `Created ${chartType} chart from ${callResult?.addr || range || "selection"}`;
    if (title) msg += ` titled "${title}"`;
    return `${msg}.`;
  },
});
