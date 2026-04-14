import React from "react";
import { useTranslation } from "react-i18next";
import { CapabilitiesUI } from "../../../capabilities";
import { ComboBox } from "../../../components/combo-box";
import { useStores } from "../../../store/context";
import type { Profile } from "../../../types";

const SelectModel = () => {
  const {
    useProfilesStore,
    useServersStore,
    useMessageStore,
    selectCurrentChatProfile,
    provider,
  } = useStores();
  const { profiles, setSessionChatProfile } = useProfilesStore();
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const { tools } = useServersStore();
  const { messages } = useMessageStore();
  const { t } = useTranslation();

  const chatProfiles = profiles.filter(
    (p) => !p.capabilities || (p.capabilities & CapabilitiesUI.Chat) !== 0
  );

  const onSelectProfile = React.useCallback(
    (profile: Profile) => {
      if (currentProfile?.id === profile.id) return;

      setSessionChatProfile(profile);
      provider.setCurrentProviderTools(tools);
      provider.setCurrentProviderPrevMessages(messages);
    },
    [currentProfile, setSessionChatProfile, tools, messages]
  );

  React.useEffect(() => {
    if (!currentProfile && chatProfiles.length > 0) {
      onSelectProfile(chatProfiles[0]);
    }
  }, [currentProfile, chatProfiles, onSelectProfile]);

  const items = chatProfiles.map((p) => ({
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
