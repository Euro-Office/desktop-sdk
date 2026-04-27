/**
 * Human-readable display names for editor tools, mirroring the
 * `HELPERS.names.{word,slide,cell}` dictionaries from the legacy plugin.
 *
 * These labels are NOT yet wired into the chat UI: the current
 * `@onlyoffice/ai-chat` library renders the raw `HostTool.name` directly
 * inside `ToolFallback` / `ManageToolDialog` and exposes no hook to
 * substitute a display name. Once the library adds either:
 *
 *   - a `displayName?: string` field on `HostTool`, or
 *   - a `getToolDisplayName?: (name) => string | undefined` prop on
 *     `AIChatWidget` / `ToolsProvider`,
 *
 * this map can be wired up by re-exporting `getToolDisplayName` and either
 * passing it via the new prop or having `defineTool` look it up.
 *
 * Keys are namespaced as `<groupId>_<toolName>` so the same tool name can
 * exist in multiple editor groups (e.g. `word_addImage` vs `cell_addImage`)
 * without collision.
 */

const DISPLAY_NAMES: Record<string, string> = {
  // ─── Word ────────────────────────────────────────────────────────────
  word_addImage: "Insert Image from Description",
  word_checkSpelling: "Check and Fix Spelling",
  word_commentText: "Add Comment to Text",
  word_generateDocx: "Generate Document",
  word_generateForm: "Generate Form Template",
  word_insertPage: "Insert Blank Page",
  word_changeParagraphStyle: "Change Paragraph Style",
  word_rewriteText: "Rewrite Text",
  word_changeTextStyle: "Format Text",
  word_writeMacro: "Run Macro",

  // ─── Slide ───────────────────────────────────────────────────────────
  slide_addChartToSlide: "Insert Chart",
  slide_addNewSlide: "Add New Slide",
  slide_addShapeToSlide: "Insert Shape",
  slide_addTableToSlide: "Insert Table",
  slide_addTextToPlaceholder: "Insert Text",
  slide_addImageByDescription: "Insert Image from Description",
  slide_changeSlideBackground: "Change Slide Background",
  slide_deleteSlide: "Delete Slide",
  slide_duplicateSlide: "Duplicate Slide",
  slide_generatePresentationWithTheme: "Generate Presentation",
  slide_writeMacro: "Run Macro",

  // ─── Cell ────────────────────────────────────────────────────────────
  cell_addCellValueCondition: "Highlight Cells by Condition",
  cell_addChart: "Create Chart",
  cell_addColorScale: "Apply Color Scale",
  cell_addDataBars: "Add Data Bars",
  cell_addIconSet: "Add Icon Indicators",
  cell_addImage: "Insert Image",
  cell_addTop10Condition: "Highlight Top or Bottom Values",
  cell_explainFormula: "Explain Formula",
  cell_fillMissingData: "Fill Missing Data",
  cell_fixFormula: "Fix Formula Errors",
  cell_getCellDetails: "Get Cell Details",
  cell_getRangeData: "Get Range Data",
  cell_getSheetObjects: "Get Sheet Objects",
  cell_insertPivotTable: "Create Pivot Table",
  cell_readSheetContext: "Read Spreadsheet Context",
  cell_searchData: "Search Data",
  cell_setAutoFilter: "Apply Data Filter",
  cell_setMultiSort: "Sort by Multiple Columns",
  cell_setSort: "Sort Data",
  cell_writeMacro: "Run Macro",
};

/**
 * Returns the human-readable label for a tool, or `undefined` if no
 * mapping is registered.
 *
 * @param qualifiedName Either the prefixed name (`word_writeMacro`) as
 *   exposed to the LLM, or just the bare tool name (`writeMacro`) — the
 *   group can be passed separately via the second argument.
 * @param group Optional group id (`word` | `slide` | `cell`). When
 *   provided together with a bare tool name, resolves the namespaced key.
 */
export function getToolDisplayName(
  qualifiedName: string,
  group?: "word" | "slide" | "cell"
): string | undefined {
  if (group) {
    const direct = DISPLAY_NAMES[`${group}_${qualifiedName}`];
    if (direct) return direct;
  }
  return DISPLAY_NAMES[qualifiedName];
}

/** All registered display names — for diagnostics / dev tooling. */
export function getAllToolDisplayNames(): Readonly<Record<string, string>> {
  return DISPLAY_NAMES;
}
