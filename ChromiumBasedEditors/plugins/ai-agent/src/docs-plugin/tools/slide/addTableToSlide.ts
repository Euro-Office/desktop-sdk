import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalInteger } from "../lib/validation";

export const addTableToSlide = defineTool({
  name: "addTableToSlide",
  description: "Adds a table to the slide (194x97mm, centered)",
  inputSchema: {
    type: "object",
    properties: {
      slideNumber: {
        type: "number",
        description: "the slide number to add table",
        minimum: 1,
      },
      rows: { type: "number", description: "number of rows" },
      columns: { type: "number", description: "number of columns" },
      data: {
        type: "array",
        description: "2D array of cell values - rows x columns",
        items: { type: "array", items: { type: "string" } },
      },
    },
    required: [],
  },
  handler: async (params) => {
    const slideNumber = optionalInteger(params, "slideNumber", { min: 1 });
    const rows = optionalInteger(params, "rows", { min: 1 });
    const columns = optionalInteger(params, "columns", { min: 1 });

    const rawData = params.data;
    const data =
      Array.isArray(rawData) &&
      rawData.every(
        (row) =>
          Array.isArray(row) &&
          row.every(
            (cell) =>
              typeof cell === "string" ||
              typeof cell === "number" ||
              cell === null ||
              cell === undefined
          )
      )
        ? (rawData as Array<Array<string | number | null | undefined>>)
        : undefined;

    Asc.scope.slideNum = slideNumber;
    Asc.scope.rows = rows ?? 3;
    Asc.scope.columns = columns ?? 3;
    Asc.scope.data = data;

    const callResult = await editor.callCommand<
      | {
          error?: string;
          slidesCount?: number;
          rows?: number;
          columns?: number;
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

      const slideWidth = presentation.GetWidth();
      const slideHeight = presentation.GetHeight();

      const dataLocal = Asc.scope.data;
      let rowsLocal = Asc.scope.rows;
      let colsLocal = Asc.scope.columns;

      if (dataLocal && Array.isArray(dataLocal) && dataLocal.length > 0) {
        rowsLocal = dataLocal.length;
        if (dataLocal[0] && Array.isArray(dataLocal[0])) {
          colsLocal = dataLocal[0].length;
        }
      }

      if (rowsLocal <= 0 || colsLocal <= 0) {
        return {
          error: "invalid_table_size",
          rows: rowsLocal,
          columns: colsLocal,
        };
      }

      const tableWidth = 7000000;
      const tableHeight = 3500000;
      const x = (slideWidth - tableWidth) / 2;
      const y = (slideHeight - tableHeight) / 2;

      const table = Api.CreateTable(colsLocal, rowsLocal);
      if (!table) return;

      table.SetSize(tableWidth, tableHeight);
      if (dataLocal && Array.isArray(dataLocal)) {
        const rowCount = Math.min(dataLocal.length, rowsLocal);
        for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
          const row = table.GetRow(rowIdx);
          if (Array.isArray(dataLocal[rowIdx])) {
            const cellCount = Math.min(dataLocal[rowIdx].length, colsLocal);
            for (let col = 0; col < cellCount; col++) {
              const cell = row.GetCell(col);
              if (cell) {
                const cellContent = cell.GetContent();
                if (cellContent) {
                  cellContent.RemoveAllElements();
                  const paragraph = Api.CreateParagraph();
                  const value = dataLocal[rowIdx][col];
                  if (value !== null && value !== undefined) {
                    paragraph.AddText(String(value));
                    cellContent.Push(paragraph);
                  }
                }
              }
            }
          }
        }
      }

      // Try to insert into a placeholder first
      let contentPh = null;
      const allDrawings = slide.GetAllDrawings();
      for (let di = 0; di < allDrawings.length; di++) {
        const ph = allDrawings[di].GetPlaceholder();
        if (ph) {
          const t = ph.GetType();
          if (
            t === "table" ||
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
        contentPh.ReplacePlaceholder(table);
      } else {
        table.SetPosition(x, y);
        slide.AddObject(table);
      }
    });

    if (callResult?.error === "slide_not_found") {
      throw new ToolError(
        `Slide ${slideNumber} does not exist! The presentation has ${callResult.slidesCount} slides.`
      );
    }
    if (callResult?.error === "invalid_table_size") {
      throw new ToolError(
        `Invalid table size: rows=${callResult.rows}, columns=${callResult.columns}. Both rows and columns must be greater than 0.`
      );
    }

    return { isApply: true };
  },
});
