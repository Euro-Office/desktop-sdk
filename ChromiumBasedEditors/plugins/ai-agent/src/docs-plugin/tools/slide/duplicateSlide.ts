import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalInteger } from "../lib/validation";

interface DuplicateResult {
  error?: string;
  slidesCount?: number;
  idx?: number;
}

export const duplicateSlide = defineTool({
  name: "duplicateSlide",
  description: "Duplicates slide with the specific index or current",
  inputSchema: {
    type: "object",
    properties: {
      slideNumber: {
        type: "number",
        description: "the slide number to duplicate",
        minimum: 1,
      },
    },
    required: [],
  },
  handler: async (params) => {
    const slideNumber = optionalInteger(params, "slideNumber", { min: 1 });
    Asc.scope.slideNum = slideNumber;

    const data = await editor.callCommand<DuplicateResult | null>(() => {
      const presentation = Api.GetPresentation();
      let slide = null;
      if (Asc.scope.slideNum !== undefined && Asc.scope.slideNum !== null) {
        slide = presentation.GetSlideByIndex(Asc.scope.slideNum - 1);
        if (!slide) {
          return {
            error: "slide_not_found",
            slidesCount: presentation.GetSlidesCount(),
          };
        }
      }
      if (!slide) slide = presentation.GetCurrentSlide();
      if (!slide) return null;

      const slideIdx = slide.GetSlideIndex();
      slide.Duplicate(slideIdx + 1);
      return { idx: slideIdx + 1 };
    });

    if (data?.error === "slide_not_found") {
      throw new ToolError(
        `Slide ${slideNumber} does not exist! The presentation has ${data.slidesCount} slides.`
      );
    }

    if (data && data.idx !== undefined) {
      await editor.callMethod("GoToSlide", [data.idx + 1]);
    }

    return { isApply: true };
  },
});
