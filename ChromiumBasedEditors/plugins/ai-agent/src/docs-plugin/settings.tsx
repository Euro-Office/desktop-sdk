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
  WebSearchEngine,
  WidgetConfigProvider,
} from "@onlyoffice/ai-chat";
import { AttachmentsEngine } from "@onlyoffice/ai-chat/services";
import { StrictMode, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import {
  bootstrapCustomProviders,
  registerCustomProvider,
} from "@/shared/custom-providers/bootstrap";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import { OnlyOfficePlatform } from "./platform/index";

type SettingsChangeKind =
  | "profiles"
  | "currentChatProfile"
  | "modelAssignment"
  | "servers"
  | "webSearch";

function notifySettingsChanged(kind: SettingsChangeKind, data: unknown): void {
  console.log(`[Docs settings] → onAiSettingsChanged/${kind}`, data);
  window.Asc.plugin.sendToPlugin("onAiSettingsChanged", { kind, data });
}

function reportError(text: string): void {
  console.warn(`[Docs settings] ${text}`);
  window.Asc.plugin.sendToPlugin("ai-show-error", { text });
}

const Settings = () => {
  const storage = useMemo(() => sharedStorage, []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const eventBus = useMemo(() => new ChatEventBus(), []);
  const callbacksManager = useMemo(() => new CallbacksManager(), []);
  const middlewareRunner = useMemo(() => new MiddlewareRunner([]), []);
  const [providerListVersion, setProviderListVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const importProvider = async (file: File): Promise<void> => {
    if (!file.name.toLowerCase().endsWith(".js")) {
      reportError(`"${file.name}": expected a .js file`);
      return;
    }
    let source: string;
    try {
      source = await file.text();
    } catch {
      reportError(`Could not read "${file.name}"`);
      return;
    }
    const result = await registerCustomProvider(storage, source);
    if (!result.ok) {
      reportError(`Failed to import "${file.name}": ${result.reason}`);
      return;
    }
    setProviderListVersion((v) => v + 1);
  };

  const handleFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const files = event.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        await importProvider(file);
      }
    }
    event.target.value = "";
  };

  return (
    <EventsProvider
      callbacksManager={callbacksManager}
      callbacks={{
        onProfilesUpdated: (data) => notifySettingsChanged("profiles", data),
        onCurrentChatProfileUpdated: (data) => {
          if (data.scope !== "persisted") return;
          notifySettingsChanged("currentChatProfile", data);
        },
        onModelAssignmentUpdated: (data) =>
          notifySettingsChanged("modelAssignment", data),
        onServersUpdated: (data) => notifySettingsChanged("servers", data),
        onWebSearchUpdated: (data) => notifySettingsChanged("webSearch", data),
      }}
    >
      <PlatformProvider platform={platform}>
        <I18nProvider locale={platform.env.locale ?? "en"}>
          <ComponentsProvider>
            <WidgetConfigProvider
              config={{
                isDialogFullscreen: true,
                onProfileImportClick: () => {
                  fileInputRef.current?.click();
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
                          <SettingsPage
                            key={providerListVersion}
                            hideHeader
                            noPadding
                            isWebSearchHorizontal={false}
                          />
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".js"
                          multiple
                          onChange={handleFileInputChange}
                          style={{ display: "none" }}
                        />
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
  await bootstrapCustomProviders(sharedStorage);

  const container = document.getElementById("settings_window");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <Settings />
      </StrictMode>
    );
  }
};
