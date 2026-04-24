import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { requireEnum } from "../lib/validation";

const LOCATIONS = ["current", "start", "end"] as const;

export const insertPage = defineTool({
  name: "insertPage",
  description:
    "Inserts a blank page at the specified location in the document.",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        enum: [...LOCATIONS],
        description:
          "Where to insert the new page ('current', 'start', or 'end').",
        default: "current",
      },
    },
    required: ["location"],
  },
  handler: async (params) => {
    const location = requireEnum(params, "location", LOCATIONS);

    Asc.scope.location = location;
    await editor.callCommand(() => {
      const doc = Api.GetDocument();
      if (Asc.scope.location === "start") doc.MoveCursorToStart();
      else if (Asc.scope.location === "end") doc.MoveCursorToEnd();

      doc.InsertBlankPage();
    });

    return { isApply: true };
  },
});
