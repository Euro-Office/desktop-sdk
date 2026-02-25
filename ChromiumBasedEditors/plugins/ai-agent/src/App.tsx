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
import useServers from "./hooks/useServers";
import useThread from "./hooks/useThreads";
import Thread from "./pages/chat";
import EmptyScreen from "./pages/empty-screen";
import Settings from "./pages/settings";
import useMessageStore from "./store/useMessageStore";
import useProviders from "./store/useProviders";
import useRouter from "./store/useRouter";
import useServersStore from "./store/useServersStore";

import "./i18n";

const App = () => {
  const [isReady, setIsReady] = useState(false);

  const [isManageToolOpen, setIsManageToolOpen] = useState(false);

  const { messages, stopMessage } = useMessageStore();
  const { providers, fetchProvidersModels } = useProviders();
  const { currentPage } = useRouter();
  const { manageToolData } = useServersStore();

  useThread({
    isReady,
  });

  useServers({
    isReady,
  });

  const { onNew, convertMessage, approveToolCall, denyToolCall } = useMessages({
    isReady,
  });

  useEffect(() => {
    if (providers.length) fetchProvidersModels();
  }, [providers.length, fetchProvidersModels]);

  useEffect(() => {
    if (manageToolData) setIsManageToolOpen(true);
  }, [manageToolData]);

  useEffect(() => {
    initChatDB().then(() => setIsReady(true));

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

  if (currentPage !== "settings" && !providers.length && !messages.length)
    return (
      <Layout>
        <EmptyScreen />
      </Layout>
    );

  return (
    <Layout>
      <AssistantRuntimeProvider runtime={runtime}>
        {currentPage === "settings" ? <Settings /> : <Thread />}
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
