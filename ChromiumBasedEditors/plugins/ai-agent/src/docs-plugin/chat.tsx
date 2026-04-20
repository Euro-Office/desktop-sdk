import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";
import { StrictMode, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { migrateProvidersToProfiles } from "@/shared/lib/migrateProvidersToProfiles";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import { OnlyOfficePlatform } from "./platform/index";

const Chat = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const widgetRef = useRef<AIChatWidgetRef>(null);

  useEffect(() => {
    window.Asc.plugin.attachEvent("onSettingsChanged", (raw) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as { event: string })
          : (raw as { event: string });

      if (payload.event === "modelAssignmentUpdated") {
        widgetRef.current?.updateCurrentChat();
      }
    });
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
