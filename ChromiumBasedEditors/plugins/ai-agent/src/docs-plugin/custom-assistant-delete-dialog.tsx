import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { updateBodyThemeClasses, updateThemeVariables } from "./theme-utils";
import "./custom-assistant-delete-dialog.css";

function CustomAssistantDeleteDialog() {
  const idRef = useRef<string>("");

  useEffect(() => {
    const theme = window.Asc.plugin.info?.theme;
    if (theme) {
      updateBodyThemeClasses(theme.type, theme.name);
      updateThemeVariables(theme);
    }

    window.Asc.plugin.attachEvent("onThemeChanged", (rawTheme: unknown) => {
      const next = rawTheme as AscTheme;
      window.Asc.plugin.onThemeChangedBase?.(next);
      updateBodyThemeClasses(next.type, next.name);
      updateThemeVariables(next);
    });

    window.Asc.plugin.attachEvent("onSetAssistantId", (raw: unknown) => {
      idRef.current = typeof raw === "string" ? raw : "";
    });

    window.Asc.plugin.attachEvent("onConfirmDelete", () => {
      window.Asc.plugin.sendToPlugin("onDeleteAssistant", {
        id: idRef.current,
      });
    });

    window.Asc.plugin.sendToPlugin("onWindowReady", {});

    return () => {
      window.Asc.plugin.detachEvent("onThemeChanged");
      window.Asc.plugin.detachEvent("onSetAssistantId");
      window.Asc.plugin.detachEvent("onConfirmDelete");
    };
  }, []);

  return (
    <div className="delete_assistant_window noselect">
      <p className="description i18n">
        Are you sure you want to delete this assistant?
      </p>
      <p className="i18n">This action cannot be undone.</p>
    </div>
  );
}

window.Asc.plugin.init = () => {
  const container = document.getElementById("custom_assistant_delete_root");
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <CustomAssistantDeleteDialog />
      </StrictMode>
    );
  }
};
