import { editor } from "../../library/editor";
import {
  endGroupActions,
  getAiBlockLabel,
  startBlockAction,
  startGroupActions,
} from "../lib/aiActions";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalInteger,
  optionalNumber,
  optionalString,
  requireString,
} from "../lib/validation";

const MM_TO_EMU = 36000;
const MM_TO_PX = 96 / 25.4;

function ensureDataUrl(base64OrUrl: string): string {
  if (/^(data:|https?:|file:)/.test(base64OrUrl)) return base64OrUrl;
  return `data:image/png;base64,${base64OrUrl}`;
}

export const addImageByDescription = defineTool({
  name: "addImageByDescription",
  description: "Adds an image on the slide in the presentation",
  inputSchema: {
    type: "object",
    properties: {
      slideNumber: {
        type: "number",
        description: "the slide number to add generated image to",
        minimum: 1,
      },
      description: {
        type: "string",
        description: "text description of the image to generate",
      },
      width: { type: "number", description: "image width in mm" },
      height: { type: "number", description: "image height in mm" },
      style: {
        type: "string",
        description: "image style (realistic, cartoon, abstract, etc.)",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const slideNumber = optionalInteger(params, "slideNumber", { min: 1 });
    const description = requireString(params, "description");
    const widthMm = optionalNumber(params, "width") ?? 100;
    const heightMm = optionalNumber(params, "height") ?? 100;
    const style = optionalString(params, "style") ?? "realistic";

    if (widthMm <= 0) {
      throw new ToolError(
        `Parameter "width" must be a positive number. Got: ${widthMm}`
      );
    }
    if (heightMm <= 0) {
      throw new ToolError(
        `Parameter "height" must be a positive number. Got: ${heightMm}`
      );
    }

    const widthEmu = widthMm * MM_TO_EMU;
    const heightEmu = heightMm * MM_TO_EMU;
    const widthPx = Math.round(widthMm * MM_TO_PX);
    const heightPx = Math.round(heightMm * MM_TO_PX);

    let fullPrompt = description;
    if (style !== "realistic") {
      fullPrompt = `${style} style, ${fullPrompt}`;
    }
    fullPrompt += `, image size ${widthPx}x${heightPx} pixels`;

    const aspectRatio = widthPx / heightPx;
    if (aspectRatio > 1.8) fullPrompt += ", wide panoramic format";
    else if (aspectRatio < 0.6) fullPrompt += ", tall vertical format";
    else if (aspectRatio > 0.9 && aspectRatio < 1.1)
      fullPrompt += ", square format";

    if (!window.AI) {
      throw new ToolError(
        "Image generation is not available. Please check your AI provider settings."
      );
    }
    const requestEngine = window.AI.Request.create(
      window.AI.ActionType.ImageGeneration
    );

    await startGroupActions();
    const block = await startBlockAction(
      getAiBlockLabel(window.AI.ActionType.ImageGeneration)
    );

    try {
      const rawResult = await requestEngine.imageGenerationRequest(
        fullPrompt,
        widthPx,
        heightPx
      );
      await block.end();

      if (!rawResult) {
        throw new ToolError(
          "Image generation failed. The AI provider returned no image."
        );
      }

      const dataUrl = ensureDataUrl(rawResult);
      const library = window.Asc.Library;
      if (!library) throw new ToolError("Library not installed");

      const editorVersion = await library.GetEditorVersion();
      let resolvedUrl: string;
      if (editorVersion >= 9_000_000) {
        const urlResult = await library.GetLocalImagePath(dataUrl);
        if (urlResult.error) {
          throw new ToolError("Failed to process generated image");
        }
        resolvedUrl = urlResult.url;
      } else {
        resolvedUrl = dataUrl;
      }

      Asc.scope.slideNum = slideNumber;
      Asc.scope.imageUrl = resolvedUrl;
      Asc.scope.imgWidth = widthEmu;
      Asc.scope.imgHeight = heightEmu;

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
        if (!slide) return { error: "no_current_slide" };

        const slideWidth = presentation.GetWidth();
        const slideHeight = presentation.GetHeight();

        let contentPh = null;
        const allDrawings = slide.GetAllDrawings();
        for (let di = 0; di < allDrawings.length; di++) {
          const ph = allDrawings[di].GetPlaceholder();
          if (ph) {
            const t = ph.GetType();
            if (
              t === "picture" ||
              t === "clipArt" ||
              t === "unknown" ||
              t === "object" ||
              t === "body"
            ) {
              contentPh = allDrawings[di];
              break;
            }
          }
        }

        if (contentPh) {
          const phWidth = contentPh.GetWidth();
          const phHeight = contentPh.GetHeight();
          const oImage = Api.CreateImage(Asc.scope.imageUrl, phWidth, phHeight);
          contentPh.ReplacePlaceholder(oImage);
        } else {
          const x = (slideWidth - Asc.scope.imgWidth) / 2;
          const y = (slideHeight - Asc.scope.imgHeight) / 2;
          const oImage = Api.CreateImage(
            Asc.scope.imageUrl,
            Asc.scope.imgWidth,
            Asc.scope.imgHeight
          );
          oImage.SetPosition(x, y);
          slide.AddObject(oImage);
        }
      });

      if (callResult?.error === "slide_not_found") {
        throw new ToolError(
          `Slide ${slideNumber} does not exist! The presentation has ${callResult.slidesCount} slides.`
        );
      }
      if (callResult?.error === "no_current_slide") {
        throw new ToolError("No active slide found in the presentation.");
      }
    } finally {
      await block.end();
      await endGroupActions();
    }

    return { isApply: true };
  },
});
