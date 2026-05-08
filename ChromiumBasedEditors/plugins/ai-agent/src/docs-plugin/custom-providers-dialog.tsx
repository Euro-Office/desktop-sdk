import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CUSTOM_PROVIDERS_DIALOG_EVENTS } from "./custom-providers/dialog-events";
import TEMPLATE_TEXT from "./custom-providers/template.js?raw";
import {
  getZoomSuffix,
  updateBodyThemeClasses,
  updateThemeVariables,
} from "./theme-utils";
import "./custom-providers-dialog.css";

const ERROR_AUTO_HIDE_MS = 10_000;
const TOOLTIP_DELAY_MS = 200;
const TEMPLATE_FILENAME = "providerTemplate.js";

function iconUrl(themeType: string, name: string): string {
  const theme = themeType === "dark" ? "dark" : "light";
  return `resources/${theme}/${name}${getZoomSuffix()}.png`;
}

function CustomProvidersDialog() {
  const [providers, setProviders] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [themeType, setThemeType] = useState<string>(
    () => window.Asc.plugin.info?.theme?.type ?? "light"
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const tooltipShowTimerRef = useRef<number | null>(null);
  const tooltipHideTimerRef = useRef<number | null>(null);

  const showError = useCallback((message: string): void => {
    setError(message);
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, ERROR_AUTO_HIDE_MS);
  }, []);

  const sendFiles = (files: FileList | File[]): void => {
    let pending = 0;
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".js")) {
        showError("Invalid file format, please upload the .js file");
        continue;
      }
      pending++;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = String(e.target?.result ?? "");
        window.Asc.plugin.sendToPlugin(
          CUSTOM_PROVIDERS_DIALOG_EVENTS.addProvider,
          { name: file.name, content }
        );
      };
      reader.onerror = () => {
        showError("Error adding provider from file, please try again");
      };
      reader.readAsText(file);
    }
    if (pending > 0) setError(null);
  };

  const downloadTemplate = (): void => {
    const desktop = window.AscDesktopEditor;
    if (desktop?.SaveFilenameDialog) {
      desktop.SaveFilenameDialog(
        TEMPLATE_FILENAME,
        (path) => {
          if (typeof path !== "string" || !path) return;
        },
        TEMPLATE_TEXT
      );
      return;
    }

    const blob = new Blob([TEMPLATE_TEXT], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = TEMPLATE_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const cancelTooltipTimers = useCallback((): void => {
    if (tooltipShowTimerRef.current !== null) {
      window.clearTimeout(tooltipShowTimerRef.current);
      tooltipShowTimerRef.current = null;
    }
    if (tooltipHideTimerRef.current !== null) {
      window.clearTimeout(tooltipHideTimerRef.current);
      tooltipHideTimerRef.current = null;
    }
  }, []);

  const scheduleTooltip = (open: boolean): void => {
    cancelTooltipTimers();
    if (open) {
      tooltipShowTimerRef.current = window.setTimeout(() => {
        setTooltipOpen(true);
        tooltipShowTimerRef.current = null;
      }, TOOLTIP_DELAY_MS);
    } else {
      tooltipHideTimerRef.current = window.setTimeout(() => {
        setTooltipOpen(false);
        tooltipHideTimerRef.current = null;
      }, TOOLTIP_DELAY_MS);
    }
  };

  useEffect(() => {
    const theme = window.Asc.plugin.info?.theme;
    if (theme) {
      updateBodyThemeClasses(theme.type, theme.name);
      updateThemeVariables(theme);
      setThemeType(theme.type ?? "light");
    }

    window.Asc.plugin.attachEvent("onThemeChanged", (rawTheme: unknown) => {
      const next = rawTheme as AscTheme;
      window.Asc.plugin.onThemeChangedBase?.(next);
      updateBodyThemeClasses(next.type, next.name);
      updateThemeVariables(next);
      setThemeType(next.type ?? "light");
    });

    window.Asc.plugin.attachEvent(
      CUSTOM_PROVIDERS_DIALOG_EVENTS.setProviders,
      (raw: unknown) => {
        const list =
          typeof raw === "string"
            ? (JSON.parse(raw) as string[])
            : (raw as string[]);
        setProviders(Array.isArray(list) ? list : []);
        setSelected((prev) => (prev && list.includes(prev) ? prev : null));
      }
    );

    window.Asc.plugin.attachEvent(
      CUSTOM_PROVIDERS_DIALOG_EVENTS.error,
      (raw: unknown) => {
        showError(typeof raw === "string" ? raw : "Unknown error");
      }
    );

    window.Asc.plugin.sendToPlugin(
      CUSTOM_PROVIDERS_DIALOG_EVENTS.windowReady,
      {}
    );

    return () => {
      window.Asc.plugin.detachEvent("onThemeChanged");
      window.Asc.plugin.detachEvent(
        CUSTOM_PROVIDERS_DIALOG_EVENTS.setProviders
      );
      window.Asc.plugin.detachEvent(CUSTOM_PROVIDERS_DIALOG_EVENTS.error);
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
      }
      cancelTooltipTimers();
    };
  }, [showError, cancelTooltipTimers]);

  const isEmpty = providers.length === 0;

  return (
    <>
      <div id="label-row">
        <span className="cp-label i18n">Connected custom providers</span>
        <img
          id="alert-icon"
          src={iconUrl(themeType, "info")}
          alt="info"
          onMouseEnter={() => scheduleTooltip(true)}
          onMouseLeave={() => scheduleTooltip(false)}
        />
        {tooltipOpen && (
          <div
            id="alert-tooltip"
            className="tooltip has-shadow"
            onMouseEnter={cancelTooltipTimers}
            onMouseLeave={() => scheduleTooltip(false)}
          >
            <div id="alert-inner-popover">
              <div className="i18n">
                Enter the configuration for the AI model API in JS format.
                Provide the model name, endpoint URLs, and headers.
              </div>
              <button
                id="popover-link"
                type="button"
                onClick={downloadTemplate}
              >
                <span className="i18n">Download template</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div id="list-row">
        <div
          id="providers-list"
          className={`list-view${isEmpty ? " empty" : ""}${dragOver ? " dragged" : ""}`}
          onClick={() => {
            if (isEmpty) fileInputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            if (e.dataTransfer.files.length) sendFiles(e.dataTransfer.files);
          }}
        >
          {isEmpty ? (
            <div className="empty-text i18n">
              The list is empty, press + to add the file
            </div>
          ) : (
            providers.map((name) => (
              <div
                key={name}
                className={`item${selected === name ? " selected" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected((prev) => (prev === name ? null : name));
                }}
              >
                {name}
              </div>
            ))
          )}
        </div>

        <div id="buttons-block">
          <button
            id="add-btn"
            type="button"
            className="btn-text-default"
            onClick={() => fileInputRef.current?.click()}
          >
            <img
              className="icon"
              src={iconUrl(themeType, "btn-zoomup")}
              alt="add"
            />
          </button>
          <button
            id="delete-btn"
            type="button"
            className="btn-text-default"
            disabled={selected === null}
            onClick={() => {
              if (!selected) return;
              window.Asc.plugin.sendToPlugin(
                CUSTOM_PROVIDERS_DIALOG_EVENTS.deleteProvider,
                { name: selected }
              );
              setSelected(null);
            }}
          >
            <img
              className="icon"
              src={iconUrl(themeType, "btn-remove")}
              alt="delete"
            />
          </button>
        </div>
      </div>

      <div
        id="error-label"
        className={error ? "i18n" : "hide i18n"}
        role="alert"
      >
        {error ?? ""}
      </div>

      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept=".js"
        multiple
        onChange={(e) => {
          if (e.target.files) sendFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

window.Asc.plugin.init = () => {
  const container = document.getElementById("ai_custom_providers_window_root");
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <CustomProvidersDialog />
      </StrictMode>
    );
  }
};
