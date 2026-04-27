import type { HostTool } from "@onlyoffice/ai-chat";
import { addCellValueCondition } from "./addCellValueCondition";
import { addChart } from "./addChart";
import { addColorScale } from "./addColorScale";
import { addDataBars } from "./addDataBars";
import { addIconSet } from "./addIconSet";
import { addImage } from "./addImage";
import { addTop10Condition } from "./addTop10Condition";
import { explainFormula } from "./explainFormula";
import { fillMissingData } from "./fillMissingData";
import { fixFormula } from "./fixFormula";
import { getCellDetails } from "./getCellDetails";
import { getRangeData } from "./getRangeData";
import { getSheetObjects } from "./getSheetObjects";
import { insertPivotTable } from "./insertPivotTable";
import { readSheetContext } from "./readSheetContext";
import { searchData } from "./searchData";
import { setAutoFilter } from "./setAutoFilter";
import { setMultiSort } from "./setMultiSort";
import { setSort } from "./setSort";

export const cellTools: HostTool[] = [
  // Conditional formatting
  addCellValueCondition,
  addColorScale,
  addDataBars,
  addIconSet,
  addTop10Condition,
  // Read tools
  getCellDetails,
  getRangeData,
  getSheetObjects,
  readSheetContext,
  searchData,
  // Formula tools (AI-powered)
  explainFormula,
  fixFormula,
  fillMissingData,
  // Sort / filter
  setAutoFilter,
  setSort,
  setMultiSort,
  // Phase 6 — complex tools
  addChart,
  addImage,
  insertPivotTable,
];
