import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/button";
import { ModelCard } from "../../components/model-card";
import { AddModelCard } from "../../components/model-config-cards";
import { useStores } from "../../store/context";

const InitialSetup = () => {
  const { t } = useTranslation();
  const { useProfilesStore } = useStores();
  const { profiles } = useProfilesStore();
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  return (
    <div className="flex justify-center h-full w-full bg-[var(--layout-background-color)] py-[24px]">
      <div className="w-full max-w-[560px] flex flex-col">
        <h1 className="select-none text-[20px] font-bold leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
          {t("AIModels")}
        </h1>
        <p className="select-none leading-[20px] text-[var(--settings-description-color)] mb-[16px]">
          {t("AIModelsDescription")}
        </p>

        {isAddCardOpen ? (
          <AddModelCard onClose={() => setIsAddCardOpen(false)} isHorizontal />
        ) : (
          <Button
            className="self-start mb-[16px]"
            onClick={() => setIsAddCardOpen(true)}
          >
            {t("AddModel")}
          </Button>
        )}

        <div className="flex flex-col gap-[16px]">
          {profiles.map((profile) => (
            <ModelCard key={profile.id} profile={profile} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default InitialSetup;
