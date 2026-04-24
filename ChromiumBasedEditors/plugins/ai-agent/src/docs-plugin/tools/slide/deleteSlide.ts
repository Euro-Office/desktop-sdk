import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalInteger } from "../lib/validation";

interface DeleteResult {
  error?: string;
  slidesCount?: number;
  curSlideIdx?: number;
  slideIdx?: number;
}

export const deleteSlide = defineTool({
  name: "deleteSlide",
  description: "Deletes slide with the specific index or current",
  inputSchema: {
    type: "object",
    properties: {
      slideNumber: {
        type: "number",
        description: "the slide number to delete",
        minimum: 1,
      },
    },
    required: [],
  },
  handler: async (params) => {
    const slideNumber = optionalInteger(params, "slideNumber", { min: 1 });
    Asc.scope.slideNum = slideNumber;

    const data = await editor.callCommand<DeleteResult | null>(() => {
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

      const curSlideIdx = presentation.GetCurSlideIndex();
      const slideIdx = slide.GetSlideIndex();
      slide.Delete();
      return { curSlideIdx, slideIdx };
    });

    if (data?.error === "slide_not_found") {
      throw new ToolError(
        `Slide ${slideNumber} does not exist! The presentation has ${data.slidesCount} slides.`
      );
    }

    if (data && data.slideIdx !== undefined && data.curSlideIdx !== undefined) {
      if (data.slideIdx <= data.curSlideIdx) {
        await editor.callMethod("GoToSlide", [data.curSlideIdx]);
      }
    }

    return { isApply: true };
  },
});
