import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useEffect, useState } from "react";
import { Layout } from "./components/layout";
import { ManageToolDialog } from "./components/manage-tool-dialog";
import { chatDB, initChatDB } from "./database";
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
    initChatDB().then(async () => {
      await migrateProvidersToProfiles();
      setIsReady(true);
    });

    return () => {
      chatDB.close();
    };
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
