import { editor } from "../../library/editor";
import { endGroupActions, startGroupActions } from "../lib/aiActions";
import { CHART_TYPE_DESCRIPTION, VALID_CHART_TYPES } from "../lib/chartTypes";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalInteger, optionalString } from "../lib/validation";

interface ChartData {
  data: number[][];
  series: string[];
  categories: string[];
}

function normalizeChartData(partial: Partial<ChartData>): ChartData {
  let { data, series, categories } = partial;
  if (!data || data.length === 0) {
    data = [
      [100, 120, 140],
      [90, 110, 130],
    ];
    series = ["Series 1", "Series 2"];
    categories = ["Cat 1", "Cat 2", "Cat 3"];
  }
  if (!series) series = [];
  if (!categories) categories = [];

  const pointsLength = data[0]?.length ?? 0;
  for (let i = 1; i < data.length; i++) {
    while (data[i].length < pointsLength) data[i].push(0);
    data[i] = data[i].slice(0, pointsLength);
  }
  while (series.length < data.length) {
    series.push(`Series ${series.length + 1}`);
  }
  series = series.slice(0, data.length);
  while (categories.length < pointsLength) {
    categories.push(`Cat ${categories.length + 1}`);
  }
  categories = categories.slice(0, pointsLength);

  return { data, series, categories };
}

export const addChartToSlide = defineTool({
  name: "addChartToSlide",
  description: "Adds a chart to the slide (152x89mm, centered)",
  inputSchema: {
    type: "object",
    properties: {
      slideNumber: {
        type: "number",
        description:
          "slide number to add chart to (optional, defaults to current)",
        minimum: 1,
      },
      chartType: {
        type: "string",
        description: `type of chart - ${CHART_TYPE_DESCRIPTION}`,
      },
      data: {
        type: "array",
        description:
          "2D array of numeric data values - all sub-arrays must have same length, number of arrays must match series count",
        items: { type: "array", items: { type: "number" } },
      },
      series: {
        type: "array",
        description:
          "array of series names - must have same length as data arrays count",
        items: { type: "string" },
      },
      categories: {
        type: "array",
        description:
          "array of category names - must have same length as each data array",
        items: { type: "string" },
      },
      prompt: {
        type: "string",
        description:
          "description of what kind of data to generate for the chart",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const slideNumber = optionalInteger(params, "slideNumber", { min: 1 });
    const chartType = optionalString(params, "chartType") ?? "bar3D";
    const aiPrompt = optionalString(params, "prompt");

    let data = Array.isArray(params.data)
      ? (params.data as number[][])
      : undefined;
    let series = Array.isArray(params.series)
      ? (params.series as string[])
      : undefined;
    let categories = Array.isArray(params.categories)
      ? (params.categories as string[])
      : undefined;

    // AI-generated data if prompt given and no explicit data
    if (aiPrompt && !data) {
      if (!window.AI) {
        throw new ToolError("AI not available for chart data generation");
      }
      const requestEngine = window.AI.Request.create(window.AI.ActionType.Chat);

      await startGroupActions();

      try {
        const chartPrompt = `Generate chart data for the following request: ${aiPrompt}

Return ONLY a JSON object in this exact format (no other text):
{
  "data": [[number, number, ...], [number, number, ...]],
  "series": ["Series1", "Series2", ...],
  "categories": ["Category1", "Category2", ...]
}

IMPORTANT RULES:
1. The number of arrays in 'data' MUST equal the number of items in 'series'
2. ALL arrays in 'data' MUST have exactly the same length
3. The number of items in 'categories' MUST equal the length of each data array
Example: if data=[[10,20,30],[40,50,60]], then series must have 2 names and categories must have 3 names`;

        const generated = await requestEngine.chatRequest(chartPrompt);

        try {
          const parsed = JSON.parse(generated);
          data = parsed.data;
          series = parsed.series;
          categories = parsed.categories;
        } catch {
          data = [
            [100, 120, 140],
            [90, 110, 130],
          ];
          series = ["Series 1", "Series 2"];
          categories = ["Cat 1", "Cat 2", "Cat 3"];
        }
      } finally {
        await endGroupActions();
      }
    }

    const normalized = normalizeChartData({ data, series, categories });
    Asc.scope.slideNum = slideNumber;
    Asc.scope.chartType = chartType;
    Asc.scope.chartData = normalized.data;
    Asc.scope.chartSeries = normalized.series;
    Asc.scope.chartCategories = normalized.categories;
    Asc.scope.validChartTypes = [...VALID_CHART_TYPES];

    const callResult = await editor.callCommand<
      | {
          error?: string;
          slidesCount?: number;
          validTypes?: string[];
        }
      | undefined
    >(() => {
      const presentation = Api.GetPresentation();
      let slide = null;
      if (Asc.scope.slideNum) {
        slide = presentation.GetSlideByIndex(Asc.scope.slideNum - 1);
        if (!slide) {
          return {
            error: "slide_not_found",
            slidesCount: presentation.GetSlidesCount(),
          };
        }
      } else {
        slide = presentation.GetCurrentSlide();
      }
      if (!slide) return;

      if (Asc.scope.validChartTypes.indexOf(Asc.scope.chartType) === -1) {
        return {
          error: "invalid_chart_type",
          validTypes: Asc.scope.validChartTypes,
        };
      }

      const slideWidth = presentation.GetWidth();
      const slideHeight = presentation.GetHeight();
      const width = 5472000;
      const height = 3204000;
      const x = (slideWidth - width) / 2;
      const y = (slideHeight - height) / 2;

      const chart = Api.CreateChart(
        Asc.scope.chartType,
        Asc.scope.chartData,
        Asc.scope.chartSeries,
        Asc.scope.chartCategories,
        width,
        height,
        24
      );
      if (!chart) return;

      let contentPh = null;
      const allDrawings = slide.GetAllDrawings();
      for (let di = 0; di < allDrawings.length; di++) {
        const ph = allDrawings[di].GetPlaceholder();
        if (ph) {
          const t = ph.GetType();
          if (
            t === "chart" ||
            t === "unknown" ||
            t === "object" ||
            t === "body"
          ) {
            contentPh = allDrawings[di];
            break;
          }
        }
      }

      if (contentPh) {
        contentPh.ReplacePlaceholder(chart);
      } else {
        chart.SetPosition(x, y);
        slide.AddObject(chart);
      }
    });

    if (callResult?.error === "slide_not_found") {
      throw new ToolError(
        `Slide ${slideNumber} does not exist! The presentation has ${callResult.slidesCount} slides.`
      );
    }
    if (callResult?.error === "invalid_chart_type") {
      throw new ToolError(
        `The chart type "${chartType}" is not valid! Here is a list of available chart types: ${JSON.stringify(callResult.validTypes)}`
      );
    }

    return { isApply: true };
  },
});
