import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Layout } from "./components/layout";
import { ManageToolDialog } from "./components/manage-tool-dialog";
import type { FeatureFlags, StoreKeys } from "./config";
import { DEFAULT_FEATURE_FLAGS, DEFAULT_STORE_KEYS } from "./config";
import useMessages from "./hooks/useMessages";
import useProfiles from "./hooks/useProfiles";
import useServers from "./hooks/useServers";
import useThread from "./hooks/useThreads";
import { initAIChatI18n } from "./i18n";
import Thread from "./pages/chat";
const EmptyScreen = lazy(() => import("./pages/empty-screen"));
const InitialSetup = lazy(() => import("./pages/initial-setup"));
const Settings = lazy(() => import("./pages/settings"));
import { PlatformProvider, usePlatform } from "./platform/context";
import type { PlatformAdapter } from "./platform/types";
import Provider from "./providers";
import { setProviderInstance } from "./providers/provider-holder";
import { SettingsProvider } from "./settings/context";
import type { SettingsAdapter } from "./settings/types";
import { StorageProvider } from "./storage/context";
import type { StorageAdapter } from "./storage/types";
import { StoresProvider, useStores } from "./store/context";
import { createStores } from "./store/create-stores";
import { ToolsProvider } from "./tools/context";
import type { HostToolGroup } from "./tools/types";

export interface AIChatWidgetProps {
  storage: StorageAdapter;
  settings: SettingsAdapter;
  platform: PlatformAdapter;
  locale?: string;
  translations?: Record<string, { translation: object }>;
  theme?: string;
  storeKeys?: Partial<StoreKeys>;
  features?: Partial<FeatureFlags>;
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
  features,
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

  // Create Provider instance
  useMemo(() => {
    const p = new Provider();
    setProviderInstance(p);
    return p;
  }, []);

  // Create stores with optional custom keys
  const stores = useMemo(
    () =>
      createStores(
        storeKeys
          ? { keys: { ...DEFAULT_STORE_KEYS, ...storeKeys } }
          : undefined
      ),
    [storeKeys]
  );

  const mergedFeatures = useMemo(
    () => ({ ...DEFAULT_FEATURE_FLAGS, ...features }),
    [features]
  );

  if (!i18nReady) return null;

  return (
    <SettingsProvider settings={settings}>
      <PlatformProvider platform={platform}>
        <StoresProvider stores={stores}>
          <AppWithTools
            storage={storage}
            hostToolGroupsProp={hostToolGroupsProp}
            onMigrate={onMigrate}
            features={mergedFeatures}
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
  features,
}: {
  storage: StorageAdapter;
  hostToolGroupsProp?: HostToolGroup[];
  onMigrate?: () => Promise<void>;
  features: FeatureFlags;
}) => {
  const platform = usePlatform();

  const hostToolGroups: HostToolGroup[] = useMemo(() => {
    if (hostToolGroupsProp) return hostToolGroupsProp;

    const ht = platform.hostTools;
    if (!ht) return [];

    const tools = ht.getTools();
    if (!tools.length) return [];

    return [
      {
        id: "desktop-editor",
        name: "Desktop Editor",
        tools: tools.map((tool) => ({
          ...tool,
          handler: (args: Record<string, unknown>) =>
            ht.callTool(tool.name, args),
        })),
      },
    ];
  }, [platform.hostTools, hostToolGroupsProp]);

  return (
    <ToolsProvider hostToolGroups={hostToolGroups}>
      <StorageProvider storage={storage}>
        <AppInner onMigrate={onMigrate} features={features} />
      </StorageProvider>
    </ToolsProvider>
  );
};

const AppInner = ({
  onMigrate,
  features: _features,
}: {
  onMigrate?: () => Promise<void>;
  features: FeatureFlags;
}) => {
  const [isReady, setIsReady] = useState(false);
  const [isManageToolOpen, setIsManageToolOpen] = useState(false);

  const { useMessageStore, useProfilesStore, useServersStore, useRouter } =
    useStores();

  const { messages, stopMessage } = useMessageStore();
  const { currentPage } = useRouter();
  const { manageToolData, setManageToolData } = useServersStore();
  const { profiles } = useProfilesStore();

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
