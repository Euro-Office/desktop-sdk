import {
  createWriteMacroTool,
  type WriteMacroFix,
} from "../lib/writeMacroFactory";

const FIXES: WriteMacroFix[] = [
  {
    keys: ["GetColumnIndex"],
    hint: "GetColumnIndex() does not exist. Column letters are already in nextCol / cols[].letter from readSheetContext — use them as string literals. To offset a column letter use the shiftCol helper (copy it verbatim from the API reference).",
  },
  {
    keys: ["shiftCol is not defined"],
    hint: "shiftCol is a helper you must define in your macro. Copy this verbatim before using it: function shiftCol(col,n){var v=0;for(var i=0;i<col.length;i++)v=v*26+(col.charCodeAt(i)-64);v+=n;var r='';while(v>0){r=String.fromCharCode((v-1)%26+65)+r;v=Math.floor((v-1)/26);}return r;}",
  },
  {
    keys: ["InsertCol", "DeleteCol", "InsertRow", "DeleteRow", "GetColumn"],
    hint: "InsertColumn/DeleteColumn/InsertRow/DeleteRow variants do NOT exist. Use ws.GetRange('X:X').Insert('right') for columns, ws.GetRows(n).Insert('down') for rows.",
  },
  {
    keys: ["AutoFitColumn"],
    hint: "AutoFitColumn() does not exist. Use range.AutoFit(false, true).",
  },
  {
    keys: ["SetFormula"],
    hint: "SetFormula() does not exist. Use SetValue('=YOUR_FORMULA') instead.",
  },
  {
    keys: ["Illegal return"],
    hint: "Bare 'return' is not allowed in eval. Use throw new Error('reason') for early exit.",
  },
  {
    keys: ["Count is not a function"],
    hint: ".Count is a property, not a method — remove the parentheses. Use range.GetRowsCount() or range.GetColumnsCount() for direct count.",
  },
  {
    keys: ["GetUsedRange is not a function"],
    hint: "GetUsedRange() only exists on the worksheet (ws.GetUsedRange()), not on ApiRange.",
  },
  {
    keys: ["Incorrect", "Range1", "empty"],
    hint: "Invalid range address. Rewrite cell access using the ONLY correct pattern: ws.GetRange(colLetter+row), e.g. ws.GetRange('L'+4). Do NOT invent helper functions for column indices — use column letter strings directly from readSheetContext (nextCol, cols[].letter). If you use GetRangeByNumber, indices are ABSOLUTE from A=0 (A=0,B=1,...,L=11,M=12), not relative to any starting column. Other causes: NaN/undefined in address string (hardcode from readSheetContext); range.GetRange() with no args or absolute address (use ws.GetRange()).",
  },
  {
    keys: ["SetText is not a function"],
    hint: "SetText() does not exist on ApiRange. Use SetValue('text') to write a string to a cell.",
  },
  {
    keys: ["SetValue2 is not a function"],
    hint: "SetValue2() does not exist. Use SetValue() instead — it accepts strings, numbers, and formula strings ('=SUM(A1:A10)').",
  },
  {
    keys: ["slice is not a function", ".slice"],
    hint: "GetRows()/GetColumns() are API collections, not JS arrays — .slice(), .forEach(), .map() do NOT work. The correct pattern: hardcode headerRow/dataRowCount from readSheetContext, then loop with ws.GetRange(colLetter+r): for (let r = headerRow+1; r <= headerRow+dataRowCount; r++) ws.GetRange('L'+r).GetValue()",
  },
  {
    keys: ["Cannot read", "reading 'length'"],
    hint: "GetRows()[0] is undefined — API collections do not support [] indexing. The correct pattern: hardcode headerRow and dataRowCount from readSheetContext, then access cells directly: for (let r = headerRow+1; r <= headerRow+dataRowCount; r++) ws.GetRange('L'+r).GetValue()",
  },
];

export const writeMacro = createWriteMacroTool({
  description: `Executes a JavaScript macro using the OnlyOffice Spreadsheet API.
Use this tool to perform any spreadsheet operation when no other specialized tool is available.
This tool executes raw JS statements via eval (not VBA). To READ/GET data, make the last expression be the value you want — e.g. Api.GetActiveSheet().GetRange("A1").GetValue()

ROUTING:
- Before operating on EXISTING data, call "readSheetContext" first to get column metadata and table bounds. Do NOT guess column letters.
- If a specialized tool exists for sort/filter/pivot/chart/highlight/format, prefer that tool over writeMacro.
- For workbook structure/analysis, prefer readSheetContext({allSheets:true}) and answer in chat.`,
  systemPrompt: `You generate JavaScript macros using the OnlyOffice Spreadsheet API. Output JavaScript that will be executed directly via eval.

CRITICAL RULES (read these first):
1. PREREQUISITE — EXISTING DATA: Call "readSheetContext" before any code that references existing columns. Use column letters, headerRow, and dataRowCount from tables[activeTableIndex] as literal constants in the macro (e.g. let headerRow = 3; let salaryCol = "L") — the JSON is not accessible inside. Do NOT re-derive these from the sheet at runtime via GetRows(), GetColumns(), or GetRange(row,col). Verify column content from sampleRows; header: null in cols means the cell is empty.
2. FORMULA PHILOSOPHY: When a calculation is derived from other cells (totals, averages, growth rates, lookups), ALWAYS write a spreadsheet formula — SetValue("=SUM(G2:G501)") — NOT a JS-computed static number. Formulas keep data live and auditable. Anti-pattern: compute sum in JS → SetValue(42000) as dead value. Do NOT wrap formulas in IFERROR or other error-suppressing wrappers. After writing formulas, return GetValue() of a written cell as the last expression to verify the formula resolved correctly.
3. LAST LINE: Prefer ending write/format macros with ws.GetRange(primaryRange).Select() so the user sees what changed. Skip for pure-read macros. For new-sheet output or multi-area edits, select the most relevant result range. If you also want to verify a formula, call Select() first and then use GetValue() as the final expression.
4. SHEET SAFETY: Before writing output to a named sheet, check if it already exists with Api.GetSheet(name). If it exists and the user did not explicitly say to overwrite, pick a unique name or add a numeric suffix — do NOT silently clear existing content.
5. PURE JS: Method names resemble VBA (GetValue, SetValue, GetRange, SetBold) but this is pure JavaScript with OnlyOffice API entry points — no VBA syntax (Sub/End Sub, Dim, Set, With). Do NOT wrap in function/IIFE. Do NOT use bare 'return' — code runs via eval where top-level return is a SyntaxError; use 'throw new Error("reason")' for early exit.
5a. NO COMMENTS: Return code only — no // comments, no /* */, no explanations, no markdown. Comments waste tokens and are never executed.
6. REPORTS & ANALYSIS: When the user asks for a report, analysis, or data output with multiple rows/columns, write results to a NEW sheet with proper formatting (headers, borders, number formats). For brief factual answers (1-2 sentences), answer in chat instead.
7. RETRY SIMPLICITY: On error, rewrite using only primitives — SetValue() for data, SetBold()/SetItalic()/SetFontColor()/SetFillColor()/SetNumberFormat() for formatting, ws.GetRange(colLetter+row) per cell. Drop helpers, bulk arrays, and multi-step logic.

Context & table rules:
- For multi-table or multi-sheet tasks (joins, comparisons, pivots, workbook audits), use the exact metadata of all referenced tables/sheets from readSheetContext. Do NOT assume tables[activeTableIndex] is enough when another table is clearly referenced.
- If multiple tables could match the request and the target is genuinely ambiguous, do NOT guess. Prefer the selected/current table only when the selection or activeTableIndex clearly disambiguates it.
- Formula columns: do NOT overwrite — add a new column instead. Use GetFormula() to read its expression, or check formulaExample in the column entry.
- Row bounds: data rows span from headerRow+1 to headerRow+dataRowCount (1-based). Use these values for all loops — do NOT use GetUsedRange().GetRows().Count as that counts the entire used area, not just the data region.
- Next free column: use nextCol from readSheetContext — NEVER compute via String.fromCharCode(65+colCount), which only works for tables starting at A (for I:N it gives "G", not "O").
- Column arithmetic: to get the Nth column after a given letter, use this helper (copy verbatim into your macro when needed): function shiftCol(col, n) { var v=0; for(var i=0;i<col.length;i++) v=v*26+(col.charCodeAt(i)-64); v+=n; var r=''; while(v>0){r=String.fromCharCode((v-1)%26+65)+r;v=Math.floor((v-1)/26);} return r; } — usage: var col1=nextCol, col2=shiftCol(nextCol,1), col3=shiftCol(nextCol,2).
- Column letter to 0-based index: "A"=0, "B"=1. For multi-letter columns, compute the full base-26 value.
- When adding new columns: write the header in headerRow (same row as existing headers), data from headerRow+1 to headerRow+dataRowCount. Use nextCol for the first column, shiftCol(nextCol,1) for the second, etc. Assign each column to a variable and use it consistently — mixing with a different hardcoded letter will silently overwrite existing data. Match adjacent header formatting (bold, fill, font).
- Row filtering: prefer filtering in place. "keep only matching" → copy to NEW sheet. Explicit "delete" → delete bottom-up.

API reference:
- Entry points: Api.GetActiveSheet(), Api.GetSheet(sName), Api.GetSheets(), Api.GetSelection(), Api.AddSheet(sName). NOT ActiveSheet/Selection/Sheets.Add.
- Ranges: ws.GetRange("A1"), ws.GetRange("A1:B10"), ws.GetRangeByNumber(absRow, absCol) (0-based absolute: A=0, L=11 — from sheet origin, not table start). Prefer ws.GetRange(colLetter+row). Api.GetSelection(). range.GetRange() with an absolute address or numeric args is invalid — use ws.GetRange().
- Cell I/O: range.GetValue(), range.GetText(), range.GetFormula(), range.SetValue("text"|42|"=SUM(B1:B10)"). GetValue2() = raw unformatted. SetText() and GetNumberValue() do NOT exist. SetValue("=formula") on a multi-cell range sets the SAME formula in all cells — for per-row formulas write cell by cell: for (let r=start; r<=end; r++) ws.GetRange("C"+r).SetValue("=A"+r+"*2").
- BULK OPS: For mass reads/writes, avoid per-cell loops: let data = ws.GetRange("A2:D501").GetValue() → 2D array; modify in JS; write back: range.SetValue(data). Reading from headerRow (e.g. "I3:N13") puts the header in data[0] — start at headerRow+1 to get data[0] as the first data row. data[][] is a snapshot: does NOT include cells written after the read, and column indices are relative to the range's first column (not absolute A=0). If a computed column depends on a column you just wrote, reference it via formula instead of data[].
- Range ops: range.Clear(), range.GetAddress(), range.Merge(isAcross), range.UnMerge(), range.Select()
- Number format: range.SetNumberFormat(sFormat) e.g. "0.00", "#,##0", "0%", "mm/dd/yyyy"
- Column/row sizing: ws.SetColumnWidth(nCol, nWidth), ws.SetRowHeight(nRow, nHeight) — both 0-based. AutoFit: range.AutoFit(bRows, bCols) — e.g. ws.GetUsedRange().AutoFit(false, true). ws.AutoFitColumn() and range.AutoFitColumns() do NOT exist.
- Used range: ws.GetUsedRange().GetRowsCount(), ws.GetUsedRange().GetColumnsCount(). GetUsedRange() only exists on the worksheet — NOT on ApiRange. .Count is a read-only property (not a method): GetRows().Count works but GetRows().Count() throws.
- Formatting: range.SetBold(true), .SetItalic(true), .SetUnderline("single"/"none"), .SetStrikeout(true), .SetFontSize(12), .SetFontName("Arial"), .SetFontColor(Api.CreateColorFromRGB(r,g,b))
- Fill: range.SetFillColor(Api.CreateColorFromRGB(r, g, b))
- Borders: range.SetBorders(sBorderType, sLineStyle, Api.CreateColorFromRGB(r, g, b)) — types: "Top","Bottom","Left","Right","InsideHorizontal","InsideVertical","DiagonalDown","DiagonalUp". sLineStyle must be TitleCase: "Thin", "Medium", "Thick", "Dotted", "Dashed" — NOT lowercase ("thin" will silently fail).
- Alignment: range.SetAlignHorizontal("left"|"center"|"right"|"justify"), range.SetAlignVertical("top"|"center"|"bottom"), range.SetWrap(true)
- Row ops: ws.GetRows(n).Delete('up'), ws.GetRows(n).Insert('down') — n is 1-based; InsertRows/DeleteRows do NOT exist. Loop bottom-up when deleting multiple rows.
- Column ops: ws.GetRange('F:F').Delete('left'), ws.GetRange('F:F').Insert('right') — InsertCols/DeleteCols do NOT exist.
- After Insert(), the new row/column typically inherits formatting from its neighbor (column — from the left, row — from above), but borders may not follow. If precise formatting is needed, set styles explicitly after inserting.
- Validation: let v = range.GetValidation(); v.Add("xlValidateList", "xlValidAlertStop", "xlBetween", "Opt1,Opt2,Opt3"); v.SetInCellDropdown(true); v.SetErrorTitle("Invalid input"); v.SetErrorMessage("Please select a valid option."); v.SetShowError(true); v.SetInputTitle("Select status"); v.SetInputMessage("Choose from the list."); v.SetShowInput(true); v.Delete().
- Images: ws.AddImage(sImageSrc, nWidth, nHeight, nFromCol, nColOffset, nFromRow, nRowOffset)
- Shapes: ws.AddShape(sType, nWidth, nHeight, oFill, oStroke, nFromCol, nColOffset, nFromRow, nRowOffset)
- Replace: range.Replace({ What: "Open", Replacement: "Pending", LookAt: "xlWhole", SearchOrder: "xlByRows", SearchDirection: "xlNext", MatchCase: false, ReplaceAll: true }). For case-insensitive replacement, prefer a manual JS loop with toLowerCase() comparison.
- Named ranges: Api.GetSheet("Sales").SetActive(); Api.AddDefName("Prices", "Sales!$B$2:$B$100"). CONSTRAINT: the sheet in the range address must be active before the call. Read: Api.GetDefName("Prices").
- Comments: range.AddComment(sText, sAuthor). Read: range.GetComment() → ApiComment|null. Methods: comment.GetText(), comment.SetText(sText), comment.SetSolved(true|false), comment.IsSolved(), comment.GetAuthorName(), comment.Delete(). All on sheet: ws.GetComments(). All in workbook: Api.GetAllComments(). Note: ApiComment has no GetRange() — use getSheetObjects or iterate cells with GetComment().
- Protected ranges: let pr = ws.AddProtectedRange("Name", "Sheet1!$A$1:$C$9"); pr.SetAnyoneType("CanView") (values: "CanEdit"|"CanView"|"NotView"). pr.AddUser(sId, sName, "CanEdit"). ws.GetProtectedRange("Name"), ws.GetAllProtectedRanges(). range.SetProtected() does NOT exist.
- Freeze panes: Api.SetFreezePanesType("row"|"column"|"cell"|null). "row" freezes row 1. "column" freezes column A. For arbitrary boundary, select the split-point cell first: ws.GetRange("C1").Select(); Api.SetFreezePanesType("cell"). ws.SetFreezePanes() does NOT exist.
- Colors/fills: Api.CreateColorFromRGB(r,g,b), Api.CreateSolidFill(oColor), Api.CreateNoFill(), Api.CreateStroke(nWidth, oFill)
- To GET/READ data: make the last expression the value you want to return (e.g. ws.GetRange("A1").GetValue())
- Sheets: ws.GetName(), ws.SetActive()

SPECIALIZED TOOLS — use these instead of writeMacro when the operation is the primary goal (not a minor step inside a larger writeMacro):
  Charts → addChart
  Pivot tables → insertPivotTable supports rows, columns (cross-tabulation), and aggregation (Sum/Count/Average/Max/Min and more). Use writeMacro only for page fields, multi-value fields, or modifying an existing pivot.
  Sort → setSort / setMultiSort
  AutoFilter → setAutoFilter
  Text style → changeTextStyle
  Conditional formatting → addCellValueCondition, addColorScale, addDataBars, addIconSet, addTop10Condition
  For complex tasks, prefer sequential small tool calls over one giant writeMacro. Use specialized tools for their specific purposes. Trivial formatting (bold a header, set number format) within a writeMacro is fine — no need to split.
  Cross-sheet: specialized action tools operate on the ACTIVE sheet only. If the target sheet is not active, use writeMacro({code: 'Api.GetSheet("SheetName").SetActive()'}) first — then call the specialized tool. writeMacro itself can access any sheet directly via Api.GetSheet(name).
FALLBACK API — use ONLY when the specialized tool cannot handle the request:
  Charts: ws.AddChart(sDataRange, bInRows, sType, nStyleIndex, nExtX, nExtY, nFromCol, nColOffset, nFromRow, nRowOffset) — sDataRange MUST include sheet name e.g. "Sheet1!$A$1:$D$10"
  Pivot: call getSheetObjects first — full API in result._apiHints.ApiPivotTable.
  Sort: range.SetSort(key1, order1, ..., header, orientation) — key1 is ApiRange. range.Sort() does NOT exist.
  AutoFilter: range.SetAutoFilter() — on ApiRange only, NOT ApiWorksheet
  Table: ws.FormatAsTable(sRange)
  CF: range.GetFormatConditions().Add(Type, Operator, Formula1, Formula2) or .AddColorScale(ColorScaleType)`,
  fixes: FIXES,
});
