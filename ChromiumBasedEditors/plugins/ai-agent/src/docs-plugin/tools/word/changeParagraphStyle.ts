import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalNumber, requireString } from "../lib/validation";

export const changeParagraphStyle = defineTool({
  name: "changeParagraphStyle",
  description:
    "Changes the style of a specified paragraph in the document. If no paragraph number is provided, affects the current paragraph.",
  inputSchema: {
    type: "object",
    properties: {
      parNumber: {
        type: "number",
        description:
          "The paragraph number to apply style changes to. If not provided, the current paragraph will be used.",
      },
      style: {
        type: "string",
        description:
          "The style name to apply to the paragraph (e.g., 'Heading 1', 'Normal', etc.).",
      },
    },
    required: ["style"],
  },
  handler: async (params) => {
    const styleName = requireString(params, "style");
    const parNumber = optionalNumber(params, "parNumber");

    Asc.scope.parNumber = parNumber;
    Asc.scope.styleName = styleName;

    const callResult = await editor.callCommand<string[] | undefined>(() => {
      const doc = Api.GetDocument();
      const par =
        Asc.scope.parNumber === undefined
          ? doc.GetCurrentParagraph()
          : doc.GetElement(Asc.scope.parNumber - 1);
      if (!par) return;

      const names: string[] = [];
      doc
        .GetAllStyles()
        .forEach((style: { GetType: () => string; GetName: () => string }) => {
          if (style.GetType() === "paragraph") names.push(style.GetName());
        });

      if (names.includes(Asc.scope.styleName)) {
        const style = doc.GetStyle(Asc.scope.styleName);
        par.SetStyle(style);
        return;
      }

      return names;
    });

    if (Array.isArray(callResult)) {
      throw new ToolError(
        `The style "${styleName}" does not exist! Here is a list of available styles: ${JSON.stringify(callResult)}`
      );
    }

    return { isApply: true };
  },
});
