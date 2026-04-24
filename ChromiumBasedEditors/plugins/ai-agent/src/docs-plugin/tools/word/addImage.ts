import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import {
  optionalNumber,
  optionalString,
  requireString,
} from "../lib/validation";

const MM_TO_PX = 96 / 25.4;
const PX_TO_EMU = 9525;

function mmToPx(mm: number): number {
  return Math.floor(mm * MM_TO_PX + 0.5);
}

function buildPromptForImage(
  description: string,
  style: string,
  widthPx: number,
  heightPx: number
): string {
  let sizeFormat = "";
  const aspectRatio = widthPx / heightPx;
  if (aspectRatio > 1.8) sizeFormat = ", wide panoramic format";
  else if (aspectRatio < 0.6) sizeFormat = ", tall vertical format";
  else if (aspectRatio > 0.9 && aspectRatio < 1.1)
    sizeFormat = ", square format";

  return `${style} style, ${description}, image size ${widthPx}x${heightPx} pixels${sizeFormat}`;
}

function ensureDataUrl(base64OrUrl: string): string {
  if (/^(data:|https?:|file:)/.test(base64OrUrl)) return base64OrUrl;
  return `data:image/png;base64,${base64OrUrl}`;
}

export const addImage = defineTool({
  name: "addImage",
  description:
    "Generate an image from text and insert it at the current cursor position. Width and height are in millimeters.",
  inputSchema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Text description of the image to generate.",
      },
      width: {
        type: "number",
        description: "Image width in millimeters.",
        default: 100,
      },
      height: {
        type: "number",
        description: "Image height in millimeters.",
        default: 100,
      },
      style: {
        type: "string",
        description: "Image style (realistic, cartoon, abstract, etc.).",
        default: "realistic",
      },
    },
    required: ["description"],
  },
  handler: async (params) => {
    const description = requireString(params, "description");
    const width = optionalNumber(params, "width");
    const height = optionalNumber(params, "height");
    const style = optionalString(params, "style") ?? "realistic";

    if (width !== undefined && width <= 0) {
      throw new ToolError(
        `Parameter "width" must be a positive number. Got: ${width}`
      );
    }
    if (height !== undefined && height <= 0) {
      throw new ToolError(
        `Parameter "height" must be a positive number. Got: ${height}`
      );
    }

    const widthMm = width ?? 100;
    const heightMm = height ?? 100;
    const widthPx = mmToPx(widthMm);
    const heightPx = mmToPx(heightMm);

    const fullPrompt = buildPromptForImage(
      description,
      style,
      widthPx,
      heightPx
    );

    if (!window.AI) {
      return { isApply: false, reason: "Image generation is not available" };
    }
    const requestEngine = window.AI.Request.create(
      window.AI.ActionType.ImageGeneration
    );

    const rawResult = await requestEngine.imageGenerationRequest(
      fullPrompt,
      widthPx,
      heightPx
    );
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
    if (!library) {
      return { isApply: false, reason: "Library not installed" };
    }

    const editorVersion = await library.GetEditorVersion();
    if (editorVersion >= 9_000_000) {
      const urlResult = await library.GetLocalImagePath(dataUrl);
      if (urlResult.error) {
        return { isApply: false, reason: "Failed to process generated image" };
      }
      Asc.scope.imageUrl = urlResult.url;
    } else {
      Asc.scope.imageUrl = dataUrl;
    }
    Asc.scope.widthEmu = widthEmu;
    Asc.scope.heightEmu = heightEmu;

    await editor.callCommand(() => {
      const doc = Api.GetDocument();
      doc.ReplaceCurrentImage(
        Asc.scope.imageUrl,
        Asc.scope.widthEmu,
        Asc.scope.heightEmu
      );
    });

    return { isApply: true };
  },
});
