import { useEffect } from "react";
import { provider } from "@/providers";
import server from "@/servers";
import useProfilesStore, {
  selectCurrentChatProfile,
} from "@/store/useProfilesStore";
import useServersStore from "@/store/useServersStore";
import { useHostTools } from "../../npm_lib/tools/context";

type UseServersProps = {
  isReady: boolean;
};

const useServers = ({ isReady }: UseServersProps) => {
  const { initServers, getTools, tools } = useServersStore();
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const { hostToolGroups } = useHostTools();

  // Sync host tool groups into the Servers singleton
  useEffect(() => {
    server.hostToolSource.setGroups(hostToolGroups);
    getTools();
  }, [hostToolGroups, getTools]);

  useEffect(() => {
    if (!isReady) return;

    initServers();
    getTools();

    const interval = setInterval(
      () => {
        getTools();
      },
      1000 * 60 * 5
    );

    return () => {
      clearInterval(interval);
    };
  }, [isReady, initServers, getTools]);

  useEffect(() => {
    const handler = () => {
      getTools();
    };

    window.addEventListener("tools-changed", handler);

    return () => {
      window.removeEventListener("tools-changed", handler);
    };
  }, [getTools]);

  useEffect(() => {
    if (!tools || !currentProfile) return;

    provider.setCurrentProviderTools(tools);
  }, [tools, currentProfile]);

  return {};
};

export default useServers;
