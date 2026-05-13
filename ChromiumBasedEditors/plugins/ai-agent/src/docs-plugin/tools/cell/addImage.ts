import { editor } from "../../library/editor";
import { endGroupActions, startGroupActions } from "../lib/aiActions";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalNumber,
  optionalString,
  requireString,
} from "../lib/validation";

const PX_TO_EMU = 9525;
const MM_TO_PX = 96 / 25.4;

function ensureDataUrl(base64OrUrl: string): string {
  if (/^(data:|https?:|file:)/.test(base64OrUrl)) return base64OrUrl;
  return `data:image/png;base64,${base64OrUrl}`;
}

export const addImage = defineTool({
  name: "addImage",
  description:
    "Generates an image using AI from a text description and inserts it into the spreadsheet. Optionally specify width, height (mm), and style.",
  inputSchema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Text description of the image to generate.",
      },
      width: {
        type: "number",
        description: "Image width in mm (default: 100)",
      },
      height: {
        type: "number",
        description: "Image height in mm (default: 100)",
      },
      style: {
        type: "string",
        description: "Image style (realistic, cartoon, abstract, etc.)",
      },
    },
    required: ["description"],
  },
  handler: async (params) => {
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

    const widthPx = Math.floor(widthMm * MM_TO_PX + 0.5);
    const heightPx = Math.floor(heightMm * MM_TO_PX + 0.5);

    let fullPrompt = `${style} style, ${description}, image size ${widthPx}x${heightPx} pixels`;
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

    const rawResult = await requestEngine.imageGenerationRequest({
      prompt: fullPrompt,
      width: widthPx,
      height: heightPx,
    });

    if (!rawResult) {
      return { isApply: false, reason: "Empty image generation response" };
    }

    const dataUrl = ensureDataUrl(rawResult);

    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const widthEmu = Math.floor(img.naturalWidth * PX_TO_EMU + 0.5);
    const heightEmu = Math.floor(img.naturalHeight * PX_TO_EMU + 0.5);

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

    Asc.scope.imageUrl = resolvedUrl;
    Asc.scope.imgWidth = widthEmu;
    Asc.scope.imgHeight = heightEmu;

    await startGroupActions();
    await editor.callCommand(() => {
      const worksheet = Api.GetActiveSheet();
      worksheet.ReplaceCurrentImage(
        Asc.scope.imageUrl,
        Asc.scope.imgWidth,
        Asc.scope.imgHeight
      );
    });
    await endGroupActions();

    return { isApply: true };
  },
});
