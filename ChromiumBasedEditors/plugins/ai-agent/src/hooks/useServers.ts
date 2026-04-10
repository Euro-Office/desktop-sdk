import { useEffect } from "react";
import { provider } from "@/providers";
import useProfilesStore, {
  selectCurrentChatProfile,
} from "@/store/useProfilesStore";
import useServersStore from "@/store/useServersStore";
import { useToolsContext } from "../../npm_lib/tools/context";

type UseServersProps = {
  isReady: boolean;
};

const useServers = ({ isReady }: UseServersProps) => {
  const { initServers, getTools, tools } = useServersStore();
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const { servers, hostToolGroups } = useToolsContext();

  // Sync host tool groups into servers
  useEffect(() => {
    servers.hostToolSource.setGroups(hostToolGroups);
    getTools();
  }, [servers, hostToolGroups, getTools]);

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
