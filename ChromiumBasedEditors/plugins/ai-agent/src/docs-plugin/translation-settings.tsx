import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_TRANSLATION_LANG,
  TRANSLATION_LANG_KEY,
  TRANSLATION_LANGUAGES,
} from "./engine/languages";
import { updateBodyThemeClasses, updateThemeVariables } from "./theme-utils";
import "./translation-settings.css";

function TranslationSettings() {
  const [selected, setSelected] = useState<string>(
    () => localStorage.getItem(TRANSLATION_LANG_KEY) ?? DEFAULT_TRANSLATION_LANG
  );
  const selectedRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedStateRef = useRef(selected);

  useEffect(() => {
    selectedStateRef.current = selected;
  }, [selected]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });

    if (listRef.current) {
      new PerfectScrollbar(listRef.current, {});
    }

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
    });

    window.Asc.plugin.attachEvent("onKeepLang", () => {
      localStorage.setItem(TRANSLATION_LANG_KEY, selectedStateRef.current);
    });

    return () => {
      window.Asc.plugin.detachEvent("onThemeChanged");
      window.Asc.plugin.detachEvent("onKeepLang");
    };
  }, []);

  return (
    <div className="container">
      <p id="description" className="i18n">
        Select language for AI translation.
      </p>
      <div id="idx-lang-list" ref={listRef} className="list">
        {TRANSLATION_LANGUAGES.map(({ label, value, rightLabel }) => {
          const isSelected = selected === value;
          return (
            <div
              key={value}
              ref={isSelected ? selectedRef : null}
              className={isSelected ? "item selected" : "item"}
              onClick={() => setSelected(value)}
            >
              <span>{label}</span>
              <span lang="">{rightLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.Asc.plugin.init = () => {
  const container = document.getElementById("translation_window");
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <TranslationSettings />
      </StrictMode>
    );
  }
};
