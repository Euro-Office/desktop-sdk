import { editor } from "./editor";

type MarkdownPlugin = (md: object) => void;
interface MarkdownItInstance {
  use(plugin: MarkdownPlugin): MarkdownItInstance;
  render(content: string): string;
}

function decodeHtmlText(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

class AscLibrary {
  private version = 0;

  async GetEditorVersion(): Promise<number> {
    if (this.version !== 0) return this.version;

    let ver = await editor.callMethod<string>("GetVersion");
    if (ver === "develop") ver = "99.99.99";

    const parts = ver.split(".");
    while (parts.length < 3) parts.push("0");

    this.version =
      1_000_000 * parseInt(parts[0], 10) +
      1_000 * parseInt(parts[1], 10) +
      parseInt(parts[2], 10);
    return this.version;
  }

  async GetCurrentWord(): Promise<string> {
    return editor.callMethod<string>("GetCurrentWord");
  }

  async GetSelectedText(): Promise<string> {
    const result = await editor.callMethod<string>("GetSelectedText");
    if (result !== "") return result;
    return this.GetSelectedContent("text");
  }

  async GetFullText(): Promise<string> {
    return (
      (await editor.callCommand<string>(() => {
        const doc = Api.GetDocument();
        const count = doc.GetElementsCount();
        const lines: string[] = [];
        for (let i = 0; i < count; i++) {
          const el = doc.GetElement(i) as { GetText?: () => string };
          if (typeof el?.GetText === "function") {
            lines.push(el.GetText());
          }
        }
        return lines.join("\n");
      })) ?? ""
    );
  }

  async GetSelectedContent(type: string): Promise<string> {
    return editor.callMethod<string>("GetSelectedContent", [{ type }]);
  }

  async GetSelectedImage(): Promise<string> {
    const res = await editor.callMethod<string>("GetSelectedContent", [
      { type: "html" },
    ]);
    const index1 = res.indexOf('src="data:image/');
    if (index1 === -1) return "";
    const srcStart = index1 + 5;
    const index2 = res.indexOf('"', srcStart);
    if (index2 === -1) return "";
    return res.substring(srcStart, index2);
  }

  async ReplaceTextSmart(text: string): Promise<void> {
    await editor.callMethod("ReplaceTextSmart", [text]);
  }

  async InsertAsText(text: string): Promise<void> {
    Asc.scope.data = (text || "").split("\n\n");
    await editor.callCommand(() => {
      const oDocument = Api.GetDocument();
      const chunks = Asc.scope.data as string[];
      for (let ind = 0; ind < chunks.length; ind++) {
        const chunk = chunks[ind];
        if (chunk.length) {
          const oParagraph = Api.CreateParagraph();
          oParagraph.AddText(chunk);
          oDocument.Push(oParagraph);
        }
      }
    });
  }

  getHTMLFromMD(
    data: string,
    plugins?: MarkdownPlugin[],
    isStreaming?: boolean
  ): string {
    return this.ConvertMdToHTML(data, plugins, isStreaming !== false);
  }

  async InsertAsMD(data: string, plugins?: MarkdownPlugin[]): Promise<void> {
    const htmlContent = this.ConvertMdToHTML(data, plugins);
    return this.InsertAsHTML(htmlContent);
  }

  ConvertMdToHTML(
    data: string,
    plugins?: MarkdownPlugin[],
    isStreaming?: boolean
  ): string {
    const markdownit = (
      window as Window & { markdownit?: () => MarkdownItInstance }
    ).markdownit;
    if (!markdownit) return this.getMarkdownResult(data, isStreaming);
    const md = markdownit();
    if (plugins) {
      for (const plugin of plugins) md.use(plugin);
    }
    return md.render(this.getMarkdownResult(data, isStreaming));
  }

  async InsertAsHTML(data: string): Promise<void> {
    if (editor.getType() === "word") {
      await editor.callCommand(() => {
        const doc = Api.GetDocument();
        doc.RemoveSelection();
      });
    }
    await editor.callMethod("PasteHtml", [data]);
  }

  async InsertAsComment(text: string): Promise<void> {
    await editor.callMethod("AddComment", [
      {
        UserName: "AI",
        Text: decodeHtmlText(text),
        Time: Date.now(),
        Solver: false,
      },
    ]);
  }

  async InsertAsHyperlink(content: string, _hint: string): Promise<void> {
    const text = content;
    const start = text.indexOf("htt");
    let end = text.indexOf(" ", start);
    if (end === -1) end = text.length;
    Asc.scope.link = text.slice(start, end);
    await editor.callCommand(() => {
      const oDocument = Api.GetDocument();
      const oRange = oDocument.GetRangeBySelect();
      oRange.AddHyperlink(Asc.scope.link, "Meaning of the word");
    });
  }

  async InsertAsReview(content: string, isHtml?: boolean): Promise<void> {
    const wasTracking = await editor.callCommand<boolean>(() => {
      const res = Api.asc_GetLocalTrackRevisions() as boolean;
      Api.asc_SetLocalTrackRevisions(true);
      return res;
    });
    Asc.scope.localTrackRevisions = wasTracking;
    await editor.callMethod(isHtml ? "PasteHtml" : "PasteText", [
      content.trim(),
    ]);
    if (wasTracking !== true) {
      await editor.callCommand(() => {
        Api.asc_SetLocalTrackRevisions(Asc.scope.localTrackRevisions);
      });
    }
  }

  async PasteText(text: string): Promise<void> {
    await editor.callMethod("PasteText", [text]);
  }

  async SendError(text: string, errorLevel?: unknown): Promise<void> {
    Asc.scope.errorText = text;
    Asc.scope.errorLevel = errorLevel;
    await editor.callCommand(() => {
      Api.sendEvent("asc_onError", Asc.scope.errorText, Asc.scope.errorLevel);
    });
  }

  async GetLocalImagePath(
    url: string
  ): Promise<{ url: string; error: boolean }> {
    return editor.callMethod("getLocalImagePath", [url]);
  }

  async AddGeneratedImage(base64: string): Promise<void> {
    const editorVersion = await this.GetEditorVersion();

    if (editor.getType() === "pdf") {
      await editor.callMethod("PasteHtml", [`<img src="${base64}" />`]);
      return;
    }

    if (editorVersion >= 9_000_000) {
      const urlResult = await this.GetLocalImagePath(base64);
      if (urlResult.error) return;
      Asc.scope.url = urlResult.url;
    } else {
      Asc.scope.url = base64;
    }

    switch (editor.getType()) {
      case "word":
        await editor.callCommand(() => {
          const document = Api.GetDocument();
          const paragraph = Api.CreateParagraph();
          const drawing = Api.CreateImage(
            Asc.scope.url,
            100 * 36000,
            100 * 36000
          );
          paragraph.AddDrawing(drawing);
          document.RemoveSelection();
          document.InsertContent([paragraph], true);
        });
        break;
      case "cell":
        await editor.callCommand(() => {
          const worksheet = Api.GetActiveSheet();
          worksheet.AddImage(
            Asc.scope.url,
            100 * 36000,
            100 * 36000,
            0,
            2 * 36000,
            2,
            3 * 36000
          );
        });
        break;
      case "slide":
        await editor.callCommand(() => {
          const presentation = Api.GetPresentation();
          const slide = presentation.GetCurrentSlide();
          const image = Api.CreateImage(
            Asc.scope.url,
            150 * 36000,
            150 * 36000
          );
          slide.AddObject(image);
        });
        break;
      default:
        break;
    }
  }

  async AddOleObject(imageUrl: string, data: unknown): Promise<void> {
    if (editor.getType() === "word") {
      await editor.callCommand(() => {
        const document = Api.GetDocument();
        document.RemoveSelection();
      });
    }

    const W = 100;
    const H = 100;
    const info = window.Asc.plugin.info;
    const obj = {
      guid: (info as { guid?: string }).guid,
      widthPix: (info as { mmToPx?: number }).mmToPx ?? 1 * W,
      heightPix: (info as { mmToPx?: number }).mmToPx ?? 1 * H,
      width: W,
      height: H,
      imgSrc: imageUrl,
      data,
    };
    await editor.callMethod("AddOleObject", [obj]);
  }

  trimResult(
    data: string,
    posStart?: number,
    isSpaces?: boolean,
    _extraCharacters?: string[]
  ): string {
    let pos = posStart ?? 0;
    if (pos !== -1) {
      const trimC = ['"', "'", "\n", "\r", "`"];
      if (isSpaces === true) trimC.push(" ");

      while (pos < data.length && trimC.includes(data[pos])) pos++;

      let posEnd = data.length - 1;
      while (posEnd > 0 && trimC.includes(data[posEnd])) posEnd--;

      if (posEnd > pos) return data.substring(pos, posEnd + 1);
    }
    return data;
  }

  getTranslateResult(data: string, dataSrc: string): string {
    let result = this.trimResult(data, 0, true);
    const trimC = ['"', "'", "\n", "\r", " "];
    if (dataSrc.length > 0 && trimC.includes(dataSrc[0])) {
      result = dataSrc[0] + result;
    }
    if (dataSrc.length > 1 && trimC.includes(dataSrc[dataSrc.length - 1])) {
      result = result + dataSrc[dataSrc.length - 1];
    }
    return result;
  }

  getMarkdownResult(data: string, isStreaming?: boolean): string {
    const markdownEscape = data.indexOf("```md");
    let result = data;
    if (markdownEscape !== -1 && markdownEscape < 5) {
      result = result.substring(markdownEscape + 5);
    }
    if (result.endsWith("```")) {
      result = result.slice(0, -3);
    }
    const correctData = result.replace(/\n---#/g, "\n---\n#");
    return isStreaming ? correctData : this.trimResult(correctData);
  }

  getJSONResult(data: string): string {
    const markdownMarker = "```json";
    const markdownEscape = data.indexOf(markdownMarker);
    let result = data;
    if (markdownEscape !== -1 && markdownEscape < 5) {
      result = result.substring(markdownEscape + markdownMarker.length);
    }
    return this.trimResult(result);
  }
}

export const pluginsMD = {
  latex(md: object): void {
    const mdi = md as {
      inline: {
        ruler: {
          after: (
            rule: string,
            name: string,
            fn: (state: object, silent: boolean) => boolean
          ) => void;
        };
      };
      block: {
        ruler: {
          before: (
            rule: string,
            name: string,
            fn: (
              state: object,
              startLine: number,
              endLine: number,
              silent: boolean
            ) => boolean
          ) => void;
        };
      };
      renderer: {
        rules: Record<string, (tokens: object[], idx: number) => string>;
      };
    };

    mdi.inline.ruler.after(
      "escape",
      "latex_inline",
      (state: object, silent: boolean) => {
        const s = state as {
          src: string;
          pos: number;
          push: (
            type: string,
            tag: string,
            nesting: number
          ) => { content: string; attrs: string[][] };
        };
        const start = s.pos;
        if (s.src[start] !== "$") return false;
        if (s.src[start + 1] === "$") return false;

        let content = "";
        let end = s.src.indexOf("$", start + 1);
        while (end !== -1) {
          if (s.src.charCodeAt(end - 1) === 92) {
            end++;
            end = s.src.indexOf("$", end);
            continue;
          }
          content = s.src.slice(start + 1, end).trim();
          break;
        }

        if (!content) return false;

        if (!silent) {
          const token = s.push("latex_inline", "span", 0);
          token.content = content;
          token.attrs = [["class", "oo-latex-inline"]];
        }

        s.pos = end + 1;
        return true;
      }
    );

    mdi.renderer.rules.latex_inline = (tokens: object[], idx: number) => {
      const t = tokens[idx] as { content: string };
      return `<span class="oo-latex-inline">${t.content}</span>`;
    };

    mdi.block.ruler.before(
      "fence",
      "latex_block",
      (state: object, startLine: number, endLine: number, silent: boolean) => {
        const s = state as {
          bMarks: number[];
          tShift: number[];
          eMarks: number[];
          src: string;
          line: number;
          push: (
            type: string,
            tag: string,
            nesting: number
          ) => {
            block: boolean;
            content: string;
            attrs: string[][];
            map: number[];
          };
        };
        const startPos = s.bMarks[startLine] + s.tShift[startLine];
        const maxPos = s.eMarks[startLine];
        const line = s.src.slice(startPos, maxPos).trim();

        if (!line.startsWith("$$")) return false;
        if (silent) return true;

        let content = "";
        let found = false;

        for (let i = startLine + 1; i < endLine; i++) {
          const pos = s.bMarks[i] + s.tShift[i];
          const max = s.eMarks[i];
          const nextLine = s.src.slice(pos, max).trim();
          if (nextLine === "$$") {
            found = true;
            s.line = i + 1;
            break;
          }
          content += `${nextLine}\n`;
        }

        if (!found) return false;

        const token = s.push("latex_block", "span", 0);
        token.block = true;
        token.content = content.trim();
        token.attrs = [["class", "oo-latex"]];
        token.map = [startLine, s.line];
        return true;
      }
    );

    mdi.renderer.rules.latex_block = (tokens: object[], idx: number) => {
      const t = tokens[idx] as { content: string };
      return `<span class="oo-latex">${t.content}</span>\n`;
    };
  },

  forms(md: object): void {
    let fieldCounter = 1837335014;
    let fieldKeyCounter = 1;

    interface FieldParams {
      type?: string;
      checked?: string;
      symbolChecked?: string;
      symbolUnchecked?: string;
      key?: string;
      text?: string;
      groupKey?: string;
      GroupKey?: string;
      items?: string;
      selected?: string;
      value?: string;
      placeholder?: string;
    }

    function parseParams(content: string): FieldParams {
      const params: FieldParams = {};
      const regex = /(\w+)[:=](?:'([^']*)'|"([^"]*)"|([^,}]*))/g;
      let match = regex.exec(content);
      while (match !== null) {
        const key = match[1] as keyof FieldParams;
        const value = match[2] || match[3] || match[4];
        (params as Record<string, string>)[key] = value;
        match = regex.exec(content);
      }
      return params;
    }

    function renderCheckbox(params: FieldParams): string {
      const checked = params.checked === "true";
      const symbolChecked = params.symbolChecked || "☑";
      const symbolUnchecked = params.symbolUnchecked || "☐";
      const key = params.key || `Checkbox${fieldKeyCounter++}`;
      const text = params.text || "";
      const displaySymbol = checked ? symbolChecked : symbolUnchecked;
      void displaySymbol;
      return `<w:Sdt CheckBox="t" Form="t" CheckBoxValueChecked="${symbolChecked}" CheckBoxValueUnchecked="${symbolUnchecked}" Key="${key}" Text="${text}"/></w:Sdt>`;
    }

    function renderRadiobutton(params: FieldParams): string {
      const checked = params.checked === "true";
      const symbolChecked = params.symbolChecked || "◉";
      const symbolUnchecked = params.symbolUnchecked || "○";
      const groupKey = params.groupKey || params.GroupKey || "Group 1";
      const key = params.key || `Radio${fieldKeyCounter++}`;
      const text = params.text || "";
      const displaySymbol = checked ? symbolChecked : symbolUnchecked;
      void displaySymbol;
      return `<w:Sdt CheckBox="t" Form="t" CheckBoxValueChecked="${symbolChecked}" CheckBoxValueUnchecked="${symbolUnchecked}" GroupKey="${groupKey}" Key="${key}" Text="${text}"></w:Sdt>`;
    }

    function renderCombobox(params: FieldParams): string {
      const items = params.items ? params.items.split(",") : [];
      const key = params.key || `Combobox${fieldKeyCounter++}`;
      const id = fieldCounter++;
      const itemsHtml = items
        .map((item) => {
          const trimmed = item.trim();
          return `<w:ListItem ListValue="${trimmed}" DataValue="${trimmed}"></w:ListItem>`;
        })
        .join("");
      return `<w:Sdt ComboBox="t" Form="t" Key="${key}" ID="${id}">${itemsHtml}\n</w:Sdt>`;
    }

    function renderTextbox(params: FieldParams): string {
      const key = params.key || `Textbox${fieldKeyCounter++}`;
      let text = params.text || params.value || "";
      const placeholder = params.placeholder || "";
      if (placeholder === "" && text === "") text = "empty";
      if (placeholder === "")
        return `<w:Sdt Form="t" Key="${key}">${text}</w:Sdt>`;
      return `<w:Sdt Form="t" Key="${key}" PlcHdr="${placeholder}" ShowingPlcHdr="t">${text}</w:Sdt>`;
    }

    function renderDate(params: FieldParams): string {
      const key = params.key || `DatePicker${fieldKeyCounter++}`;
      const value = params.value || "";
      let isoDate = "";
      let displayDate = value;
      if (value) {
        const parts = value.split(".");
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          displayDate = value;
        }
      }
      return `<w:Sdt Calendar="t" Form="t" MapToDateTime="t" CalendarType="Gregorian" Date="${isoDate}" DateFormat="dd.MM.yyyy" Key="${key}">${displayDate}</w:Sdt>`;
    }

    function renderField(tokens: object[], idx: number): string {
      const token = tokens[idx] as { content: string };
      const params = parseParams(token.content);
      switch (params.type) {
        case "checkbox":
          return renderCheckbox(params);
        case "radiobutton":
          return renderRadiobutton(params);
        case "combobox":
          return renderCombobox(params);
        case "textbox":
          return renderTextbox(params);
        case "date":
          return renderDate(params);
        default:
          return "";
      }
    }

    const mdi = md as {
      inline: {
        ruler: {
          before: (
            rule: string,
            name: string,
            fn: (state: object, silent: boolean) => boolean
          ) => void;
        };
      };
      renderer: {
        rules: Record<string, (tokens: object[], idx: number) => string>;
      };
    };

    mdi.inline.ruler.before(
      "emphasis",
      "field",
      (state: object, silent: boolean) => {
        const s = state as {
          src: string;
          pos: number;
          posMax: number;
          push: (
            type: string,
            tag: string,
            nesting: number
          ) => { content: string; markup: string };
        };
        const start = s.pos;
        const max = s.posMax;

        if (
          s.src.charCodeAt(start) !== 0x7b ||
          s.src.slice(start, start + 7) !== "{FIELD:"
        )
          return false;

        let pos = start + 7;
        let depth = 1;
        while (pos < max && depth > 0) {
          if (s.src.charCodeAt(pos) === 0x7b) depth++;
          if (s.src.charCodeAt(pos) === 0x7d) depth--;
          pos++;
        }
        if (depth !== 0) return false;

        const content = s.src.slice(start + 7, pos - 1);
        if (!silent) {
          const token = s.push("field", "", 0);
          token.content = content;
          token.markup = "{FIELD:}";
        }
        s.pos = pos;
        return true;
      }
    );

    mdi.renderer.rules.field = renderField;
  },

  hr(md: object): void {
    const mdi = md as {
      renderer: { rules: Record<string, () => string> };
    };
    mdi.renderer.rules.hr = () => "<hr><br>";
  },
};

export const library = new AscLibrary();
