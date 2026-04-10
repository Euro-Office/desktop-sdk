import { useEffect } from "react";
import { useStores } from "../store/context";

type UseThreadProps = {
  isReady: boolean;
};

const useThread = ({ isReady }: UseThreadProps) => {
  const { useThreadsStore, usePromptsStore } = useStores();
  const { initThreads } = useThreadsStore();
  const { initPrompts } = usePromptsStore();

  useEffect(() => {
    if (!isReady) return;

    initThreads();
    initPrompts();
  }, [isReady, initThreads, initPrompts]);

  return {};
};

export default useThread;
