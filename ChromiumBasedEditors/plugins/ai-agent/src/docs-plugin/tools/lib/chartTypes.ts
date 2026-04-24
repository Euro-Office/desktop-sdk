export const VALID_CHART_TYPES = [
  "bar",
  "barStacked",
  "barStackedPercent",
  "bar3D",
  "barStacked3D",
  "barStackedPercent3D",
  "barStackedPercent3DPerspective",
  "horizontalBar",
  "horizontalBarStacked",
  "horizontalBarStackedPercent",
  "horizontalBar3D",
  "horizontalBarStacked3D",
  "horizontalBarStackedPercent3D",
  "lineNormal",
  "lineStacked",
  "lineStackedPercent",
  "line3D",
  "pie",
  "pie3D",
  "doughnut",
  "scatter",
  "stock",
  "area",
  "areaStacked",
  "areaStackedPercent",
] as const;

export type ChartType = (typeof VALID_CHART_TYPES)[number];

export const CHART_TYPE_DESCRIPTION = VALID_CHART_TYPES.join(", ");
