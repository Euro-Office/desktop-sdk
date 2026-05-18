import "../shared/index.css";
import {
  AIEngine,
  ApiProvider,
  AssignmentsEngine,
  CallbacksManager,
  ChatEventBus,
  ComponentsProvider,
  createServerAPI,
  createStores,
  DEFAULT_SERVER_API_ROUTES,
  EventsProvider,
  I18nProvider,
  ImagesProvider,
  MiddlewareRunner,
  PlatformProvider,
  PreferencesEngine,
  ProfilesEngine,
  PromptsEngine,
  Servers,
  SettingsPage,
  StoresProvider,
  ThemeProvider,
  ThreadsEngine,
  ToolsEngine,
  ToolsProvider,
  useApi,
  useProfiles,
  useServers,
  useStores,
  WebSearchEngine,
  WidgetConfigProvider,
} from "@onlyoffice/ai-chat";
import { AttachmentsEngine } from "@onlyoffice/ai-chat/services";
import { StrictMode, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import type { CrossPluginEvents } from "@/shared/sync/crossPluginBus";
import {
  applyCustomProvidersDelta,
  bootstrapCustomProviders,
} from "./custom-providers/bootstrap";
import { install as installLibrary } from "./library/index";
import { OnlyOfficePlatform } from "./platform/index";

type SyncPayload = {
  [K in keyof CrossPluginEvents]: { event: K; data: CrossPluginEvents[K] };
}[keyof CrossPluginEvents];

const SettingsInit = () => {
  const { useProfilesStore, useServersStore } = useStores();
  const api = useApi();

  useProfiles({ isReady: true });
  useServers({ isReady: true });

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
          api.webSearch.clear();
          return;
        case "customProvidersUpdated":
          applyCustomProvidersDelta(payload.data.providers);
          useProfilesStore.getState().reloadProfiles();
          return;
      }
    });

    return () => {
      window.Asc.plugin.detachEvent("onAiStateChanged");
    };
  }, [useProfilesStore, useServersStore, api]);

  return <SettingsPage hideHeader noPadding isWebSearchHorizontal={false} />;
};

const Settings = () => {
  const storage = useMemo(() => sharedStorage, []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const eventBus = useMemo(() => new ChatEventBus(), []);
  const callbacksManager = useMemo(() => new CallbacksManager(), []);
  const middlewareRunner = useMemo(() => new MiddlewareRunner([]), []);
  const { ctx, stores, engines, serverApiConfig } = useMemo(() => {
    const assignments = new AssignmentsEngine({ storage });
    const profiles = new ProfilesEngine({ storage, assignments });
    const threads = new ThreadsEngine({ storage });
    const tools = new ToolsEngine({ storage });
    const prompts = new PromptsEngine({ storage });
    const webSearch = new WebSearchEngine({ storage });
    const preferences = new PreferencesEngine({ storage });
    const attachments = new AttachmentsEngine({ storage });
    const ai = new AIEngine({ storage, assignments, threads });

    const servers = new Servers(platform, eventBus);

    const ctx = {
      storage,
      platform,
      servers,
      eventBus,
      callbacksManager,
      middlewareRunner,
    };

    const engines = {
      ai,
      assignments,
      attachments,
      preferences,
      profiles,
      prompts,
      threads,
      tools,
      webSearch,
    };

    const serverApiConfig = {
      origin: "",
      baseUrl: "",
      routes: DEFAULT_SERVER_API_ROUTES,
    };

    const api = createServerAPI(serverApiConfig, engines);
    const stores = createStores({
      keys: DEFAULT_STORE_KEYS,
      ctx,
      api,
    });

    return { ctx, stores, engines, serverApiConfig };
  }, [storage, platform, eventBus, callbacksManager, middlewareRunner]);

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
      <PlatformProvider platform={platform}>
        <I18nProvider locale={platform.env.locale ?? "en"}>
          <ComponentsProvider>
            <WidgetConfigProvider
              config={{
                isDialogFullscreen: true,
                onProfileImportClick: () => {
                  window.Asc.plugin.sendToPlugin(
                    "ai-open-custom-providers",
                    {}
                  );
                },
              }}
            >
              <ApiProvider config={serverApiConfig} engines={engines}>
                <StoresProvider stores={stores}>
                  <ThemeProvider>
                    <ImagesProvider>
                      <ToolsProvider
                        hostToolGroups={[]}
                        servers={ctx.servers}
                        eventBus={eventBus}
                      >
                        <div
                          style={{
                            padding: "20px 15px",
                            height: "100vh",
                            width: "100vw",
                          }}
                        >
                          <SettingsInit />
                        </div>
                      </ToolsProvider>
                    </ImagesProvider>
                  </ThemeProvider>
                </StoresProvider>
              </ApiProvider>
            </WidgetConfigProvider>
          </ComponentsProvider>
        </I18nProvider>
      </PlatformProvider>
    </EventsProvider>
  );
};

const sharedStorage = new IndexedDBStorage();

window.Asc.plugin.init = async () => {
  await sharedStorage.init();
  installLibrary();
  bootstrapCustomProviders();

  const container = document.getElementById("settings_window");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <Settings />
      </StrictMode>
    );
  }
};
