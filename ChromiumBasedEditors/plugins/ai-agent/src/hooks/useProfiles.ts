import { useEffect } from "react";
import useProfilesStore from "@/store/useProfilesStore";

type UseProfilesProps = {
  isReady: boolean;
};

const useProfiles = ({ isReady }: UseProfilesProps) => {
  const { init } = useProfilesStore();

  useEffect(() => {
    if (!isReady) return;

    init();
  }, [isReady, init]);

  return {};
};

export default useProfiles;
