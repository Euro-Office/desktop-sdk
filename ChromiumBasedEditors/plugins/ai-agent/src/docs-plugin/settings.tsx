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
} from "@onlyoffice/ai-chat";
import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import { OnlyOfficePlatform } from "./platform/index";

const Settings = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const eventBus = useMemo(() => new ChatEventBus(), []);
  const callbacksManager = useMemo(() => new CallbacksManager(), []);
  const middlewareRunner = useMemo(() => new MiddlewareRunner([]), []);
  const provider = useMemo(() => new Provider(), []);
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
    <EventsProvider callbacksManager={callbacksManager}>
      <SettingsProvider settings={settings}>
        <PlatformProvider platform={platform}>
          <I18nProvider locale="en">
            <ComponentsProvider>
              <StoresProvider stores={stores}>
                <ThemeProvider>
                  <ImagesProvider>
                    <ToolsProvider
                      hostToolGroups={[]}
                      servers={servers}
                      eventBus={eventBus}
                    >
                      <StorageProvider storage={storage}>
                        <div style={{ padding: "20px 15px" }}>
                          <SettingsPage
                            isAddModelCardHorizontal
                            hideHeader
                            noPadding
                          />
                        </div>
                      </StorageProvider>
                    </ToolsProvider>
                  </ImagesProvider>
                </ThemeProvider>
              </StoresProvider>
            </ComponentsProvider>
          </I18nProvider>
        </PlatformProvider>
      </SettingsProvider>
    </EventsProvider>
  );
};

const container = document.getElementById("settings_window");

if (container) {
  createRoot(container).render(
    <StrictMode>
      <Settings />
    </StrictMode>
  );
}
