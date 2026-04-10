import { useEffect } from "react";
import { getProviderInstance } from "../providers/provider-holder";
import { useStores } from "../store/context";
import { useToolsContext } from "../tools/context";

type UseServersProps = {
  isReady: boolean;
};

const useServers = ({ isReady }: UseServersProps) => {
  const { useServersStore, useProfilesStore, selectCurrentChatProfile } =
    useStores();
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

    getProviderInstance().setCurrentProviderTools(tools);
  }, [tools, currentProfile]);

  return {};
};

export default useServers;
