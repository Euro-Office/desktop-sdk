import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalInteger, optionalString } from "../lib/validation";

const VALID_SHAPE_TYPES = [
  "rect",
  "roundRect",
  "ellipse",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "star5",
  "plus",
  "mathMinus",
  "mathMultiply",
  "mathEqual",
  "mathNotEqual",
  "heart",
  "cloud",
  "leftArrow",
  "rightArrow",
  "upArrow",
  "downArrow",
  "leftRightArrow",
  "chevron",
  "bentArrow",
  "curvedRightArrow",
  "blockArc",
  "wedgeRectCallout",
  "cloudCallout",
  "ribbon",
  "wave",
  "can",
  "cube",
  "pie",
  "donut",
  "sun",
  "moon",
  "smileyFace",
  "lightningBolt",
  "noSmoking",
];

export const addShapeToSlide = defineTool({
  name: "addShapeToSlide",
  description:
    "Adds a shape to the slide with optional text (139x42mm, centered, blue fill with dark border)",
  inputSchema: {
    type: "object",
    properties: {
      slideNumber: {
        type: "number",
        description: "Slide number to add shape to",
        minimum: 1,
      },
      shapeType: {
        type: "string",
        description: `shape type - ${VALID_SHAPE_TYPES.join(", ")}`,
      },
      text: {
        type: "string",
        description: "text to add to the shape",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const slideNumber = optionalInteger(params, "slideNumber", { min: 1 });
    const shapeType = optionalString(params, "shapeType") ?? "rect";
    const text = optionalString(params, "text");

    Asc.scope.slideNum = slideNumber;
    Asc.scope.shapeType = shapeType;
    Asc.scope.text = text;

    const callResult = await editor.callCommand<
      | {
          error?: string;
          slidesCount?: number;
          validTypes?: string[];
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

      const validShapeTypes = [
        "rect",
        "roundRect",
        "ellipse",
        "triangle",
        "diamond",
        "pentagon",
        "hexagon",
        "star5",
        "plus",
        "mathMinus",
        "mathMultiply",
        "mathEqual",
        "mathNotEqual",
        "heart",
        "cloud",
        "leftArrow",
        "rightArrow",
        "upArrow",
        "downArrow",
        "leftRightArrow",
        "chevron",
        "bentArrow",
        "curvedRightArrow",
        "blockArc",
        "wedgeRectCallout",
        "cloudCallout",
        "ribbon",
        "wave",
        "can",
        "cube",
        "pie",
        "donut",
        "sun",
        "moon",
        "smileyFace",
        "lightningBolt",
        "noSmoking",
      ];
      if (validShapeTypes.indexOf(Asc.scope.shapeType) === -1) {
        return {
          error: "invalid_shape_type",
          validTypes: validShapeTypes,
        };
      }

      const slideWidth = presentation.GetWidth();
      const slideHeight = presentation.GetHeight();
      const width = 2500000;
      const height = 2500000;
      const x = (slideWidth - width) / 2;
      const y = (slideHeight - height) / 2;

      const fill = Api.CreateSolidFill(Api.CreateSchemeColor("accent1"));
      const stroke = Api.CreateStroke(
        12700,
        Api.CreateSolidFill(Api.CreateRGBColor(51, 51, 51))
      );

      const shape = Api.CreateShape(
        Asc.scope.shapeType,
        width,
        height,
        fill,
        stroke
      );
      shape.SetPosition(x, y);

      if (Asc.scope.text) {
        const docContent = shape.GetDocContent();
        if (docContent) {
          let paragraph = docContent.GetElement(0);
          if (!paragraph) {
            paragraph = Api.CreateParagraph();
            docContent.Push(paragraph);
          }
          paragraph.SetJc("center");
          paragraph.AddText(Asc.scope.text);
          shape.SetVerticalTextAlign("center");
        }
      }
      slide.AddObject(shape);
    });

    if (callResult?.error === "slide_not_found") {
      throw new ToolError(
        `Slide ${slideNumber} does not exist! The presentation has ${callResult.slidesCount} slides.`
      );
    }
    if (callResult?.error === "invalid_shape_type") {
      throw new ToolError(
        `The shape type "${shapeType}" is not valid! Here is a list of available shape types: ${JSON.stringify(callResult.validTypes)}`
      );
    }

    return { isApply: true };
  },
});
