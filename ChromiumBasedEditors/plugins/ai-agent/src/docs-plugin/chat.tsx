import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";
import { StrictMode, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { migrateProvidersToProfiles } from "@/shared/lib/migrateProvidersToProfiles";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import type { CrossPluginEvents } from "@/shared/sync/crossPluginBus";
import { OnlyOfficePlatform } from "./platform/index";

type SyncPayload = {
  [K in keyof CrossPluginEvents]: { event: K; data: CrossPluginEvents[K] };
}[keyof CrossPluginEvents];

const Chat = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const widgetRef = useRef<AIChatWidgetRef>(null);

  useEffect(() => {
    window.Asc.plugin.attachEvent("onAiStateChanged", (raw) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as SyncPayload)
          : (raw as SyncPayload);

      const widget = widgetRef.current;
      if (!widget) return;

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
      onMigrate={migrateProvidersToProfiles}
      onSettingsClick={() => {
        window.Asc.plugin.sendToPlugin("ai-open-settings", {});
      }}
      callbacks={{
        onThreadsUpdated: (data) => {
          if (data.kind === "switched") return;
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "threadsUpdated",
            data,
          });
        },
      }}
    />
  );
};

window.Asc.plugin.init = () => {
  const container = document.getElementById("chat_panel");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <Chat />
      </StrictMode>
    );
  }
};
