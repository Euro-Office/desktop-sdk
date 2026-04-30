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

export const sharedStorage = new IndexedDBStorage();

const App = () => {
  const storage = useMemo(() => sharedStorage, []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(
    () => (isDesktopEditor() ? new OnlyOfficePlatform() : new NoopPlatform()),
    []
  );
  const widgetRef = useRef<AIChatWidgetRef>(null);

  useEffect(() => {
    const unsubscribers = [
      crossPluginBus.subscribe("modelAssignmentUpdated", (data) => {
        console.log("[Desktop] ← modelAssignmentUpdated", data);
        widgetRef.current?.updateCurrentChat();
        widgetRef.current?.updateModelAssignment();
      }),
      crossPluginBus.subscribe("currentChatProfileUpdated", (data) => {
        console.log("[Desktop] ← currentChatProfileUpdated", data);
        widgetRef.current?.updateCurrentChat();
      }),
      crossPluginBus.subscribe("profilesUpdated", (data) => {
        console.log("[Desktop] ← profilesUpdated", data);
        widgetRef.current?.updateCurrentChat();
        widgetRef.current?.updateProfiles();
      }),
      crossPluginBus.subscribe("serversUpdated", (data) => {
        console.log("[Desktop] ← serversUpdated", data);
        widgetRef.current?.updateMCPServer();
      }),
      crossPluginBus.subscribe("webSearchUpdated", (data) => {
        console.log("[Desktop] ← webSearchUpdated", data);
        widgetRef.current?.updateWebSearch();
        widgetRef.current?.updateMCPServer();
      }),
      crossPluginBus.subscribe("threadsUpdated", (data) => {
        console.log("[Desktop] ← threadsUpdated", data);
        widgetRef.current?.updateThreads();
      }),
      crossPluginBus.subscribe("extendedThinkingUpdated", (data) => {
        console.log("[Desktop] ← extendedThinkingUpdated", data);
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
      onMigrate={() => migrateProvidersToProfiles(storage)}
      callbacks={{
        onModelAssignmentUpdated: (data) => {
          console.log("[Desktop] → modelAssignmentUpdated", data);
          crossPluginBus.publish("modelAssignmentUpdated", data);
        },
        onCurrentChatProfileUpdated: (data) => {
          if (data.scope !== "persisted") return;
          console.log("[Desktop] → currentChatProfileUpdated", data);
          crossPluginBus.publish("currentChatProfileUpdated", data);
        },
        onProfilesUpdated: (data) => {
          console.log("[Desktop] → profilesUpdated", data);
          crossPluginBus.publish("profilesUpdated", data);
        },
        onServersUpdated: (data) => {
          console.log("[Desktop] → serversUpdated", data);
          crossPluginBus.publish("serversUpdated", data);
        },
        onWebSearchUpdated: (data) => {
          console.log("[Desktop] → webSearchUpdated", data);
          crossPluginBus.publish("webSearchUpdated", data);
        },
        onThreadsUpdated: (data) => {
          if (data.kind === "switched") return;
          console.log("[Desktop] → threadsUpdated", data);
          crossPluginBus.publish("threadsUpdated", data);
        },
        onExtendedThinkingUpdated: (data) => {
          console.log("[Desktop] → extendedThinkingUpdated", data);
          crossPluginBus.publish("extendedThinkingUpdated", data);
        },
      }}
    />
  );
};

export default App;
