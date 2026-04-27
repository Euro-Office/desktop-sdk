import type { ActionType } from "@onlyoffice/ai-chat";
import { editor } from "../../../library/editor";
import { getAiBlockLabel } from "../../lib/aiActions";
import { getLayoutSpec, normalizeLayoutName, normalizePhType } from "./layouts";

const GROUP_LABEL = "AI: Build presentation";

interface ChartCtx {
  // biome-ignore lint/suspicious/noExplicitAny: passed through Asc.scope
  ph: any;
  type: string;
  title: string;
  x: string;
  y: string;
  categories: string[];
  series: Array<[string, number[]]>;
}

interface ImageJob {
  drawingId: string;
  prompt: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ThemeState {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic theme keys
  colors: Record<string, any>;
  fonts: { major: string; minor: string };
  // biome-ignore lint/suspicious/noExplicitAny: dynamic decor entries
  decor?: Record<string, any[]>;
}

export class Executor {
  private chatAction: ActionType;
  private imageAction: ActionType;

  private presentationCreated = false;
  private currentSlideIndex: number | null = null;
  private currentLayout: string | null = null;
  private hasAnySlide = false;
  private docContentId: string | null = null;
  private paraId: string | null = null;
  private tableId: string | null = null;
  private chartCtx: ChartCtx | null = null;
  private theme: ThemeState | null = {
    colors: {},
    fonts: { major: "Arial", minor: "Arial" },
  };
  private imageQueue: ImageJob[] = [];
  private imageBusy = false;
  private pendingPictureDrawingId: string | null = null;
  private language: string | null = null;
  private masterId: string | null = null;

  /** Has presentation.end been received? Used by tool entry to know if we should clean up GroupActions. */
  presentationEndReached = false;

  /** Block-action ended once. */
  private blockEnded = false;
  /** Block-action started once. */
  private blockStarted = false;
  /** GroupActions ended once. */
  private groupEnded = false;

  constructor(chatAction: ActionType, imageAction: ActionType) {
    this.chatAction = chatAction;
    this.imageAction = imageAction;
  }

  /** Idempotent — ends the user-visible "AI is thinking" Block action. */
  async checkEndAction(): Promise<void> {
    if (this.blockEnded) return;
    this.blockEnded = true;
    await editor.callMethod("EndAction", [
      "Block",
      getAiBlockLabel(this.chatAction),
    ]);
  }

  async startBlock(): Promise<void> {
    if (this.blockStarted) return;
    this.blockStarted = true;
    await editor.callMethod("StartAction", [
      "Block",
      getAiBlockLabel(this.chatAction),
    ]);
  }

  async endGroupActionsOnce(): Promise<void> {
    if (this.groupEnded) return;
    this.groupEnded = true;
    await editor.callMethod("EndAction", ["GroupActions", GROUP_LABEL]);
  }

  private inSlide(): boolean {
    return (
      this.currentSlideIndex !== null && this.currentSlideIndex !== undefined
    );
  }

  private requireInSlide(): boolean {
    return this.inSlide();
  }

  private themeAllowed(): boolean {
    return !this.hasAnySlide;
  }

  private validatePlaceholder(
    ph_type: string,
    ph_idx: number,
    role: "figure" | "picture" | "table" | "chart"
  ): boolean {
    const layout = this.currentLayout;
    if (!layout) return true;
    const spec = getLayoutSpec(layout);
    if (!spec) return true;
    const t = normalizePhType(ph_type);
    const i = Number(ph_idx || 0);
    const isContentRole =
      role === "figure" ||
      role === "picture" ||
      role === "table" ||
      role === "chart";
    return spec.some((p) => {
      const isService =
        p.ph_type === "dt" || p.ph_type === "ftr" || p.ph_type === "sldNum";
      if (isContentRole && isService) return false;
      const isTitle =
        p.ph_type === "title" ||
        p.ph_type === "ctrTitle" ||
        p.ph_type === "subTitle";
      if (isTitle && role !== "figure") return false;
      const typeMatch =
        p.ph_type === t ||
        (p.ph_type === "body" && (t === "body" || t === "" || t === "unknown"));
      const idxMatch = p.ph_idx === i;
      return typeMatch && idxMatch;
    });
  }

  private async findDrawingByPlaceholder(
    slideIndex: number,
    ph_type: string,
    ph_idx: number
  ): Promise<string | null> {
    Asc.scope._slideIndex = slideIndex;
    Asc.scope._ph_type = normalizePhType(ph_type);
    Asc.scope._ph_idx = Number(ph_idx || 0);
    const drawingId = await editor.callCommand<string | null>(() => {
      const pres = Api.GetPresentation();
      const slide = pres.GetSlideByIndex(Asc.scope._slideIndex);
      if (!slide) return null;
      const drawings = slide.GetAllDrawings();
      // biome-ignore lint/suspicious/noExplicitAny: editor API drawing
      for (const d of drawings as any[]) {
        const ph = d.GetPlaceholder();
        if (!ph) continue;
        const type = ph.GetType();
        const typeOk =
          type === Asc.scope._ph_type ||
          (type === "unknown" && Asc.scope._ph_type === "body") ||
          (type === "ctrTitle" && Asc.scope._ph_type === "title");
        if (!typeOk) continue;
        const phIdx = parseInt(ph.GetIndex() || "0", 10);
        const want = parseInt(Asc.scope._ph_idx || 0, 10);
        const match = phIdx === want || (!ph.GetIndex() && want === 0);
        if (match) return d.GetInternalId();
      }
      return null;
    });
    Asc.scope._slideIndex = null;
    Asc.scope._ph_type = null;
    Asc.scope._ph_idx = null;
    return drawingId;
  }

  private async bindDocContentFromDrawingId(
    drawingId: string
  ): Promise<boolean> {
    Asc.scope._drawId = drawingId;
    const ids = await editor.callCommand<{
      docContentId: string;
      paraId: string;
    } | null>(() => {
      const drawing = Api.GetByInternalId(Asc.scope._drawId);
      if (!drawing) return null;
      const dc = drawing.GetDocContent ? drawing.GetDocContent() : null;
      if (!dc) return null;
      if (dc.GetElementsCount() > 0) {
        const p = dc.GetElement(0);
        return { docContentId: dc.GetInternalId(), paraId: p.GetInternalId() };
      }
      const p = Api.CreateParagraph();
      dc.Push(p);
      return { docContentId: dc.GetInternalId(), paraId: p.GetInternalId() };
    });
    Asc.scope._drawId = null;
    if (ids) {
      this.docContentId = ids.docContentId;
      this.paraId = ids.paraId;
    }
    return !!ids;
  }

  private async newParagraphIfNeeded(): Promise<void> {
    if (this.docContentId && !this.paraId) {
      Asc.scope._dcId = this.docContentId;
      this.paraId = await editor.callCommand<string | null>(() => {
        const dc = Api.GetByInternalId(Asc.scope._dcId);
        if (!dc) return null;
        const p = Api.CreateParagraph();
        dc.Push(p);
        return p.GetInternalId();
      });
      Asc.scope._dcId = null;
    }
  }

  // ─── Top-level lifecycle ──────────────────────────────────────────────

  async presentationStart(language: string | undefined): Promise<void> {
    this.language = language ?? null;
  }

  async presentationEnd(): Promise<void> {
    this.presentationEndReached = true;
    await this.drainImages();
  }

  // ─── Theme ────────────────────────────────────────────────────────────

  async themeStart(): Promise<void> {
    if (!this.themeAllowed()) return;
    this.theme = {
      colors: {},
      fonts: { major: "Arial", minor: "Arial" },
    };
  }

  async themeColors(colors: Record<string, string>): Promise<void> {
    if (!this.themeAllowed() || !this.theme) return;
    const keys = [
      "dk1",
      "lt1",
      "dk2",
      "lt2",
      "accent1",
      "accent2",
      "accent3",
      "accent4",
      "accent5",
      "accent6",
      "hlink",
      "folHlink",
    ];
    for (const k of keys) {
      if (colors[k]) this.theme.colors[k] = colors[k];
    }
  }

  async themeFonts(major: string, minor: string): Promise<void> {
    if (!this.themeAllowed() || !this.theme) return;
    this.theme.fonts = { major, minor };
  }

  async themeDecorStart(): Promise<void> {
    if (!this.themeAllowed() || !this.theme) return;
    this.theme.decor = {};
  }

  async themeDecorEnd(): Promise<void> {
    /* nothing */
  }

  async layoutDecor(decor: {
    layoutType: string;
    fill: string;
    opacity: number;
    d: string;
  }): Promise<void> {
    if (!this.theme?.decor) return;
    if (!this.theme.decor[decor.layoutType]) {
      this.theme.decor[decor.layoutType] = [];
    }
    this.theme.decor[decor.layoutType].push(decor);
  }

  async themeEnd(): Promise<void> {
    /* nothing — block action ended by dispatcher */
  }

  // ─── Slides ───────────────────────────────────────────────────────────

  async slideStart(layoutRaw: string): Promise<void> {
    if (this.inSlide()) await this.slideEnd();
    this.hasAnySlide = true;
    this.currentLayout = normalizeLayoutName(layoutRaw);
    Asc.scope._layout = this.currentLayout;

    if (!this.presentationCreated && this.theme) {
      Asc.scope._theme = {
        colors: this.theme.colors,
        fonts: this.theme.fonts,
        decor: this.theme.decor,
      };
      Asc.scope.language = this.language;

      const data = await editor.callCommand<{
        curSlideIdx: number;
        masterId: string;
      }>(() => {
        const pres = Api.GetPresentation();
        pres.SetLanguage(Asc.scope.language);
        for (let i = pres.GetSlidesCount() - 1; i >= 0; i--) {
          pres.GetSlideByIndex(i).Delete();
        }
        const master = Api.CreateDefaultMasterSlide();
        pres.AddMaster(master);
        const theme = master.GetTheme();
        const fs = theme.GetFontScheme();
        const fonts = Asc.scope._theme.fonts;
        fs.SetFonts(
          fonts.major,
          fonts.major,
          fonts.major,
          fonts.minor,
          fonts.minor,
          fonts.minor
        );
        const colors = Asc.scope._theme.colors;
        const map: Record<string, number> = {
          dk1: 6,
          lt1: 10,
          dk2: 7,
          lt2: 11,
          accent1: 0,
          accent2: 1,
          accent3: 2,
          accent4: 3,
          accent5: 4,
          accent6: 5,
          hlink: 9,
          folHlink: 8,
        };

        function hexToRGB(hex: string): [number, number, number] {
          const n = parseInt(hex.slice(1), 16);
          return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }

        const pW = pres.GetWidth();
        const pH = pres.GetHeight();

        const colorScheme = theme.GetColorScheme();
        Object.keys(colors).forEach((colorKey: string) => {
          if (Object.hasOwn(map, colorKey)) {
            const rgb = hexToRGB(colors[colorKey]);
            const idx = map[colorKey];
            const newColor = Api.CreateRGBColor(rgb[0], rgb[1], rgb[2]);
            colorScheme.ChangeColor(idx, newColor);
          }
        });

        const lay =
          master.GetLayoutByType(Asc.scope._layout) || master.GetLayout(0);
        const slide = Api.CreateSlide();
        if (lay) slide.ApplyLayout(lay);
        pres.AddSlide(slide);

        const decor = Asc.scope._theme.decor;
        if (decor) {
          for (const ltType in decor) {
            const layout = master.GetLayoutByType(ltType);
            if (!layout) continue;
            const decoObjects = decor[ltType];
            if (!decoObjects) continue;
            for (let sp = 0; sp < decoObjects.length; ++sp) {
              const decoObject = decoObjects[sp];
              const svgPathString: string = decoObject.d;
              const tokens = svgPathString.split(" ");

              interface PathCmd {
                op: string;
                x?: number;
                y?: number;
                x1?: number;
                y1?: number;
                x2?: number;
                y2?: number;
              }
              const aPathCommands: PathCmd[] = [];
              let cmdIdx = 0;
              while (cmdIdx < tokens.length) {
                const type = tokens[cmdIdx];
                if (type === "M") {
                  const x = parseFloat(tokens[++cmdIdx]);
                  const y = parseFloat(tokens[++cmdIdx]);
                  if (!Number.isNaN(x) && !Number.isNaN(y)) {
                    aPathCommands.push({ op: "M", x, y });
                  } else {
                    aPathCommands.length = 0;
                    break;
                  }
                } else if (type === "C") {
                  const x1 = parseFloat(tokens[++cmdIdx]);
                  const y1 = parseFloat(tokens[++cmdIdx]);
                  const x2 = parseFloat(tokens[++cmdIdx]);
                  const y2 = parseFloat(tokens[++cmdIdx]);
                  const x = parseFloat(tokens[++cmdIdx]);
                  const y = parseFloat(tokens[++cmdIdx]);
                  if (
                    !Number.isNaN(x) &&
                    !Number.isNaN(y) &&
                    !Number.isNaN(x1) &&
                    !Number.isNaN(y1) &&
                    !Number.isNaN(x2) &&
                    !Number.isNaN(y2)
                  ) {
                    aPathCommands.push({ op: "C", x1, y1, x2, y2, x, y });
                  } else {
                    aPathCommands.length = 0;
                    break;
                  }
                } else if (type === "L") {
                  const x = parseFloat(tokens[++cmdIdx]);
                  const y = parseFloat(tokens[++cmdIdx]);
                  if (!Number.isNaN(x) && !Number.isNaN(y)) {
                    aPathCommands.push({ op: "L", x, y });
                  } else {
                    aPathCommands.length = 0;
                    break;
                  }
                } else if (type === "Z") {
                  aPathCommands.push({ op: "Z" });
                } else {
                  aPathCommands.length = 0;
                  break;
                }
                if (aPathCommands.length > 0) ++cmdIdx;
              }

              if (aPathCommands.length > 0) {
                const fill = Api.CreateSolidFill(
                  Api.CreateSchemeColor(decoObject.fill)
                );
                const stroke = Api.CreateStroke(0, Api.CreateNoFill());
                const shape = Api.CreateShape("rect", pW, pH, fill, stroke);
                const customGeometry = Api.CreateCustomGeometry();
                const path = customGeometry.AddPath();
                const scale = 100000;
                path.SetWidth(scale);
                path.SetHeight(scale);
                path.SetStroke(false);
                for (let ci = 0; ci < aPathCommands.length; ++ci) {
                  const c = aPathCommands[ci];
                  switch (c.op) {
                    case "M":
                      path.MoveTo(
                        (c.x as number) * scale,
                        (c.y as number) * scale
                      );
                      break;
                    case "C":
                      path.CubicBezTo(
                        (c.x1 as number) * scale,
                        (c.y1 as number) * scale,
                        (c.x2 as number) * scale,
                        (c.y2 as number) * scale,
                        (c.x as number) * scale,
                        (c.y as number) * scale
                      );
                      break;
                    case "L":
                      path.LineTo(
                        (c.x as number) * scale,
                        (c.y as number) * scale
                      );
                      break;
                    case "Z":
                      path.Close();
                      break;
                  }
                }
                shape.SetGeometry(customGeometry);
                shape.SetPosition(0, 0);
                layout.AddObject(shape);
              }
            }
          }
        }

        const notesPage = slide.GetNotesPage();
        if (notesPage) {
          const notesTheme = notesPage.GetTheme();
          if (notesTheme) {
            const notesFS = notesTheme.GetFontScheme();
            notesFS.SetFonts(
              fonts.major,
              fonts.major,
              fonts.major,
              fonts.minor,
              fonts.minor,
              fonts.minor
            );
          }
        }
        return {
          curSlideIdx: pres.GetSlidesCount() - 1,
          masterId: master.GetInternalId(),
        };
      });

      this.currentSlideIndex = data.curSlideIdx;
      this.masterId = data.masterId;
      Asc.scope.masterId = data.masterId;
      this.theme = null;
      Asc.scope._theme = null;
      Asc.scope.language = null;
      this.presentationCreated = true;
    } else {
      Asc.scope.masterId = this.masterId;
      this.currentSlideIndex = await editor.callCommand<number>(() => {
        const pres = Api.GetPresentation();
        const master = Api.GetByInternalId(Asc.scope.masterId);
        const lay =
          master.GetLayoutByType(Asc.scope._layout) || master.GetLayout(0);
        const slide = Api.CreateSlide();
        if (lay) slide.ApplyLayout(lay);
        pres.AddSlide(slide);
        return pres.GetSlidesCount() - 1;
      });
    }
    this.docContentId = null;
    this.paraId = null;
    this.tableId = null;
    this.chartCtx = null;
    this.pendingPictureDrawingId = null;
    Asc.scope._layout = null;
  }

  async slideEnd(): Promise<void> {
    if (!this.inSlide()) return;
    this.currentSlideIndex = null;
    this.currentLayout = null;
    this.docContentId = null;
    this.paraId = null;
    this.tableId = null;
    this.chartCtx = null;
    this.pendingPictureDrawingId = null;
  }

  // ─── Figures (text placeholders) ──────────────────────────────────────

  async figureStart(ph: { ph_type: string; ph_idx: number }): Promise<void> {
    if (!this.requireInSlide()) return;
    if (!this.validatePlaceholder(ph.ph_type, ph.ph_idx, "figure")) return;
    const drawingId = await this.findDrawingByPlaceholder(
      this.currentSlideIndex as number,
      ph.ph_type,
      ph.ph_idx
    );
    if (!drawingId) return;
    await this.bindDocContentFromDrawingId(drawingId);
  }

  async figureEnd(): Promise<void> {
    if (!this.requireInSlide()) return;
    this.docContentId = null;
    this.paraId = null;
  }

  async para(text: string): Promise<void> {
    if (!this.requireInSlide()) return;
    if (!this.docContentId) return;
    await this.newParagraphIfNeeded();
    Asc.scope._pid = this.paraId;
    Asc.scope._dcId = this.docContentId;
    Asc.scope._text = text || "";
    await editor.callCommand(() => {
      let p = Api.GetByInternalId(Asc.scope._pid);
      if (!p) {
        const dc = Api.GetByInternalId(Asc.scope._dcId);
        p = Api.CreateParagraph();
        dc.Push(p);
      }
      p.AddText(Asc.scope._text);
    });
    this.paraId = null;
    Asc.scope._pid = null;
    Asc.scope._dcId = null;
    Asc.scope._text = null;
  }

  // ─── Pictures ─────────────────────────────────────────────────────────

  async pictureStart(ph: { ph_type?: string; ph_idx?: number }): Promise<void> {
    if (!this.requireInSlide()) return;
    const ph_type = normalizePhType(ph.ph_type || "picture");
    if (!this.validatePlaceholder(ph_type, ph.ph_idx || 0, "picture")) return;
    await this.checkEndAction();
    const drawingId = await this.findDrawingByPlaceholder(
      this.currentSlideIndex as number,
      ph_type,
      ph.ph_idx || 0
    );
    this.pendingPictureDrawingId = drawingId || null;
  }

  async pictureDesc(prompt: string): Promise<void> {
    if (!this.requireInSlide()) return;
    if (!this.pendingPictureDrawingId) return;
    if (!prompt) return;
    Asc.scope._drawId = this.pendingPictureDrawingId;
    this.pendingPictureDrawingId = null;
    await this.checkEndAction();
    const placeholderData = await editor.callCommand<{
      x: number;
      y: number;
      width: number;
      height: number;
      drawingId: string;
    } | null>(() => {
      const imagePlaceholder = Api.GetByInternalId(Asc.scope._drawId);
      if (!imagePlaceholder) return null;
      return {
        x: imagePlaceholder.GetPosX(),
        y: imagePlaceholder.GetPosY(),
        width: imagePlaceholder.GetWidth(),
        height: imagePlaceholder.GetHeight(),
        drawingId: Asc.scope._drawId,
      };
    });
    if (placeholderData) {
      this.imageQueue.push({ ...placeholderData, prompt });
    }
  }

  async pictureEnd(): Promise<void> {
    if (!this.requireInSlide()) return;
  }

  private async loadImage(url: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.src = url;
    if (img.complete && img.naturalWidth) return img;
    if (img.decode) {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
      });
    }
    return img;
  }

  private async drainImages(): Promise<void> {
    if (this.imageBusy) return;
    const job = this.imageQueue.shift();
    if (!job) {
      await this.endGroupActionsOnce();
      return;
    }
    this.imageBusy = true;
    try {
      const win = window as unknown as {
        AI?: {
          ActionType: { ImageGeneration: string };
          Request: {
            create: (a: string) => {
              imageGenerationRequest: (p: string) => Promise<string>;
            } | null;
          };
        };
      };
      const imageEngine = win.AI?.Request.create(this.imageAction);
      if (!imageEngine) {
        await this.endGroupActionsOnce();
        return;
      }
      Asc.scope._drawId = job.drawingId;
      await this.checkEndAction();
      await editor.callCommand(() => {
        const d = Api.GetByInternalId(Asc.scope._drawId);
        if (d) d.Select();
      });
      const url = await imageEngine.imageGenerationRequest(job.prompt);
      if (url) {
        const img = await this.loadImage(url);
        Asc.scope._url = url;
        Asc.scope._drawId = job.drawingId;
        const scaleW = img.naturalWidth / job.width;
        const scaleH = img.naturalHeight / job.height;
        if (scaleW > scaleH) {
          Asc.scope.phW = job.width;
          Asc.scope.phH = ((img.naturalHeight / scaleW + 0.5) >> 0) as number;
        } else {
          Asc.scope.phH = job.height;
          Asc.scope.phW = ((img.naturalWidth / scaleH + 0.5) >> 0) as number;
        }
        Asc.scope.phX = ((job.x + job.width / 2 - Asc.scope.phW / 2 + 0.5) >>
          0) as number;
        Asc.scope.phY = ((job.y + job.height / 2 - Asc.scope.phH / 2 + 0.5) >>
          0) as number;
        await this.checkEndAction();
        await editor.callCommand(() => {
          const newImg = Api.CreateImage(
            Asc.scope._url,
            Asc.scope.phW,
            Asc.scope.phH
          );
          const d = Api.GetByInternalId(Asc.scope._drawId);
          if (d) {
            if (d.ReplacePlaceholder(newImg)) {
              newImg.SetPosX(Asc.scope.phX);
              newImg.SetPosY(Asc.scope.phY);
              newImg.SetSize(Asc.scope.phW, Asc.scope.phH);
            }
          }
        });
        Asc.scope._url = null;
        Asc.scope._drawId = null;
        Asc.scope.phH = null;
        Asc.scope.phW = null;
        Asc.scope.phX = null;
        Asc.scope.phY = null;
      }
    } catch {
      /* ignore image errors */
    }

    this.imageBusy = false;
    setTimeout(() => {
      this.drainImages();
    }, 1000);
  }

  // ─── Tables ───────────────────────────────────────────────────────────

  async tableStart(ph: {
    ph_type: string;
    ph_idx: number;
    rows?: number;
    cols?: number;
  }): Promise<void> {
    if (!this.requireInSlide()) return;
    if (!this.validatePlaceholder(ph.ph_type, ph.ph_idx, "table")) return;
    Asc.scope._slideIndex = this.currentSlideIndex;
    Asc.scope._ph_type = ph.ph_type;
    Asc.scope._ph_idx = ph.ph_idx;
    Asc.scope._rows = Number(ph.rows || 0);
    Asc.scope._cols = Number(ph.cols || 0);
    this.tableId = await editor.callCommand<string | null>(() => {
      const pres = Api.GetPresentation();
      const slide = pres.GetSlideByIndex(Asc.scope._slideIndex);
      if (!slide) return null;
      const drawings = slide.GetAllDrawings();
      // biome-ignore lint/suspicious/noExplicitAny: editor API drawing
      for (const d of drawings as any[]) {
        const phObj = d.GetPlaceholder();
        if (!phObj) continue;
        const typeOk =
          phObj.GetType() === "body" || phObj.GetType() === "unknown";
        const want = parseInt(Asc.scope._ph_idx || 0, 10);
        const phIdx = parseInt(phObj.GetIndex() || "0", 10);
        const match =
          typeOk && (phIdx === want || (!phObj.GetIndex() && want === 0));
        if (match) {
          const tbl = Api.CreateTable(Asc.scope._cols, Asc.scope._rows);
          d.ReplacePlaceholder(tbl);
          return tbl.GetInternalId();
        }
      }
      return null;
    });
    Asc.scope._slideIndex = null;
    Asc.scope._rows = null;
    Asc.scope._cols = null;
  }

  async cellStart(row: number, col: number): Promise<void> {
    if (!this.requireInSlide() || !this.tableId) return;
    Asc.scope._tid = this.tableId;
    Asc.scope._row = Number(row || 0);
    Asc.scope._col = Number(col || 0);
    const ids = await editor.callCommand<{
      docContentId: string;
      paraId: string;
    } | null>(() => {
      const tbl = Api.GetByInternalId(Asc.scope._tid);
      if (!tbl) return null;
      const r = tbl.GetRow(Asc.scope._row);
      if (!r) return null;
      const c = r.GetCell(Asc.scope._col);
      if (!c) return null;
      const dc = c.GetContent();
      if (!dc) return null;
      if (dc.GetElementsCount() > 0) {
        const p = dc.GetElement(0);
        return { docContentId: dc.GetInternalId(), paraId: p.GetInternalId() };
      }
      const p = Api.CreateParagraph();
      dc.Push(p);
      return { docContentId: dc.GetInternalId(), paraId: p.GetInternalId() };
    });
    Asc.scope._tid = null;
    Asc.scope._row = null;
    Asc.scope._col = null;
    if (ids) {
      this.docContentId = ids.docContentId;
      this.paraId = ids.paraId;
    }
  }

  async cellEnd(): Promise<void> {
    if (!this.requireInSlide()) return;
    this.docContentId = null;
    this.paraId = null;
  }

  async tableEnd(): Promise<void> {
    if (!this.requireInSlide()) return;
    this.tableId = null;
  }

  // ─── Charts ───────────────────────────────────────────────────────────

  async chartStart(ph: {
    ph_type: string;
    ph_idx: number;
    chartType?: string;
  }): Promise<void> {
    if (!this.requireInSlide()) return;
    if (!this.validatePlaceholder(ph.ph_type, ph.ph_idx, "chart")) return;
    this.chartCtx = {
      ph,
      type: ph.chartType || "bar3D",
      title: "",
      x: "",
      y: "",
      categories: [],
      series: [],
    };
  }

  async chartTitle(text: string): Promise<void> {
    if (this.chartCtx) this.chartCtx.title = text || "";
  }

  async chartAxes(x: string, y: string): Promise<void> {
    if (this.chartCtx) {
      this.chartCtx.x = x || "";
      this.chartCtx.y = y || "";
    }
  }

  async chartCategories(items: unknown): Promise<void> {
    if (this.chartCtx) {
      this.chartCtx.categories = Array.isArray(items)
        ? (items as string[])
        : [];
    }
  }

  async chartSeries(name: string, values: unknown): Promise<void> {
    if (this.chartCtx) {
      const numbers = Array.isArray(values)
        ? (values as unknown[]).map(Number)
        : [];
      this.chartCtx.series.push([name || "", numbers]);
    }
  }

  async chartEnd(): Promise<void> {
    if (!this.requireInSlide()) return;
    const ctx = this.chartCtx;
    if (!ctx) return;
    Asc.scope._slideIndex = this.currentSlideIndex;
    Asc.scope._ph_idx = ctx.ph.ph_idx;
    Asc.scope._ph_type = ctx.ph.ph_type;
    Asc.scope._ctx = ctx;
    await editor.callCommand(() => {
      const pres = Api.GetPresentation();
      const slide = pres.GetSlideByIndex(Asc.scope._slideIndex);
      if (!slide) return;
      const drawings = slide.GetAllDrawings();
      // biome-ignore lint/suspicious/noExplicitAny: editor API drawing
      for (const d of drawings as any[]) {
        const phObj = d.GetPlaceholder();
        if (!phObj) continue;
        const typeOk =
          phObj.GetType() === "body" || phObj.GetType() === "unknown";
        const want = parseInt(Asc.scope._ph_idx || 0, 10);
        const phIdx = parseInt(phObj.GetIndex() || "0", 10);
        const match =
          typeOk && (phIdx === want || (!phObj.GetIndex() && want === 0));
        if (match) {
          const values = Asc.scope._ctx.series.map(
            // biome-ignore lint/suspicious/noExplicitAny: tuple
            (s: any) => s[1]
          );
          const names = Asc.scope._ctx.series.map(
            // biome-ignore lint/suspicious/noExplicitAny: tuple
            (s: any) => s[0]
          );
          const chart = Api.CreateChart(
            Asc.scope._ctx.type,
            values,
            names,
            Asc.scope._ctx.categories || []
          );
          if (Asc.scope._ctx.title) chart.SetTitle(Asc.scope._ctx.title);
          d.ReplacePlaceholder(chart);
          break;
        }
      }
    });
    this.chartCtx = null;
    Asc.scope._slideIndex = null;
    Asc.scope._ctx = null;
  }

  // ─── Notes ────────────────────────────────────────────────────────────

  async notesStart(): Promise<void> {
    if (!this.requireInSlide()) return;
    Asc.scope._slideIndex = this.currentSlideIndex;
    const ids = await editor.callCommand<{
      docContentId: string;
      paraId: string;
    } | null>(() => {
      const pres = Api.GetPresentation();
      const slide = pres.GetSlideByIndex(Asc.scope._slideIndex);
      if (!slide) return null;
      const notes = slide.GetNotesPage();
      if (!notes) return null;
      const body = notes.GetBodyShape();
      if (!body) return null;
      const dc = body.GetDocContent();
      if (!dc) return null;
      if (dc.GetElementsCount() > 0) {
        const p = dc.GetElement(0);
        return { docContentId: dc.GetInternalId(), paraId: p.GetInternalId() };
      }
      const p = Api.CreateParagraph();
      dc.Push(p);
      return { docContentId: dc.GetInternalId(), paraId: p.GetInternalId() };
    });
    if (ids) {
      this.docContentId = ids.docContentId;
      this.paraId = ids.paraId;
    }
    Asc.scope._slideIndex = null;
  }

  async notesEnd(): Promise<void> {
    if (!this.requireInSlide()) return;
    this.docContentId = null;
    this.paraId = null;
  }

  // ─── Transitions / Animations ─────────────────────────────────────────

  async slideTransition(
    effect: string | undefined,
    speed: string | undefined,
    advanceOnClick: boolean | undefined
  ): Promise<void> {
    if (!this.requireInSlide()) return;
    Asc.scope._slideIndex = this.currentSlideIndex;
    Asc.scope._effect = effect || "effectFadeSmoothly";
    Asc.scope._speed = speed || "medium";
    Asc.scope._advanceOnClick = advanceOnClick !== false;
    await editor.callCommand(() => {
      const pres = Api.GetPresentation();
      const slide = pres.GetSlideByIndex(Asc.scope._slideIndex);
      if (!slide) return;
      const transition = Api.CreateSlideShowTransition();
      transition.SetEntryEffect(Asc.scope._effect);
      transition.SetSpeed(Asc.scope._speed);
      transition.SetAdvanceOnClick(Asc.scope._advanceOnClick);
      slide.SetSlideShowTransition(transition);
    });
    Asc.scope._slideIndex = null;
    Asc.scope._effect = null;
    Asc.scope._speed = null;
    Asc.scope._advanceOnClick = null;
  }

  async animation(
    ph_type: string,
    ph_idx: number,
    effectType: string | undefined,
    trigger: string | undefined,
    duration: number | undefined
  ): Promise<void> {
    if (!this.requireInSlide()) return;
    Asc.scope._slideIndex = this.currentSlideIndex;
    Asc.scope._ph_type = normalizePhType(ph_type);
    Asc.scope._ph_idx = Number(ph_idx || 0);
    Asc.scope._effectType = effectType || "fade";
    Asc.scope._trigger = trigger || "afterprevious";
    Asc.scope._duration = Number(duration) || 500;
    await editor.callCommand(() => {
      const pres = Api.GetPresentation();
      const slide = pres.GetSlideByIndex(Asc.scope._slideIndex);
      if (!slide) return;
      const drawings = slide.GetAllDrawings();
      // biome-ignore lint/suspicious/noExplicitAny: editor API drawing
      let targetDrawing: any = null;
      // biome-ignore lint/suspicious/noExplicitAny: editor API drawing
      for (const d of drawings as any[]) {
        const ph = d.GetPlaceholder();
        if (!ph) continue;
        const type = ph.GetType();
        const typeOk =
          type === Asc.scope._ph_type ||
          (type === "unknown" && Asc.scope._ph_type === "body") ||
          (type === "ctrTitle" && Asc.scope._ph_type === "title");
        if (!typeOk) continue;
        const phIdx = parseInt(ph.GetIndex() || "0", 10);
        const want = parseInt(Asc.scope._ph_idx || 0, 10);
        const match = phIdx === want || (!ph.GetIndex() && want === 0);
        if (match) {
          targetDrawing = d;
          break;
        }
      }
      if (!targetDrawing) return;
      const timeLine = slide.GetTimeLine();
      if (!timeLine) return;
      const seq = timeLine.GetMainSequence();
      if (!seq) return;
      const effect = seq.AddEffect(
        targetDrawing,
        Asc.scope._effectType,
        Asc.scope._trigger
      );
      if (effect && Asc.scope._duration) {
        effect.SetDuration(Asc.scope._duration);
      }
    });
    Asc.scope._slideIndex = null;
    Asc.scope._ph_type = null;
    Asc.scope._ph_idx = null;
    Asc.scope._effectType = null;
    Asc.scope._trigger = null;
    Asc.scope._duration = null;
  }
}
