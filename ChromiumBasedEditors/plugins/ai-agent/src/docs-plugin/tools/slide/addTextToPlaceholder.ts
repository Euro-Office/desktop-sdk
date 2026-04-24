import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalInteger,
  optionalString,
  requireString,
} from "../lib/validation";

export const addTextToPlaceholder = defineTool({
  name: "addTextToPlaceholder",
  description:
    "Universal function for adding ANY text content to slides. Use this for ALL text addition requests: recipes, lists, instructions, notes, ideas, or any other text content.",
  inputSchema: {
    type: "object",
    properties: {
      slideNumber: {
        type: "number",
        description:
          "the slide number to add text to (optional, default current slide)",
        minimum: 1,
      },
      text: {
        type: "string",
        description:
          "ANY text content to add - recipes, lists, instructions, notes, ideas, descriptions, stories, data, or whatever user asks to add",
      },
      textType: {
        type: "string",
        description:
          "type of text - 'body', 'chart', 'clipArt', 'ctrTitle', 'diagram', 'date', 'footer', 'header', 'media', 'object', 'picture', 'sldImage', 'sldNumber', 'subTitle', 'table', 'title' (optional, default 'body')",
      },
      prompt: {
        type: "string",
        description:
          "AI instructions for text enhancement or generation (optional)",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const slideNumber = optionalInteger(params, "slideNumber", { min: 1 });
    const text = requireString(params, "text");
    const textType = optionalString(params, "textType") ?? "body";

    Asc.scope.slideNum = slideNumber;
    Asc.scope.text = text;
    Asc.scope.textType = textType;

    const callResult = await editor.callCommand<
      { error?: string; slidesCount?: number } | undefined
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

      const placeholderGroups: Record<string, string[]> = {
        titles: ["title", "ctrTitle"],
        subTitles: ["subTitle"],
        content: ["body", "object", "unknown"],
        media: [
          "picture",
          "chart",
          "media",
          "clipArt",
          "diagram",
          "sldImage",
          "table",
        ],
        footer: ["footer", "date", "sldNumber", "header"],
      };

      function findPlaceholderGroup(type: string): string[] {
        for (const groupName in placeholderGroups) {
          if (placeholderGroups[groupName].includes(type)) {
            return placeholderGroups[groupName];
          }
        }
        return [type];
      }

      function findShapeByPlaceholderType(
        // biome-ignore lint/suspicious/noExplicitAny: editor API dynamic
        slide: any,
        placeholderTypes: string[]
        // biome-ignore lint/suspicious/noExplicitAny: editor API dynamic
      ): { shape: any; foundType: string } | null {
        const allDrawings = slide.GetAllDrawings();
        for (const t of placeholderTypes) {
          for (let i = 0; i < allDrawings.length; i++) {
            const drawing = allDrawings[i];
            const ph = drawing.GetPlaceholder();
            if (ph && ph.GetType() === t) {
              return { shape: drawing, foundType: t };
            }
          }
        }
        return null;
      }

      const placeholderGroup = findPlaceholderGroup(Asc.scope.textType);
      let searchResult = findShapeByPlaceholderType(slide, placeholderGroup);
      let targetShape = searchResult?.shape ?? null;
      let foundType = searchResult?.foundType ?? null;

      if (
        !targetShape &&
        !placeholderGroups.content.includes(Asc.scope.textType)
      ) {
        searchResult = findShapeByPlaceholderType(
          slide,
          placeholderGroups.content
        );
        targetShape = searchResult?.shape ?? null;
        foundType = searchResult?.foundType ?? null;
      }

      let bNewShape = false;
      if (!targetShape) {
        const slideWidth = presentation.GetWidth();
        const slideHeight = presentation.GetHeight();
        const sizes: Record<string, { width: number; height: number }> = {
          title: { width: 0.8, height: 0.1 },
          ctrTitle: { width: 0.8, height: 0.1 },
          subTitle: { width: 0.8, height: 0.08 },
          body: { width: 0.8, height: 0.6 },
          object: { width: 0.8, height: 0.6 },
          picture: { width: 0.5, height: 0.4 },
          chart: { width: 0.6, height: 0.5 },
          table: { width: 0.8, height: 0.6 },
          media: { width: 0.6, height: 0.5 },
          clipArt: { width: 0.3, height: 0.3 },
          diagram: { width: 0.7, height: 0.5 },
          sldImage: { width: 0.6, height: 0.5 },
          footer: { width: 0.8, height: 0.06 },
          header: { width: 0.8, height: 0.06 },
          date: { width: 0.2, height: 0.04 },
          sldNumber: { width: 0.1, height: 0.04 },
        };
        const size = sizes[Asc.scope.textType] ?? sizes.body;
        const shapeWidth = slideWidth * size.width;
        const shapeHeight = slideHeight * size.height;
        const x = (slideWidth - shapeWidth) / 2;
        const y = (slideHeight - shapeHeight) / 2;

        const oFill = Api.CreateNoFill();
        const oStroke = Api.CreateStroke(0, Api.CreateNoFill());
        targetShape = Api.CreateShape(
          "rect",
          shapeWidth,
          shapeHeight,
          oFill,
          oStroke
        );
        targetShape.SetPosition(x, y);
        slide.AddObject(targetShape);
        foundType = Asc.scope.textType;
        bNewShape = true;
      }

      const docContent = targetShape.GetDocContent();
      if (!docContent) return;

      const internalContent = docContent.Content || docContent;
      while (internalContent.GetElementsCount() > 1) {
        internalContent.RemoveElement(1);
      }

      const lines = (Asc.scope.text as string)
        .split("\n")
        .filter((line) => line.trim() !== "");

      if (lines.length === 1) {
        const paragraph = internalContent.GetElement(0);
        if (paragraph) {
          paragraph.RemoveAllElements();
          paragraph.AddText(lines[0]);
        }
      } else {
        const firstParagraph = internalContent.GetElement(0);
        if (firstParagraph) {
          firstParagraph.RemoveAllElements();
          const run = firstParagraph.AddText(lines[0]);
          if (bNewShape) {
            run.SetFill(Api.CreateSolidFill(Api.CreateSchemeColor("tx1")));
          }
        }
        for (let i = 1; i < lines.length; i++) {
          const newParagraph = Api.CreateParagraph();
          const run = newParagraph.AddText(lines[i]);
          if (bNewShape) {
            run.SetFill(Api.CreateSolidFill(Api.CreateSchemeColor("tx1")));
          }
          internalContent.Push(newParagraph);
        }
      }

      // Silence unused-var warning for foundType
      void foundType;
    });

    if (callResult?.error === "slide_not_found") {
      throw new ToolError(
        `Slide ${slideNumber} does not exist! The presentation has ${callResult.slidesCount} slides.`
      );
    }

    return { isApply: true };
  },
});
