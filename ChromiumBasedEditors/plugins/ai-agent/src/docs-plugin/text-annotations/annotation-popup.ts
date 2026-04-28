import { editor } from "../library/editor";

export interface PopupInfo {
  suggested: string;
  original: string;
  explanation?: string;
}

export class TextAnnotationPopup {
  private popup: AscPluginWindow | null = null;
  private type = -1;
  private paraId: string | null = null;
  private rangeId: number | null = null;
  private width = 318;
  private height = 500;
  private content = "";

  onAcceptCallback: (() => Promise<void>) | null = null;
  onRejectCallback: (() => Promise<void>) | null = null;

  get currentWindowId(): number | null {
    return this.popup?.id ?? null;
  }

  open(
    type: number,
    paraId: string,
    rangeId: number,
    data: PopupInfo
  ): AscPluginWindow | null {
    if (this.popup && this.type === 0 && type === 1) return null;

    this._calculateWindowSize(type, data);
    return this._open(type, paraId, rangeId);
  }

  private _open(
    type: number,
    paraId: string,
    rangeId: number
  ): AscPluginWindow | null {
    if (
      this.type === type &&
      rangeId === this.rangeId &&
      paraId === this.paraId
    ) {
      return this.popup;
    }

    this.type = type;
    this.paraId = paraId;
    this.rangeId = rangeId;

    if (this.popup) {
      window.Asc.plugin.executeMethod("CloseWindow", [this.popup.id]);
      this.popup = null;
    }

    const popup = new window.Asc.PluginWindow();
    const title =
      type === 0
        ? "Hint"
        : type === 2
          ? "Suggested replacement"
          : "Grammar suggestion";

    popup.attachEvent("onWindowReady", () => {
      const theme = window.Asc.plugin.info?.theme;
      popup.command(
        "onUpdateContent",
        JSON.stringify({ content: this.content, theme })
      );
    });

    const buttons =
      type === 0
        ? [{ text: "OK", primary: true }]
        : [
            { text: "Accept", primary: true },
            { text: "Reject", primary: false },
          ];

    popup.show({
      url: "annotation-popup.html",
      isVisual: true,
      buttons,
      isModal: false,
      description: title,
      EditorsSupport: ["word"],
      size: [this.width, this.height],
      fixedSize: true,
      isTargeted: true,
    });

    this.popup = popup;
    return popup;
  }

  close(type?: number): void {
    if (type !== undefined && this.type !== type) return;
    if (!this.popup) return;

    const id = this.popup.id;
    this._reset();
    window.Asc.plugin.executeMethod("CloseWindow", [id]);
    void editor.callMethod("FocusEditor");
  }

  reset(): void {
    if (!this.popup) return;
    this._reset();
    void editor.callMethod("FocusEditor");
  }

  private _reset(): void {
    this.type = -1;
    this.rangeId = null;
    this.paraId = null;
    this.onAcceptCallback = null;
    this.onRejectCallback = null;
    this.popup = null;
  }

  private _calculateWindowSize(type: number, data: PopupInfo): void {
    const theme = window.Asc.plugin.info?.theme;
    const backColor = theme?.["background-normal"] ?? "#FFFFFF";
    const textColor = theme?.["text-normal"] ?? "#3D3D3D";
    const borderColor = theme?.["border-divider"] ?? "#666666";
    const ballonColor = theme?.["canvas-background"] ?? "#F5F5F5";

    this.content = `<div class="back-color text-color" style="background:${backColor}; overflow:hidden; max-width:320px; min-width:280px;color:${textColor}; user-select:none;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="padding:16px 16px 0px 16px;">`;

    if (type !== 0) {
      this.content += `
    <div style="margin-bottom:12px;">
      <div class="text-color" style="font-size:11px; font-weight:700; color:${textColor}; margin-bottom:6px;">
        Suggested correction
      </div>
      <div class="ballon-color text-color border-color" style="font-size:12px; color:${textColor}; line-height:1.5; background:${ballonColor}; border:1px solid ${borderColor}; border-radius:3px; padding:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="original text-color" style="color:${textColor}; font-weight:normal;">${data.original}</span>
          <span class="text-color" style="color:${textColor}; font-weight:bold;">→</span>
          <span class="corrected text-color" style="color:${textColor}; font-weight:normal;">${data.suggested}</span>
        </div>
      </div>
    </div>`;
    }

    if (data.explanation) {
      this.content += `<div style="margin-bottom:16px;">
      <div class="text-color" style="font-size:11px; font-weight:700; color:${textColor}; margin-bottom:6px;">
        ${type === 0 ? "Hint" : "Explanation"}
      </div>
      <div class="ballon-color text-color border-color" style="font-size:12px; color:${textColor}; line-height:1.5; background:${ballonColor}; border:1px solid ${borderColor}; border-radius:3px; padding:10px;">${data.explanation}</div>
    </div>`;
    }

    this.content += "</div></div>";

    const measureDiv = document.createElement("div");
    measureDiv.style.position = "absolute";
    measureDiv.style.left = "-9999px";
    measureDiv.style.top = "-9999px";
    measureDiv.style.width = `${this.width}px`;
    measureDiv.style.visibility = "hidden";
    measureDiv.style.pointerEvents = "none";
    measureDiv.style.opacity = "0";
    measureDiv.style.margin = "0";
    measureDiv.style.padding = "0";
    measureDiv.innerHTML = this.content;

    document.body.appendChild(measureDiv);
    this.height = measureDiv.scrollHeight;
    document.body.removeChild(measureDiv);
  }
}
