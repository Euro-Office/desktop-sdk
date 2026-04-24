import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { findColumnByName } from "../lib/findColumnByName";
import { optionalEnum, optionalString } from "../lib/validation";

const SORT_ORDERS = ["xlAscending", "xlDescending"] as const;
const HEADERS = ["xlYes", "xlNo"] as const;

function isCellRef(v: unknown): boolean {
  return typeof v === "string" && /^[A-Z]+\d+$/i.test(v);
}

export const setSort = defineTool({
  name: "setSort",
  description:
    "Sorts data in a range by a single column in ascending or descending order.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description:
          "Cell range to sort (e.g., 'A1:D10'). Omit to use current selection.",
      },
      key1: {
        type: ["string", "number"],
        description:
          "Sort field - cell reference, column index (1-based), or column name.",
      },
      sortOrder1: {
        type: "string",
        description: "Sort order: 'xlAscending' or 'xlDescending'.",
        enum: [...SORT_ORDERS],
        default: "xlAscending",
      },
      header: {
        type: "string",
        description: "Whether first row contains headers: 'xlYes' or 'xlNo'.",
        enum: [...HEADERS],
        default: "xlYes",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    let key1: string | number | undefined;
    if (typeof params.key1 === "string" || typeof params.key1 === "number") {
      key1 = params.key1 as string | number;
    }
    const sortOrder1 =
      optionalEnum(params, "sortOrder1", SORT_ORDERS) ?? "xlAscending";
    const header = optionalEnum(params, "header", HEADERS) ?? "xlYes";

    // Resolve column name to index via AI when key1 is a non-cell-ref string
    if (
      typeof key1 === "string" &&
      Number.isNaN(Number(key1)) &&
      !isCellRef(key1)
    ) {
      key1 = await findColumnByName(key1, range);
    }

    Asc.scope.range = range;
    Asc.scope.key1 = key1;
    Asc.scope.sortOrder1 = sortOrder1;
    Asc.scope.header = header;

    const sortResult = await editor.callCommand<{ addr?: string }>(() => {
      const ws = Api.GetActiveSheet();
      const r = Asc.scope.range
        ? ws.GetRange(Asc.scope.range)
        : Api.GetSelection();
      if (!r) return {};

      // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
      function adjustSortKey(keyValue: any) {
        if (!keyValue) {
          return ws.GetCells(r.GetRow(), r.GetCol());
        }
        if (typeof keyValue === "number") {
          return ws.GetCells(r.GetRow(), r.GetCol() + keyValue - 1);
        }
        if (typeof keyValue === "string") {
          try {
            const keyRange = ws.GetRange(keyValue);
            return keyRange || keyValue;
          } catch {
            return keyValue;
          }
        }
        return keyValue;
      }

      const k1 = adjustSortKey(Asc.scope.key1);
      r.SetSort(
        k1,
        Asc.scope.sortOrder1,
        null,
        null,
        null,
        null,
        Asc.scope.header
      );
      return { addr: r.GetAddress(false, false) };
    });

    const addr = sortResult?.addr || range || "selection";
    const order = sortOrder1 === "xlDescending" ? "desc" : "asc";
    const keyLabel = key1 != null ? `"${key1}"` : "col 1";
    return `Sorted ${addr} by ${keyLabel} ${order}.`;
  },
});
