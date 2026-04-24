import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { findColumnByName } from "../lib/findColumnByName";
import { optionalEnum, optionalString } from "../lib/validation";

const SORT_ORDERS = ["xlAscending", "xlDescending"] as const;
const HEADERS = ["xlYes", "xlNo"] as const;

function isCellRef(v: unknown): boolean {
  return typeof v === "string" && /^[A-Z]+\d+$/i.test(v);
}

async function resolveKey(
  value: unknown,
  range: string | undefined
): Promise<string | number | undefined> {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  if (!Number.isNaN(Number(value))) return value;
  if (isCellRef(value)) return value;
  return await findColumnByName(value, range);
}

export const setMultiSort = defineTool({
  name: "setMultiSort",
  description:
    "Sorts data by multiple columns (up to 3 levels). Each level can have its own sort order.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description: "Cell range to sort (e.g., 'A1:D10').",
      },
      key1: {
        type: ["string", "number"],
        description:
          "First sort field - cell reference, column index, or column name.",
      },
      sortOrder1: {
        type: "string",
        enum: [...SORT_ORDERS],
        default: "xlAscending",
      },
      key2: {
        type: ["string", "number"],
        description: "Second sort field.",
      },
      sortOrder2: {
        type: "string",
        enum: [...SORT_ORDERS],
        default: "xlAscending",
      },
      key3: {
        type: ["string", "number"],
        description: "Third sort field.",
      },
      sortOrder3: {
        type: "string",
        enum: [...SORT_ORDERS],
        default: "xlAscending",
      },
      header: {
        type: "string",
        description: "Whether first row has headers.",
        enum: [...HEADERS],
        default: "xlYes",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const range = optionalString(params, "range");
    const sortOrder1 =
      optionalEnum(params, "sortOrder1", SORT_ORDERS) ?? "xlAscending";
    const sortOrder2 =
      optionalEnum(params, "sortOrder2", SORT_ORDERS) ?? "xlAscending";
    const sortOrder3 =
      optionalEnum(params, "sortOrder3", SORT_ORDERS) ?? "xlAscending";
    const header = optionalEnum(params, "header", HEADERS) ?? "xlYes";

    const key1 = await resolveKey(params.key1, range);
    const key2 = await resolveKey(params.key2, range);
    const key3 = await resolveKey(params.key3, range);

    Asc.scope.range = range;
    Asc.scope.key1 = key1;
    Asc.scope.key2 = key2;
    Asc.scope.key3 = key3;
    Asc.scope.sortOrder1 = sortOrder1;
    Asc.scope.sortOrder2 = sortOrder2;
    Asc.scope.sortOrder3 = sortOrder3;
    Asc.scope.header = header;

    const sortResult = await editor.callCommand<{ addr?: string }>(() => {
      const ws = Api.GetActiveSheet();
      const r = Asc.scope.range
        ? ws.GetRange(Asc.scope.range)
        : Api.GetSelection();
      if (!r) return {};

      // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
      function adjustSortKey(keyValue: any, defaultOffset?: number) {
        if (!keyValue) {
          if (defaultOffset !== undefined) {
            return ws.GetCells(r.GetRow(), r.GetCol() + defaultOffset);
          }
          return null;
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

      const k1 = adjustSortKey(Asc.scope.key1, 0);
      const k2 = adjustSortKey(Asc.scope.key2, 1);
      const k3 = adjustSortKey(Asc.scope.key3);

      r.SetSort(
        k1,
        Asc.scope.sortOrder1,
        k2,
        Asc.scope.sortOrder2,
        k3,
        Asc.scope.sortOrder3,
        Asc.scope.header
      );
      return { addr: r.GetAddress(false, false) };
    });

    const addr = sortResult?.addr || range || "selection";
    const orderStr = (o: string) => (o === "xlDescending" ? "desc" : "asc");

    const keys: string[] = [];
    keys.push(
      params.key1 != null
        ? `"${params.key1}" ${orderStr(sortOrder1)}`
        : `col 1 ${orderStr(sortOrder1)}`
    );
    keys.push(
      params.key2 != null
        ? `"${params.key2}" ${orderStr(sortOrder2)}`
        : `col 2 ${orderStr(sortOrder2)}`
    );
    if (params.key3 != null) {
      keys.push(`"${params.key3}" ${orderStr(sortOrder3)}`);
    }
    return `Sorted ${addr} by ${keys.join(", ")}.`;
  },
});
