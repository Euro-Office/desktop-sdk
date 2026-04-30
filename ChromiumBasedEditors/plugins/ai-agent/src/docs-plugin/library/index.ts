import type { StorageAdapter } from "@onlyoffice/ai-chat";
import markdownit from "markdown-it";
import { editor } from "./editor";
import { AscLibrary, pluginsMD } from "./library";
import { prompts } from "./prompts";
import { AiActionType, AiRequestFactory } from "./request";

export function install(storage: StorageAdapter): void {
  if (window.Asc.Editor) return;

  const win = window as Window & {
    markdownit?: typeof markdownit;
  };
  if (!win.markdownit) win.markdownit = markdownit;

  window.Asc.Editor = editor;
  window.Asc.Library = new AscLibrary();
  window.Asc.Prompts = prompts;
  window.Asc.PluginsMD = pluginsMD;
  window.AI = {
    ActionType: AiActionType,
    Request: {
      create: (action: string) => AiRequestFactory.create(action, storage),
    },
  };
}
