import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalBoolean, optionalNumber } from "../lib/validation";

interface TextStyleParams {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeout?: boolean;
  fontSize?: number;
}

export const changeTextStyle = defineTool({
  name: "changeTextStyle",
  description:
    "Changes the style of the selected text, including bold, italic, underline, strikethrough, and font size.",
  inputSchema: {
    type: "object",
    properties: {
      bold: {
        type: "boolean",
        description:
          "Whether to make the text bold (true to enable, false to disable).",
      },
      italic: {
        type: "boolean",
        description:
          "Whether to make the text italic (true to enable, false to disable).",
      },
      underline: {
        type: "boolean",
        description:
          "Whether to underline the text (true to enable, false to disable).",
      },
      strikeout: {
        type: "boolean",
        description:
          "Whether to strike through the text (true to enable, false to disable).",
      },
      fontSize: {
        type: "number",
        description: "The font size to apply to the selected text.",
        minimum: 1,
        maximum: 200,
      },
    },
    required: [],
  },
  handler: async (params) => {
    const styleParams: TextStyleParams = {
      bold: optionalBoolean(params, "bold"),
      italic: optionalBoolean(params, "italic"),
      underline: optionalBoolean(params, "underline"),
      strikeout: optionalBoolean(params, "strikeout"),
      fontSize: optionalNumber(params, "fontSize"),
    };

    if (styleParams.fontSize !== undefined) {
      if (styleParams.fontSize < 1 || styleParams.fontSize > 200) {
        throw new ToolError(
          `Parameter "fontSize" must be between 1 and 200. Got: ${styleParams.fontSize}`
        );
      }
    }

    Asc.scope.styleParams = styleParams;
    await editor.callCommand(() => {
      const doc = Api.GetDocument();
      let range = doc.GetRangeBySelect();
      if (!range || range.GetText() === "") {
        doc.SelectCurrentWord();
        range = doc.GetRangeBySelect();
      }
      if (!range) return;

      const props = Asc.scope.styleParams as TextStyleParams;
      if (props.bold !== undefined) range.SetBold(props.bold);
      if (props.italic !== undefined) range.SetItalic(props.italic);
      if (props.underline !== undefined) range.SetUnderline(props.underline);
      if (props.strikeout !== undefined) range.SetStrikeout(props.strikeout);
      if (props.fontSize !== undefined) range.SetFontSize(props.fontSize);
    });

    return { isApply: true };
  },
});
