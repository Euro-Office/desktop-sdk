import type { ActionType } from "@onlyoffice/ai-chat";
import { editor } from "../../library/editor";
import { startGroupActions } from "../lib/aiActions";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalInteger, optionalString } from "../lib/validation";
import { createStreamHandler } from "./presentation/dispatcher";
import { Executor } from "./presentation/Executor";
import { buildPrompt } from "./presentation/prompt";

interface FontEntry {
  m_wsFontName?: string;
}

interface AiRequestApi {
  chatRequest(
    content: string,
    block?: boolean,
    streamFunc?: (delta: string, isFinal: boolean) => void | Promise<void>
  ): Promise<string>;
}
interface AiGlobal {
  ActionType: { Chat: string; ImageGeneration: string };
  Request: { create(action: string): AiRequestApi | null };
}

export const generatePresentationWithTheme = defineTool({
  name: "generatePresentationWithTheme",
  description:
    "Generates a complete presentation with custom theme, fonts, and streaming content",
  inputSchema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "presentation topic" },
      slideCount: {
        type: "string",
        description: "number of slides (string)",
      },
      style: {
        type: "string",
        description: "visual style — modern, classic, minimal, corporate",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const topic = optionalString(params, "topic") || "Untitled presentation";
    const style = optionalString(params, "style") || "modern";
    // slideCount is documented as a string but the old plugin parses int from
    // `params.slideCount` regardless of input type — accept both.
    const rawSlideCount = params.slideCount;
    const intSlideCount =
      typeof rawSlideCount === "number"
        ? Math.floor(rawSlideCount)
        : typeof rawSlideCount === "string"
          ? parseInt(rawSlideCount, 10)
          : (optionalInteger(params, "slideCount", { min: 1 }) ?? Number.NaN);
    const userSlideCount =
      Number.isFinite(intSlideCount) && intSlideCount > 0
        ? intSlideCount
        : null;

    const fontList = await editor.callMethod<FontEntry[] | null>("GetFontList");
    const availableFonts = (fontList || [])
      .map((f) => f.m_wsFontName)
      .filter((name): name is string => !!name);

    const editorVersion = (await window.Asc.Library?.GetEditorVersion()) ?? 0;
    const supportsAnimations = editorVersion >= 9003000;

    const win = window as unknown as { AI?: AiGlobal };
    if (!win.AI) {
      throw new ToolError("AI runtime not available");
    }
    const requestEngine = win.AI.Request.create(win.AI.ActionType.Chat);
    if (!requestEngine) {
      throw new ToolError("Failed to create AI chat request engine");
    }

    const chatAction: ActionType = "Chat" as ActionType;
    const imageAction: ActionType = "ImageGeneration" as ActionType;

    const prompt = buildPrompt({
      topic,
      userSlideCount,
      style,
      availableFonts,
      supportsAnimations,
    });

    const exec = new Executor(chatAction, imageAction);
    const handler = createStreamHandler(exec, {
      supportsAnimations,
      chatAction,
    });

    try {
      await startGroupActions();
      await exec.startBlock();
      await requestEngine.chatRequest(prompt, false, handler);
      // If the model never emitted presentation.end, drain images / end groups.
      if (!exec.presentationEndReached) {
        await exec.checkEndAction();
        await exec.endGroupActionsOnce();
      }
    } catch (err) {
      await exec.checkEndAction();
      await exec.endGroupActionsOnce();
      throw err instanceof Error
        ? new ToolError(err.message)
        : new ToolError(String(err));
    }

    return { isApply: true };
  },
});
