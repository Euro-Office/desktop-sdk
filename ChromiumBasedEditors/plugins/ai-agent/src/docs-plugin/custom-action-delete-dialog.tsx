import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { CUSTOM_ACTION_DELETE_DIALOG_EVENTS } from "./custom-actions/dialog-events";
import { updateBodyThemeClasses, updateThemeVariables } from "./theme-utils";
import "./custom-action-delete-dialog.css";

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

    window.Asc.plugin.attachEvent(
      CUSTOM_ACTION_DELETE_DIALOG_EVENTS.setActionId,
      (raw: unknown) => {
        idRef.current = typeof raw === "string" ? raw : "";
      }
    );

    window.Asc.plugin.attachEvent(
      CUSTOM_ACTION_DELETE_DIALOG_EVENTS.confirm,
      () => {
        window.Asc.plugin.sendToPlugin(
          CUSTOM_ACTION_DELETE_DIALOG_EVENTS.delete,
          {
            id: idRef.current,
          }
        );
      }
    );

    window.Asc.plugin.sendToPlugin(
      CUSTOM_ACTION_DELETE_DIALOG_EVENTS.windowReady,
      {}
    );

    return () => {
      window.Asc.plugin.detachEvent("onThemeChanged");
      window.Asc.plugin.detachEvent(
        CUSTOM_ACTION_DELETE_DIALOG_EVENTS.setActionId
      );
      window.Asc.plugin.detachEvent(CUSTOM_ACTION_DELETE_DIALOG_EVENTS.confirm);
    };
  }, []);

  return (
    <div className="ai_action_delete_window noselect">
      <p className="description i18n">
        Are you sure you want to delete this action?
      </p>
      <p className="i18n">This action cannot be undone.</p>
    </div>
  );
}

window.Asc.plugin.init = () => {
  const container = document.getElementById("ai_action_delete_root");
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <CustomAssistantDeleteDialog />
      </StrictMode>
    );
  }
};
