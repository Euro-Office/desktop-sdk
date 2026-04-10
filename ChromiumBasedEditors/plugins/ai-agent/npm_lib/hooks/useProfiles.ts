import { useEffect } from "react";
import { useStores } from "../store/context";

type UseProfilesProps = {
  isReady: boolean;
};

const useProfiles = ({ isReady }: UseProfilesProps) => {
  const { useProfilesStore } = useStores();
  const { init } = useProfilesStore();

  useEffect(() => {
    if (!isReady) return;

    init();
  }, [isReady, init]);

  return {};
};

export default useProfiles;
