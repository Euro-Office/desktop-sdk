import markdownit from "markdown-it";
import { editor } from "./editor";
import { library, pluginsMD } from "./library";
import { prompts } from "./prompts";

export function install(): void {
  if (window.Asc.Editor) return;

  const win = window as Window & {
    markdownit?: typeof markdownit;
  };
  if (!win.markdownit) win.markdownit = markdownit;

  window.Asc.Editor = editor;
  window.Asc.Library = library;
  window.Asc.Prompts = prompts;
  window.Asc.PluginsMD = pluginsMD;
}
