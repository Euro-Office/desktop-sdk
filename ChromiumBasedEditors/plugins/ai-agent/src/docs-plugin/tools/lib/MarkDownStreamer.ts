import { editor } from "../../library/editor";

type MarkdownPlugin = (md: object) => void;

export class MarkDownStreamer {
  private isStarted = false;
  private tail = "";
  private readonly msPlugins: MarkdownPlugin[];
  private readonly isStreaming: boolean;

  constructor(isStreaming: boolean) {
    this.isStreaming = isStreaming;
    const plugins = window.Asc.PluginsMD;
    this.msPlugins = plugins ? [plugins.latex, plugins.forms, plugins.hr] : [];
  }

  async onStreamChunk(mdValue: string, isFinal: boolean): Promise<void> {
    if (!this.isStarted) {
      await editor.callMethod("StartAction", ["GroupActions"]);
      await window.Asc.Library?.PasteText("\n");
      await editor.callCommand(() => {
        const doc = Api.GetDocument();
        const p = doc.GetCurrentParagraph();
        const run = Api.CreateRun();
        if (!p || !run) return;
        p.SetStyle("Normal");
        p.AddElement(run, 0);
        run.MoveCursorToPos(0);
      });
      this.isStarted = true;
    }

    if (!this.isStreaming) {
      this.tail += mdValue;
      if (isFinal) {
        await this.onStreamEnd();
        this.isStarted = false;
      }
      return;
    }

    const checkValue = this.tail + mdValue;
    const cutPoint = MarkDownStreamer.findStableCutPoint(checkValue);

    if (cutPoint >= 0) {
      await this.onStable(checkValue.slice(0, cutPoint + 1));
      await this.onTail(checkValue.slice(cutPoint + 1));
    } else {
      await this.onTail(checkValue);
    }

    if (isFinal) {
      await this.onStreamEnd();
      this.isStarted = false;
    }
  }

  private async checkUndo(): Promise<void> {
    if (this.tail === "") return;
    await editor.callMethod("EndAction", ["GroupActions", "", "cancel"]);
    this.tail = "";
  }

  private async onStreamEnd(): Promise<void> {
    if (!this.isStarted) return;

    if (this.tail !== "") {
      if (!this.isStreaming) {
        await window.Asc.Library?.InsertAsMD(this.tail, this.msPlugins);
      } else {
        await editor.callMethod("EndAction", ["GroupActions"]);
      }
    }

    await editor.callMethod("EndAction", ["GroupActions"]);
  }

  private async onStable(mdValue: string): Promise<void> {
    if (mdValue === "") return;
    await this.checkUndo();
    await window.Asc.Library?.InsertAsMD(mdValue, this.msPlugins);
  }

  private async onTail(mdValue: string): Promise<void> {
    if (mdValue === "") return;
    await this.checkUndo();
    await editor.callMethod("StartAction", ["GroupActions"]);
    await window.Asc.Library?.InsertAsMD(mdValue, this.msPlugins);
    this.tail = mdValue;
  }

  /** Finds the last position where the markdown can be safely split without
   *  breaking a block (code, LaTeX, table). Returns -1 if no safe point exists. */
  private static findStableCutPoint(markdown: string): number {
    type BlockDef = {
      start?: string;
      end?: string;
      multiline?: boolean;
      lineStart?: string;
      needsEmpty?: boolean;
    };
    const BLOCK_TYPES: Record<string, BlockDef> = {
      CODE: { start: "```", end: "```", multiline: true },
      LATEX: { start: "$$", end: "$$", multiline: true },
      TABLE: { lineStart: "|", needsEmpty: true },
    };

    let lastSafePoint = -1;
    let currentLine = "";
    let activeBlock: { type: string; blockDef: BlockDef } | null = null;

    for (let i = 0, len = markdown.length; i < len; i++) {
      const char = markdown[i];

      if (char === "\n") {
        const trimmed = currentLine.trim();

        if (activeBlock) {
          const def = activeBlock.blockDef;
          if (def.multiline && def.end) {
            if (trimmed.startsWith(def.end)) {
              activeBlock = null;
              const nextChar = markdown[i + 1];
              if (nextChar === "\n" || nextChar === undefined) {
                lastSafePoint = i;
              }
            }
          } else if (def.lineStart) {
            const matches = trimmed.startsWith(def.lineStart);
            if (!matches) {
              activeBlock = null;
              if (def.needsEmpty && !trimmed) {
                lastSafePoint = i;
              }
            }
          }
        } else {
          for (const btKey of Object.keys(BLOCK_TYPES)) {
            const bt = BLOCK_TYPES[btKey];
            if (bt.multiline && bt.start && trimmed.startsWith(bt.start)) {
              activeBlock = { type: btKey, blockDef: bt };
              break;
            }
          }
          if (!activeBlock && !trimmed) {
            lastSafePoint = i;
          }
        }

        currentLine = "";
      } else {
        currentLine += char;
      }
    }
    return lastSafePoint;
  }
}
