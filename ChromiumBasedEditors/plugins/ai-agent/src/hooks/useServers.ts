import { useEffect } from "react";
import { provider } from "@/providers";
import useProfilesStore, {
  selectCurrentProfile,
} from "@/store/useProfilesStore";
import useServersStore from "@/store/useServersStore";

type UseServersProps = {
  isReady: boolean;
};

const useServers = ({ isReady }: UseServersProps) => {
  const { initServers, getTools, tools } = useServersStore();
  const currentProfile = useProfilesStore(selectCurrentProfile);

  useEffect(() => {
    if (!isReady) return;

    initServers();
    getTools();

    const interval = setInterval(
      () => {
        getTools();
        // update tools every 5 minutes
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
