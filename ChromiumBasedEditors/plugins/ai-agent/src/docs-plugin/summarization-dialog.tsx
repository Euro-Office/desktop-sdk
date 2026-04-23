import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Select, type SelectOption } from "./components/Select";
import { SUMMARIZATION_LANGUAGES } from "./engine/languages";
import { updateBodyThemeClasses, updateThemeVariables } from "./theme-utils";
import "./summarization-dialog.css";

type InsertMode = "review" | "comment" | "replace" | "end";

interface InsertOption {
  name: string;
  value: InsertMode;
}

const INSERT_OPTIONS_WORD: InsertOption[] = [
  { name: "As review", value: "review" },
  { name: "In comment", value: "comment" },
  { name: "Replace original text", value: "replace" },
  { name: "To the end of document", value: "end" },
];

function isDarkTheme(themeType?: string): boolean {
  return themeType === "dark";
}

function getZoomSuffix(): string {
  let ratio = Math.round(window.devicePixelRatio / 0.25) * 0.25;
  ratio = Math.max(ratio, 1);
  ratio = Math.min(ratio, 2);
  return ratio === 1 ? "" : `@${ratio}x`;
}

function SummarizationDialog() {
  const editorType = window.Asc.plugin.info?.editorType;
  const isWord = editorType === "word";

  const insertOptions = useMemo<InsertOption[]>(
    () => (isWord ? INSERT_OPTIONS_WORD : INSERT_OPTIONS_WORD.slice(1, 3)),
    [isWord]
  );

  const langSelectOptions = useMemo<SelectOption[]>(
    () =>
      SUMMARIZATION_LANGUAGES.map((l) => ({
        value: l.value,
        label: `${l.nameLocale} – ${l.nameEn}`,
      })),
    []
  );

  const insertSelectOptions = useMemo<SelectOption<InsertMode>[]>(
    () => insertOptions.map((o) => ({ value: o.value, label: o.name })),
    [insertOptions]
  );

  const [originalText, setOriginalText] = useState("");
  const [resultText, setResultText] = useState("");
  const [targetLang, setTargetLang] = useState<string>("en-US");
  const [insertMode, setInsertMode] = useState<InsertMode>(
    isWord ? "review" : "comment"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [themeType, setThemeType] = useState<string>(
    window.Asc.plugin.info?.theme?.type ?? "light"
  );
  const [zoomSuffix, setZoomSuffix] = useState<string>(() => getZoomSuffix());
  const resultRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const theme = window.Asc.plugin.info?.theme;
    if (theme) {
      updateBodyThemeClasses(theme.type, theme.name);
      updateThemeVariables(theme);
    }

    window.Asc.plugin.attachEvent("onThemeChanged", (rawTheme: unknown) => {
      const nextTheme = rawTheme as AscTheme;
      window.Asc.plugin.onThemeChangedBase?.(nextTheme);
      updateBodyThemeClasses(nextTheme.type, nextTheme.name);
      updateThemeVariables(nextTheme);
      setThemeType(nextTheme.type ?? "light");
    });

    window.Asc.plugin.attachEvent("onGetSelection", (text: unknown) => {
      if (typeof text === "string") setOriginalText(text);
    });

    window.Asc.plugin.attachEvent("onSummarize", (raw: unknown) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as {
              error: number;
              data?: string;
              message?: string;
            })
          : (raw as { error: number; data?: string; message?: string });
      if (payload.error === 0) {
        setResultText(payload.data ?? "");
        setErrorMsg("");
      } else {
        setResultText("");
        setErrorMsg(payload.message ?? "Error");
      }
    });

    window.Asc.plugin.executeMethod("GetDocumentLang", [], (lang: unknown) => {
      if (typeof lang !== "string") return;
      const match = SUMMARIZATION_LANGUAGES.find((l) => l.value === lang);
      if (match) setTargetLang(match.value);
    });

    window.Asc.plugin.sendToPlugin("onInit", {});

    const onResize = () => setZoomSuffix(getZoomSuffix());
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.Asc.plugin.detachEvent("onThemeChanged");
      window.Asc.plugin.detachEvent("onGetSelection");
      window.Asc.plugin.detachEvent("onSummarize");
    };
  }, []);

  const themeFolder = isDarkTheme(themeType) ? "dark" : "light";
  const copyIconSrc = `resources/${themeFolder}/copy${zoomSuffix}.png`;
  const errorIconSrc = `resources/${themeFolder}/error${zoomSuffix}.png`;

  function handleClear() {
    setOriginalText("");
  }

  function handleCopy() {
    const el = resultRef.current;
    if (!el || !resultText) return;
    el.select();
    document.execCommand("copy");
  }

  function handleSummarize() {
    const trimmed = originalText.trim();
    if (!trimmed.length) return;
    const selected = SUMMARIZATION_LANGUAGES.find(
      (l) => l.value === targetLang
    );
    const langEn = selected?.nameEn ?? "English";
    setErrorMsg("");
    window.Asc.plugin.sendToPlugin("Summarize", {
      data: originalText,
      lang: langEn,
    });
  }

  function handleInsert() {
    if (!resultText) return;
    window.Asc.plugin.sendToPlugin("onSummarize", {
      type: insertMode,
      data: resultText,
    });
  }

  const hasError = errorMsg.length > 0;

  return (
    <div className="content">
      <div className="column">
        <div className="row-label">
          <label className="i18n" htmlFor="original-textarea">
            Your text
          </label>
          {/* biome-ignore lint/a11y/useSemanticElements: keep 1:1 DOM with old plugin */}
          <div
            id="clear-btn"
            className="i18n"
            onClick={handleClear}
            role="button"
            tabIndex={0}
          >
            Clear
          </div>
        </div>
        <textarea
          id="original-textarea"
          className="form-control"
          placeholder="Insert your text here or select the part of the text"
          value={originalText}
          onChange={(e) => setOriginalText(e.target.value)}
        />
        <div className="row-label">
          <label className="i18n" htmlFor="target-lang-cmb">
            Target language
          </label>
        </div>
        <div className="button-block">
          <Select
            id="target-lang-cmb"
            value={targetLang}
            options={langSelectOptions}
            onValueChange={setTargetLang}
          />
          <button
            id="summarize-btn"
            type="button"
            className="btn-text-default submit primary i18n"
            onClick={handleSummarize}
          >
            Summarize
          </button>
        </div>
      </div>
      <div className="column">
        <div className="row-label">
          <label className="i18n" htmlFor="result-textarea">
            Summary result
          </label>
          <button
            id="copy-btn"
            type="button"
            className="btn-text-default"
            disabled={!resultText}
            onClick={handleCopy}
          >
            <img className="icon" src={copyIconSrc} alt="Copy" />
          </button>
        </div>
        <div className="summary-wrapper">
          <textarea
            id="result-textarea"
            ref={resultRef}
            className="form-control"
            placeholder="The AI output will be shown here"
            value={resultText}
            readOnly
          />
          <div
            id="error-alert"
            className="error"
            style={{ display: hasError ? "block" : "none" }}
          >
            <div className="error-title-block">
              <img className="error-icon icon" src={errorIconSrc} alt="Error" />
              <div className="error-title i18n">Error</div>
            </div>
            <div className="error-description">{errorMsg}</div>
          </div>
        </div>
        <div className="row-label">
          <label className="i18n" htmlFor="insert-as-cmb">
            Insert result
          </label>
        </div>
        <div className="button-block">
          <Select<InsertMode>
            id="insert-as-cmb"
            value={insertMode}
            options={insertSelectOptions}
            onValueChange={setInsertMode}
          />
          <button
            id="insert-btn"
            type="button"
            className="btn-text-default i18n"
            disabled={!resultText}
            onClick={handleInsert}
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

window.Asc.plugin.init = () => {
  const container = document.getElementById("summarization_window");
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <SummarizationDialog />
      </StrictMode>
    );
  }
};
