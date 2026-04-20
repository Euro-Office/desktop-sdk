import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";
import { useEffect, useMemo, useRef } from "react";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { migrateProvidersToProfiles } from "@/shared/lib/migrateProvidersToProfiles";
import { isDesktopEditor } from "@/shared/lib/utils";
import { NoopPlatform } from "@/shared/platform/noop";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import { crossPluginBus } from "@/shared/sync/crossPluginBus";
import { OnlyOfficePlatform } from "./platform/onlyoffice";

const App = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(
    () => (isDesktopEditor() ? new OnlyOfficePlatform() : new NoopPlatform()),
    []
  );
  const widgetRef = useRef<AIChatWidgetRef>(null);

  useEffect(() => {
    return crossPluginBus.subscribe("modelAssignmentUpdated", () => {
      widgetRef.current?.updateCurrentChat();
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
      callbacks={{
        onModelAssignmentUpdated: (data) => {
          crossPluginBus.publish("modelAssignmentUpdated", data);
        },
      }}
    />
  );
};

export default App;
