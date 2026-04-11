import React from "react";
import { useTranslation } from "react-i18next";
import { getProviderInstance } from "../../../providers/provider-holder";
import { ComboBox } from "../../../components/combo-box";
import { useStores } from "../../../store/context";
import type { Profile } from "../../../types";

const SelectModel = () => {
  const {
    useProfilesStore,
    useServersStore,
    useMessageStore,
    selectCurrentChatProfile,
  } = useStores();
  const { profiles, setSessionChatProfile } = useProfilesStore();
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const { tools } = useServersStore();
  const { messages } = useMessageStore();
  const { t } = useTranslation();

  const onSelectProfile = React.useCallback(
    (profile: Profile) => {
      if (currentProfile?.id === profile.id) return;

      setSessionChatProfile(profile);
      getProviderInstance().setCurrentProviderTools(tools);
      getProviderInstance().setCurrentProviderPrevMessages(messages);
    },
    [currentProfile, setSessionChatProfile, tools, messages]
  );

  React.useEffect(() => {
    if (!currentProfile && profiles.length > 0) {
      onSelectProfile(profiles[0]);
    }
  }, [currentProfile, profiles, onSelectProfile]);

  const items = profiles.map((p) => ({
    text: p.name,
    id: p.id,
    onClick: () => onSelectProfile(p),
    checked: p.id === currentProfile?.id,
  }));

  return (
    <ComboBox
      placeholder={t("SelectModel")}
      value={currentProfile?.name ?? ""}
      items={items}
      withoutBg
      data-testid="model-selector"
    />
  );
};

export { SelectModel };
