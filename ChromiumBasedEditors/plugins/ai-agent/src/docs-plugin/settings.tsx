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
  WidgetConfigProvider,
} from "@onlyoffice/ai-chat";
import { StrictMode, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import { OnlyOfficePlatform } from "./platform/index";

const SettingsInit = () => {
  const { useCloudsStore } = useStores();
  const { fetchClouds } = useCloudsStore();

  useProfiles({ isReady: true });
  useServers({ isReady: true });

  useEffect(() => {
    fetchClouds();
  }, [fetchClouds]);

  return <SettingsPage hideHeader noPadding isWebSearchHorizontal={false} />;
};

const Settings = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const eventBus = useMemo(() => new ChatEventBus(), []);
  const callbacksManager = useMemo(() => new CallbacksManager(), []);
  const middlewareRunner = useMemo(() => new MiddlewareRunner([]), []);
  const provider = useMemo(() => {
    const p = new Provider();
    p.setSettings(settings);
    return p;
  }, [settings]);
  const servers = useMemo(
    () => new Servers(settings, platform, eventBus),
    [settings, platform, eventBus]
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
        onProfileChanged: (data) =>
          window.Asc.plugin.sendToPlugin("onSettingsChanged", {
            event: "profileChanged",
            data,
          }),
        onProfileCreated: (data) =>
          window.Asc.plugin.sendToPlugin("onSettingsChanged", {
            event: "profileCreated",
            data,
          }),
        onProfileDeleted: (data) =>
          window.Asc.plugin.sendToPlugin("onSettingsChanged", {
            event: "profileDeleted",
            data,
          }),
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
                        hostToolGroups={[]}
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
  const container = document.getElementById("settings_window");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <Settings />
      </StrictMode>
    );
  }
};
