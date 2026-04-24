import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalEnum,
  optionalInteger,
  optionalString,
} from "../lib/validation";

const BG_TYPES = ["solid", "gradient"] as const;

export const changeSlideBackground = defineTool({
  name: "changeSlideBackground",
  description: "Changes the color of the slide in the presentation.",
  inputSchema: {
    type: "object",
    properties: {
      slideNumber: {
        type: "number",
        description: "Slide number to apply the color",
        minimum: 1,
      },
      backgroundType: {
        type: "string",
        description: "type of background - 'solid', 'gradient'",
      },
      color: {
        type: "string",
        description: "hex color for solid background (e.g., '#FF5733')",
      },
      gradientColors: {
        type: "array",
        description: "array of hex colors for gradient",
        items: { type: "string" },
      },
    },
    required: [],
  },
  handler: async (params) => {
    const slideNumber = optionalInteger(params, "slideNumber", { min: 1 });
    const backgroundType = optionalEnum(params, "backgroundType", BG_TYPES);
    const color = optionalString(params, "color");
    const rawGradient = params.gradientColors;
    const gradientColors =
      Array.isArray(rawGradient) &&
      rawGradient.every((c) => typeof c === "string")
        ? (rawGradient as string[])
        : undefined;

    Asc.scope.slideNum = slideNumber;
    Asc.scope.backgroundType = backgroundType;
    Asc.scope.color = color;
    Asc.scope.gradientColors = gradientColors;

    const callResult = await editor.callCommand<
      | { error?: string; slidesCount?: number; validTypes?: string[] }
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

      let fill = null;
      switch (Asc.scope.backgroundType) {
        case "solid":
          if (Asc.scope.color) {
            const rgb = parseInt(Asc.scope.color.slice(1), 16);
            const r = (rgb >> 16) & 255;
            const g = (rgb >> 8) & 255;
            const b = rgb & 255;
            fill = Api.CreateSolidFill(Api.CreateRGBColor(r, g, b));
          }
          break;

        case "gradient":
          if (
            Asc.scope.gradientColors &&
            Asc.scope.gradientColors.length >= 2
          ) {
            const stops = [];
            const step = 100000 / (Asc.scope.gradientColors.length - 1);
            for (let i = 0; i < Asc.scope.gradientColors.length; i++) {
              const c = Asc.scope.gradientColors[i];
              const rgb = parseInt(c.slice(1), 16);
              const r = (rgb >> 16) & 255;
              const g = (rgb >> 8) & 255;
              const b = rgb & 255;
              stops.push(
                Api.CreateGradientStop(Api.CreateRGBColor(r, g, b), i * step)
              );
            }
            fill = Api.CreateLinearGradientFill(stops, 5400000);
          }
          break;
      }

      if (fill) slide.SetBackground(fill);
    });

    if (callResult?.error === "slide_not_found") {
      throw new ToolError(
        `Slide ${slideNumber} does not exist! The presentation has ${callResult.slidesCount} slides.`
      );
    }

    return { isApply: true };
  },
});
