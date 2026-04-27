import { editor } from "../../../library/editor";
import { getAiBlockLabel } from "../../lib/aiActions";
import type { Executor } from "./Executor";
import { JsonObjectFramer, type ParsedCmd, parseCmd } from "./JsonObjectFramer";

export interface DispatcherOptions {
  supportsAnimations: boolean;
  /** ActionType used for the chat (provides modelKey for the action label). */
  // biome-ignore lint/suspicious/noExplicitAny: ActionType from @onlyoffice/ai-chat
  chatAction: any;
}

export function createStreamHandler(
  exec: Executor,
  options: DispatcherOptions
): (chunk: string) => Promise<void> {
  const framer = new JsonObjectFramer();
  return async (chunk: string) => {
    if (!chunk) return;
    framer.push(chunk);
    const objs = framer.drainObjects();
    for (const objStr of objs) {
      const cmd = parseCmd(objStr);
      if (!cmd) continue;
      await dispatchCommand(cmd, exec, options);
    }
  };
}

async function dispatchCommand(
  cmd: ParsedCmd,
  exec: Executor,
  options: DispatcherOptions
): Promise<void> {
  const t = cmd.t;
  switch (t) {
    case "presentation.start":
      await exec.presentationStart(cmd.language as string | undefined);
      return;
    case "presentation.end":
      await exec.presentationEnd();
      return;

    case "theme.start":
      await exec.themeStart();
      return;
    case "theme.colors":
      await exec.themeColors(cmd as Record<string, string>);
      return;
    case "theme.fonts":
      await exec.themeFonts(
        (cmd.major as string) || "Arial",
        (cmd.minor as string) || "Arial"
      );
      return;
    case "theme.decor.start":
      await exec.themeDecorStart();
      return;
    case "layoutDecor":
      await exec.layoutDecor(
        cmd as unknown as {
          layoutType: string;
          fill: string;
          opacity: number;
          d: string;
        }
      );
      return;
    case "theme.decor.end":
      await exec.themeDecorEnd();
      return;
    case "theme.end":
      await exec.themeEnd();
      // Mirror old plugin: end the user-visible Block action when theme finishes
      // (text streaming proceeds; image generation runs after with its own Block lifecycle).
      await editor.callMethod("EndAction", [
        "Block",
        getAiBlockLabel(options.chatAction),
      ]);
      return;

    case "slide.start":
      await exec.slideStart((cmd.layout as string) || "obj");
      return;
    case "slide.end":
      await exec.slideEnd();
      return;

    case "figure.start":
      await exec.figureStart(
        cmd as unknown as { ph_type: string; ph_idx: number }
      );
      return;
    case "figure.end":
      await exec.figureEnd();
      return;

    case "para":
      await exec.para((cmd.text as string) || "");
      return;

    case "picture.start":
      await exec.pictureStart(
        cmd as unknown as { ph_type?: string; ph_idx?: number }
      );
      return;
    case "picture.desc":
      await exec.pictureDesc((cmd.text as string) || "");
      return;
    case "picture.end":
      await exec.pictureEnd();
      return;

    case "table.start":
      await exec.tableStart(
        cmd as unknown as {
          ph_type: string;
          ph_idx: number;
          rows?: number;
          cols?: number;
        }
      );
      return;
    case "cell.start":
      await exec.cellStart(
        ((cmd.row as number) | 0) as number,
        ((cmd.col as number) | 0) as number
      );
      return;
    case "cell.end":
      await exec.cellEnd();
      return;
    case "table.end":
      await exec.tableEnd();
      return;

    case "chart.start":
      await exec.chartStart(
        cmd as unknown as {
          ph_type: string;
          ph_idx: number;
          chartType?: string;
        }
      );
      return;
    case "chart.title":
      await exec.chartTitle((cmd.text as string) || "");
      return;
    case "chart.axes":
      await exec.chartAxes((cmd.x as string) || "", (cmd.y as string) || "");
      return;
    case "chart.categories":
      await exec.chartCategories(cmd.items || []);
      return;
    case "chart.series":
      await exec.chartSeries((cmd.name as string) || "", cmd.values || []);
      return;
    case "chart.end":
      await exec.chartEnd();
      return;

    case "notes.start":
      await exec.notesStart();
      return;
    case "notes.end":
      await exec.notesEnd();
      return;

    case "slide.transition":
      if (options.supportsAnimations) {
        await exec.slideTransition(
          cmd.effect as string | undefined,
          cmd.speed as string | undefined,
          cmd.advanceOnClick as boolean | undefined
        );
      }
      return;
    case "animation":
      if (options.supportsAnimations) {
        await exec.animation(
          (cmd.ph_type as string) || "body",
          (cmd.ph_idx as number) || 0,
          cmd.effect as string | undefined,
          cmd.trigger as string | undefined,
          cmd.duration as number | undefined
        );
      }
      return;
  }
}
