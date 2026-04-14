import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { AppContext } from "./app-context";
import { Layout } from "./components/layout";
import { ManageToolDialog } from "./components/manage-tool-dialog";
import type { StoreKeys } from "./config";
import { ChatEventBus } from "./events";
import useMessages from "./hooks/useMessages";
import useProfiles from "./hooks/useProfiles";
import useServers from "./hooks/useServers";
import useThread from "./hooks/useThreads";
import { initAIChatI18n } from "./i18n";
import Thread from "./pages/chat";

const EmptyScreen = lazy(() => import("./pages/empty-screen"));
const InitialSetup = lazy(() => import("./pages/initial-setup"));
const Settings = lazy(() => import("./pages/settings"));
import { PlatformProvider } from "./platform/context";
import type { PlatformAdapter } from "./platform/types";
import Provider from "./providers";
import { setProviderInstance } from "./providers/provider-holder";
import { SettingsProvider } from "./settings/context";
import { setSettingsInstance } from "./settings/settings-holder";
import type { SettingsAdapter } from "./settings/types";
import { StorageProvider } from "./storage/context";
import { setStorageInstance } from "./storage/storage-holder";
import type { StorageAdapter } from "./storage/types";
import { StoresProvider, useStores } from "./store/context";
import { createStores } from "./store/create-stores";
import { ToolsProvider } from "./tools/context";
import Servers from "./tools/servers";
import { setServersInstance } from "./tools/tools-holder";
import type { HostToolGroup } from "./tools/types";

export interface AIChatWidgetProps {
  storage: StorageAdapter;
  settings: SettingsAdapter;
  platform: PlatformAdapter;
  locale?: string;
  translations?: Record<string, { translation: object }>;
  theme?: string;
  storeKeys: StoreKeys;
  hostToolGroups?: HostToolGroup[];
  onMigrate?: () => Promise<void>;
}

export const AIChatWidget = ({
  storage,
  settings,
  platform,
  locale,
  translations,
  storeKeys,
  hostToolGroups: hostToolGroupsProp,
  onMigrate,
}: AIChatWidgetProps) => {
  // Initialize i18n lazily (only loads requested locale + English fallback)
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    initAIChatI18n({ locale, resources: translations })
      .then(() => setI18nReady(true))
      .catch((err) => {
        console.error("i18n init failed:", err);
      });
  }, [locale, translations]);

  // Build AppContext — single DI container for this widget instance
  const { ctx, stores } = useMemo(() => {
    const provider = new Provider();
    provider.setSettings(settings);
    const eventBus = new ChatEventBus();
    const servers = new Servers(settings, platform, eventBus);

    const ctx: AppContext = {
      settings,
      storage,
      platform,
      provider,
      servers,
      eventBus,
    };

    // Deprecated: set global holders for backward compatibility
    setProviderInstance(provider);
    setSettingsInstance(settings);
    setStorageInstance(storage);
    setServersInstance(servers);

    const stores = createStores({ keys: storeKeys, ctx });

    return { ctx, stores };
  }, [settings, storage, platform, storeKeys]);

  if (!i18nReady) return null;

  return (
    <SettingsProvider settings={settings}>
      <PlatformProvider platform={platform}>
        <StoresProvider stores={stores}>
          <AppWithTools
            storage={storage}
            hostToolGroupsProp={hostToolGroupsProp}
            onMigrate={onMigrate}
            servers={ctx.servers}
            eventBus={ctx.eventBus}
          />
        </StoresProvider>
      </PlatformProvider>
    </SettingsProvider>
  );
};

/** Reads platform from context to build host tool groups, then wraps in ToolsProvider + StorageProvider */
const AppWithTools = ({
  storage,
  hostToolGroupsProp,
  onMigrate,
  servers,
  eventBus,
}: {
  storage: StorageAdapter;
  hostToolGroupsProp?: HostToolGroup[];
  onMigrate?: () => Promise<void>;
  servers: Servers;
  eventBus: ChatEventBus;
}) => {
  const hostToolGroups: HostToolGroup[] = useMemo(() => {
    if (hostToolGroupsProp) return hostToolGroupsProp;
    return [];
  }, [hostToolGroupsProp]);

  return (
    <ToolsProvider hostToolGroups={hostToolGroups} servers={servers} eventBus={eventBus}>
      <StorageProvider storage={storage}>
        <AppInner onMigrate={onMigrate} />
      </StorageProvider>
    </ToolsProvider>
  );
};

const AppInner = ({
  onMigrate,
}: {
  onMigrate?: () => Promise<void>;
}) => {
  const [isReady, setIsReady] = useState(false);
  const [isManageToolOpen, setIsManageToolOpen] = useState(false);

  const {
    useMessageStore,
    useProfilesStore,
    useServersStore,
    useRouter,
    useCloudsStore,
  } = useStores();

  const { messages, stopMessage } = useMessageStore();
  const { currentPage } = useRouter();
  const { manageToolData, setManageToolData } = useServersStore();
  const { profiles } = useProfilesStore();
  const { fetchClouds } = useCloudsStore();

  useThread({ isReady });
  useServers({ isReady });
  useProfiles({ isReady });

  const { onNew, approveToolCall, denyToolCall } = useMessages({
    isReady,
  });

  useEffect(() => {
    if (manageToolData) setIsManageToolOpen(true);
  }, [manageToolData]);

  useEffect(() => {
    fetchClouds();
  }, [fetchClouds]);

  useEffect(() => {
    if (onMigrate) {
      onMigrate()
        .then(() => setIsReady(true))
        .catch((err) => {
          console.error("Migration failed:", err);
          setIsReady(true);
        });
    } else {
      setIsReady(true);
    }
  }, [onMigrate]);

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    onNew,
    onCancel: async () => {
      stopMessage();
    },
    convertMessage: (m: ThreadMessageLike) => m,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
    },
  });

  if (currentPage !== "settings" && !profiles.length && !messages.length)
    return (
      <Layout>
        <Suspense fallback={null}>
          <EmptyScreen />
        </Suspense>
      </Layout>
    );

  return (
    <Layout>
      <AssistantRuntimeProvider runtime={runtime}>
        {currentPage === "settings" ? (
          <Suspense fallback={null}>
            <Settings />
          </Suspense>
        ) : currentPage === "initial-setup" ? (
          <Suspense fallback={null}>
            <InitialSetup />
          </Suspense>
        ) : (
          <Thread />
        )}
      </AssistantRuntimeProvider>
      {isManageToolOpen ? (
        <ManageToolDialog
          onAllow={approveToolCall}
          onDeny={denyToolCall}
          onClose={() => {
            setIsManageToolOpen(false);
            setManageToolData(undefined);
          }}
        />
      ) : null}
    </Layout>
  );
};
