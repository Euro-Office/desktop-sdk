import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useEffect, useMemo, useState } from "react";
import { isDesktopEditor } from "@/lib/utils";
import { NoopPlatform } from "@/platform/noop";
import { OnlyOfficePlatform } from "@/platform/onlyoffice";
import { IndexedDBStorage } from "@/storage/indexeddb";
import { PlatformProvider, usePlatform } from "../npm_lib/platform/context";
import Provider from "../npm_lib/providers";
import { setProviderInstance } from "../npm_lib/providers/provider-holder";
import { StorageProvider } from "../npm_lib/storage/context";
import { ToolsProvider } from "../npm_lib/tools/context";
import type { HostToolGroup } from "../npm_lib/tools/types";
import { Layout } from "./components/layout";
import { ManageToolDialog } from "./components/manage-tool-dialog";
import useMessages from "./hooks/useMessages";
import useProfiles from "./hooks/useProfiles";
import useServers from "./hooks/useServers";
import useThread from "./hooks/useThreads";
import { migrateProvidersToProfiles } from "./lib/migrateProvidersToProfiles";
import Thread from "./pages/chat";
import EmptyScreen from "./pages/empty-screen";
import InitialSetup from "./pages/initial-setup";
import Settings from "./pages/settings";
import useMessageStore from "./store/useMessageStore";
import useProfilesStore from "./store/useProfilesStore.ts";
import useRouter from "./store/useRouter";
import useServersStore from "./store/useServersStore";

import "./i18n";

const App = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const platform = useMemo(
    () => (isDesktopEditor() ? new OnlyOfficePlatform() : new NoopPlatform()),
    []
  );

  // Create Provider instance and set global holder
  useMemo(() => {
    const p = new Provider();
    setProviderInstance(p);
    return p;
  }, []);

  return (
    <PlatformProvider platform={platform}>
      <AppWithTools storage={storage} />
    </PlatformProvider>
  );
};

/** Reads platform from context to build host tool groups, then wraps in ToolsProvider + StorageProvider */
const AppWithTools = ({ storage }: { storage: IndexedDBStorage }) => {
  const platform = usePlatform();

  const hostToolGroups: HostToolGroup[] = useMemo(() => {
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
  }, [platform.hostTools]);

  return (
    <ToolsProvider hostToolGroups={hostToolGroups}>
      <StorageProvider storage={storage}>
        <AppInner />
      </StorageProvider>
    </ToolsProvider>
  );
};

const AppInner = () => {
  const [isReady, setIsReady] = useState(false);

  const [isManageToolOpen, setIsManageToolOpen] = useState(false);

  const { messages, stopMessage } = useMessageStore();
  const { currentPage } = useRouter();
  const { manageToolData } = useServersStore();
  const { profiles } = useProfilesStore();

  useThread({
    isReady,
  });

  useServers({
    isReady,
  });

  useProfiles({
    isReady,
  });

  const { onNew, convertMessage, approveToolCall, denyToolCall } = useMessages({
    isReady,
  });

  useEffect(() => {
    if (manageToolData) setIsManageToolOpen(true);
  }, [manageToolData]);

  useEffect(() => {
    migrateProvidersToProfiles().then(() => setIsReady(true));
  }, []);

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    onNew,
    onCancel: async () => {
      stopMessage();
    },
    convertMessage,
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
        <EmptyScreen />
      </Layout>
    );

  return (
    <Layout>
      <AssistantRuntimeProvider runtime={runtime}>
        {currentPage === "settings" ? (
          <Settings />
        ) : currentPage === "initial-setup" ? (
          <InitialSetup />
        ) : (
          <Thread />
        )}
      </AssistantRuntimeProvider>
      {isManageToolOpen ? (
        <ManageToolDialog
          onAllow={approveToolCall}
          onDeny={denyToolCall}
          onClose={() => setIsManageToolOpen(false)}
        />
      ) : null}
    </Layout>
  );
};

export default App;
