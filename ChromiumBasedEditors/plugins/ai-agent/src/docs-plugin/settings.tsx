import {
  CallbacksManager,
  ChatEventBus,
  ComponentsProvider,
  createStores,
  EventsProvider,
  I18nProvider,
  ImagesProvider,
  MiddlewareRunner,
  PlatformProvider,
  Provider,
  Servers,
  SettingsPage,
  SettingsProvider,
  StorageProvider,
  StoresProvider,
  ThemeProvider,
  ToolsProvider,
  useProfiles,
  useServers,
  useStores,
  useToolsContext,
  WidgetConfigProvider,
} from "@onlyoffice/ai-chat";
import { StrictMode, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import type { CrossPluginEvents } from "@/shared/sync/crossPluginBus";
import { editor } from "./library/editor";
import { install as installLibrary } from "./library/index";
import { OnlyOfficePlatform } from "./platform/index";
import { createHostToolGroups } from "./tools";

type SyncPayload = {
  [K in keyof CrossPluginEvents]: { event: K; data: CrossPluginEvents[K] };
}[keyof CrossPluginEvents];

const SettingsInit = () => {
  const { useCloudsStore, useProfilesStore, useServersStore } = useStores();
  const { fetchClouds } = useCloudsStore();
  const { servers } = useToolsContext();

  useProfiles({ isReady: true });
  useServers({ isReady: true });

  useEffect(() => {
    fetchClouds();
  }, [fetchClouds]);

  useEffect(() => {
    window.Asc.plugin.attachEvent("onAiStateChanged", (raw) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as SyncPayload)
          : (raw as SyncPayload);

      console.log(`[Docs settings] ← ${payload.event}`, payload.data);

      switch (payload.event) {
        case "modelAssignmentUpdated":
          useProfilesStore.getState().reloadCurrentChat();
          useProfilesStore.getState().reloadModelAssignment();
          return;
        case "currentChatProfileUpdated":
          useProfilesStore.getState().reloadCurrentChat();
          return;
        case "profilesUpdated":
          useProfilesStore.getState().reloadProfiles();
          return;
        case "serversUpdated":
          useServersStore.getState().reload();
          return;
        case "webSearchUpdated":
          servers.webSearch.reload();
          return;
      }
    });

    return () => {
      window.Asc.plugin.detachEvent("onAiStateChanged");
    };
  }, [useProfilesStore, useServersStore, servers]);

  return <SettingsPage hideHeader noPadding isWebSearchHorizontal={false} />;
};

const Settings = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const eventBus = useMemo(() => new ChatEventBus(), []);
  const callbacksManager = useMemo(() => new CallbacksManager(), []);
  const middlewareRunner = useMemo(() => new MiddlewareRunner([]), []);
  const hostToolGroups = useMemo(
    () => createHostToolGroups(editor.getType()),
    []
  );
  const provider = useMemo(() => {
    const p = new Provider();
    p.setSettings(settings);
    return p;
  }, [settings]);
  const servers = useMemo(
    () => new Servers(settings, platform, eventBus, callbacksManager),
    [settings, platform, eventBus, callbacksManager]
  );
  const stores = useMemo(
    () =>
      createStores({
        keys: DEFAULT_STORE_KEYS,
        ctx: {
          settings,
          storage,
          platform,
          provider,
          servers,
          eventBus,
          callbacksManager,
          middlewareRunner,
        },
      }),
    [
      settings,
      storage,
      platform,
      provider,
      servers,
      eventBus,
      callbacksManager,
      middlewareRunner,
    ]
  );

  return (
    <EventsProvider
      callbacksManager={callbacksManager}
      callbacks={{
        onModelAssignmentUpdated: (data) => {
          console.log("[Docs settings] → modelAssignmentUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "modelAssignmentUpdated",
            data,
          });
        },
        onCurrentChatProfileUpdated: (data) => {
          if (data.scope !== "persisted") return;
          console.log("[Docs settings] → currentChatProfileUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "currentChatProfileUpdated",
            data,
          });
        },
        onProfilesUpdated: (data) => {
          console.log("[Docs settings] → profilesUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "profilesUpdated",
            data,
          });
        },
        onServersUpdated: (data) => {
          console.log("[Docs settings] → serversUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "serversUpdated",
            data,
          });
        },
        onWebSearchUpdated: (data) => {
          console.log("[Docs settings] → webSearchUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "webSearchUpdated",
            data,
          });
        },
      }}
    >
      <SettingsProvider settings={settings}>
        <PlatformProvider platform={platform}>
          <I18nProvider locale={platform.env.locale ?? "en"}>
            <ComponentsProvider>
              <WidgetConfigProvider config={{ isDialogFullscreen: true }}>
                <StoresProvider stores={stores}>
                  <ThemeProvider>
                    <ImagesProvider>
                      <ToolsProvider
                        hostToolGroups={hostToolGroups}
                        servers={servers}
                        eventBus={eventBus}
                      >
                        <StorageProvider storage={storage}>
                          <div
                            style={{
                              padding: "20px 15px",
                              height: "100vh",
                              width: "100vw",
                            }}
                          >
                            <SettingsInit />
                          </div>
                        </StorageProvider>
                      </ToolsProvider>
                    </ImagesProvider>
                  </ThemeProvider>
                </StoresProvider>
              </WidgetConfigProvider>
            </ComponentsProvider>
          </I18nProvider>
        </PlatformProvider>
      </SettingsProvider>
    </EventsProvider>
  );
};

window.Asc.plugin.init = () => {
  installLibrary();

  const container = document.getElementById("settings_window");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <Settings />
      </StrictMode>
    );
  }
};
