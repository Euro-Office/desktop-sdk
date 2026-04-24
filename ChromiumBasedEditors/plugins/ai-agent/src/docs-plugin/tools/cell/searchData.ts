import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalInteger,
  optionalString,
  requireString,
} from "../lib/validation";

export const searchData = defineTool({
  name: "searchData",
  description:
    "Search for text or a value across the spreadsheet. Returns results grouped by sheet. Supports case-sensitive, whole-cell, and formula-text matching. Use offset for pagination.",
  inputSchema: {
    type: "object",
    properties: {
      searchTerm: {
        type: "string",
        description: "The text to search for in the spreadsheet.",
      },
      sheetName: {
        type: "string",
        description:
          "Limit search to a specific worksheet. If omitted, searches all sheets.",
      },
      range: {
        type: "string",
        description: "A1 notation range to limit the search scope.",
      },
      offset: {
        type: "number",
        description: "Number of results to skip for pagination (default: 0).",
      },
      options: {
        type: "object",
        description: "Optional search configuration.",
        properties: {
          matchCase: { type: "boolean", description: "Case-sensitive." },
          matchEntireCell: {
            type: "boolean",
            description: "Match entire cell content only.",
          },
          matchFormulas: {
            type: "boolean",
            description: "Search in formula text instead of displayed values.",
          },
          maxResults: {
            type: "number",
            description: "Max results per page (default: 500).",
          },
        },
      },
    },
    required: ["searchTerm"],
  },
  handler: async (params) => {
    const searchTerm = requireString(params, "searchTerm");
    const sheetName = optionalString(params, "sheetName");
    const range = optionalString(params, "range");
    const offset = optionalInteger(params, "offset", { min: 0 }) ?? 0;

    const rawOptions = params.options;
    const options =
      rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)
        ? (rawOptions as Record<string, unknown>)
        : {};
    const maxResults =
      typeof options.maxResults === "number" && options.maxResults >= 1
        ? Math.floor(options.maxResults)
        : 500;
    if (
      options.maxResults !== undefined &&
      (typeof options.maxResults !== "number" || options.maxResults < 1)
    ) {
      throw new ToolError(
        `Parameter "options.maxResults" must be a positive number. Got: ${JSON.stringify(options.maxResults)}`
      );
    }

    Asc.scope.searchTerm = searchTerm;
    Asc.scope.sheetName = sheetName ?? null;
    Asc.scope.range = range ?? null;
    Asc.scope.matchCase = options.matchCase === true;
    Asc.scope.matchEntireCell = options.matchEntireCell === true;
    Asc.scope.matchFormulas = options.matchFormulas === true;
    Asc.scope.maxResults = maxResults;
    Asc.scope.offset = offset;

    const result = await editor.callCommand<
      Record<string, unknown> | { error: string }
    >(() => {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
      let sheets: any[] = [];
      if (Asc.scope.sheetName) {
        const ws = Api.GetSheet(Asc.scope.sheetName);
        if (!ws) return { error: `Sheet "${Asc.scope.sheetName}" not found.` };
        sheets = [ws];
      } else {
        sheets = Api.GetSheets();
      }

      interface MatchGroup {
        sheet: string;
        cells: { addr: string; value: unknown; formula?: string }[];
      }
      const matches: MatchGroup[] = [];
      let seen = 0;
      let taken = 0;
      let hasMore = false;

      function addMatch(
        sheet: string,
        a1: string,
        value: unknown,
        formula: string | null
      ) {
        seen++;
        if (seen <= Asc.scope.offset) return;
        if (taken >= Asc.scope.maxResults) {
          hasMore = true;
          return;
        }
        let last = matches[matches.length - 1];
        if (!last || last.sheet !== sheet) {
          matches.push({ sheet, cells: [] });
          last = matches[matches.length - 1];
        }
        const entry: { addr: string; value: unknown; formula?: string } = {
          addr: a1,
          value,
        };
        if (formula !== null) entry.formula = formula;
        last.cells.push(entry);
        taken++;
      }

      for (let si = 0; si < sheets.length && !hasMore; si++) {
        const ws = sheets[si];
        if (!ws) continue;
        const wsName = ws.GetName();
        const searchRange = Asc.scope.range
          ? ws.GetRange(Asc.scope.range)
          : ws.GetUsedRange();
        if (!searchRange) continue;

        const firstFound = searchRange.Find({
          What: Asc.scope.searchTerm,
          LookIn: Asc.scope.matchFormulas ? "xlFormulas" : "xlValues",
          LookAt: Asc.scope.matchEntireCell ? "xlWhole" : "xlPart",
          SearchOrder: "xlByRows",
          SearchDirection: "xlNext",
          MatchCase: Asc.scope.matchCase,
        });
        if (!firstFound) continue;

        const firstAddr = firstFound.GetAddress(false, false);
        const firstFormula = firstFound.GetFormula();
        addMatch(
          wsName,
          firstAddr,
          firstFound.GetValue(),
          typeof firstFormula === "string" && firstFormula.startsWith("=")
            ? firstFormula
            : null
        );

        let current = firstFound;
        while (!hasMore) {
          const next = searchRange.FindNext(current);
          if (!next) break;
          const addr = next.GetAddress(false, false);
          if (addr === firstAddr) break;
          const nextFormula = next.GetFormula();
          addMatch(
            wsName,
            addr,
            next.GetValue(),
            typeof nextFormula === "string" && nextFormula.startsWith("=")
              ? nextFormula
              : null
          );
          current = next;
        }
      }

      const out: Record<string, unknown> = {
        matches,
        returned: taken,
        offset: Asc.scope.offset,
        hasMore,
        searchTerm: Asc.scope.searchTerm,
        searchScope: Asc.scope.sheetName || "All sheets",
        nextOffset: hasMore ? Asc.scope.offset + taken : null,
      };
      if (!hasMore) out.totalFound = seen;
      return out;
    });

    if (result && "error" in result && (result as { error?: string }).error) {
      throw new ToolError((result as { error: string }).error);
    }
    return result;
  },
});
