import { useEffect } from "react";
import usePromptsStore from "@/store/usePromptsStore";
import useThreadsStore from "@/store/useThreadsStore";

type UseThreadProps = {
  isReady: boolean;
};

const useThread = ({ isReady }: UseThreadProps) => {
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
