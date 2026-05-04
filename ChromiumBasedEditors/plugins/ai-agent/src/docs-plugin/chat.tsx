import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";
import { StrictMode, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { migrateProvidersToProfiles } from "@/shared/lib/migrateProvidersToProfiles";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import type { CrossPluginEvents } from "@/shared/sync/crossPluginBus";
import { editor } from "./library/editor";
import { install as installLibrary } from "./library/index";
import { OnlyOfficePlatform } from "./platform/index";
import { createToolsAdapter } from "./tools";

type SyncPayload = {
  [K in keyof CrossPluginEvents]: { event: K; data: CrossPluginEvents[K] };
}[keyof CrossPluginEvents];

const sharedStorage = new IndexedDBStorage();

const Chat = () => {
  const storage = useMemo(() => sharedStorage, []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const toolsAdapter = useMemo(() => createToolsAdapter(editor.getType()), []);
  const widgetRef = useRef<AIChatWidgetRef>(null);

  useEffect(() => {
    window.Asc.plugin.attachEvent("onAiStateChanged", (raw) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as SyncPayload)
          : (raw as SyncPayload);

      const widget = widgetRef.current;
      if (!widget) return;

      console.log(`[Docs chat] ← ${payload.event}`, payload.data);

      switch (payload.event) {
        case "threadsUpdated":
          widget.updateThreads();
          return;
        case "modelAssignmentUpdated":
          widget.updateCurrentChat();
          widget.updateModelAssignment();
          return;
        case "profilesUpdated":
        case "currentChatProfileUpdated":
          widget.updateCurrentChat();
          return;
        case "extendedThinkingUpdated":
          widget.updateExtendedThinking();
          return;
        case "serversUpdated":
          widget.updateMCPServer();
          return;
        case "webSearchUpdated":
          widget.updateWebSearch();
          widget.updateMCPServer();
          return;
      }
    });

    return () => {
      window.Asc.plugin.detachEvent("onAiStateChanged");
    };
  }, []);

  return (
    <AIChatWidget
      ref={widgetRef}
      storage={storage}
      settings={settings}
      platform={platform}
      storeKeys={DEFAULT_STORE_KEYS}
      toolsAdapter={toolsAdapter}
      onMigrate={() => migrateProvidersToProfiles(storage)}
      onSettingsClick={() => {
        window.Asc.plugin.sendToPlugin("ai-open-settings", {});
      }}
      callbacks={{
        onThreadsUpdated: (data) => {
          if (data.kind === "switched") return;
          console.log("[Docs chat] → threadsUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "threadsUpdated",
            data,
          });
        },
        onExtendedThinkingUpdated: (data) => {
          console.log("[Docs chat] → extendedThinkingUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "extendedThinkingUpdated",
            data,
          });
        },
        onServersUpdated: (data) => {
          console.log("[Docs chat] → serversUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "serversUpdated",
            data,
          });
        },
      }}
    />
  );
};

window.Asc.plugin.init = async () => {
  await sharedStorage.init();
  installLibrary(sharedStorage);

  const container = document.getElementById("chat_panel");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <Chat />
      </StrictMode>
    );
  }
};
