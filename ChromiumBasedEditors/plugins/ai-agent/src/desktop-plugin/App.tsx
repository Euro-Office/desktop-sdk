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
    const unsubscribers = [
      crossPluginBus.subscribe("modelAssignmentUpdated", () => {
        widgetRef.current?.updateCurrentChat();
        widgetRef.current?.updateModelAssignment();
      }),
      crossPluginBus.subscribe("currentChatProfileUpdated", () => {
        widgetRef.current?.updateCurrentChat();
      }),
      crossPluginBus.subscribe("profilesUpdated", () => {
        widgetRef.current?.updateCurrentChat();
        widgetRef.current?.updateProfiles();
      }),
      crossPluginBus.subscribe("serversUpdated", () => {
        widgetRef.current?.updateMCPServer();
      }),
      crossPluginBus.subscribe("webSearchUpdated", () => {
        console.log("[Desktop] web search updated");
        widgetRef.current?.updateWebSearch();
      }),
      crossPluginBus.subscribe("threadsUpdated", () => {
        widgetRef.current?.updateThreads();
      }),
      crossPluginBus.subscribe("extendedThinkingUpdated", () => {
        widgetRef.current?.updateExtendedThinking();
      }),
    ];

    return () => {
      for (const unsub of unsubscribers) unsub();
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
      callbacks={{
        onModelAssignmentUpdated: (data) => {
          crossPluginBus.publish("modelAssignmentUpdated", data);
        },
        onCurrentChatProfileUpdated: (data) => {
          if (data.scope !== "persisted") return;
          crossPluginBus.publish("currentChatProfileUpdated", data);
        },
        onProfilesUpdated: (data) => {
          crossPluginBus.publish("profilesUpdated", data);
        },
        onServersUpdated: (data) => {
          crossPluginBus.publish("serversUpdated", data);
        },
        onWebSearchUpdated: (data) => {
          crossPluginBus.publish("webSearchUpdated", data);
        },
        onThreadsUpdated: (data) => {
          if (data.kind === "switched") return;
          crossPluginBus.publish("threadsUpdated", data);
        },
        onExtendedThinkingUpdated: (data) => {
          crossPluginBus.publish("extendedThinkingUpdated", data);
        },
      }}
    />
  );
};

export default App;
