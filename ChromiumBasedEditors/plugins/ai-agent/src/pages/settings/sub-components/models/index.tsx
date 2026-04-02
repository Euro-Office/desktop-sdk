import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { ModelCard } from "@/components/model-card";
import { AddModelCard } from "@/components/model-config-cards";
import useProfilesStore from "@/store/useProfilesStore";

export const Models = () => {
  const { t } = useTranslation();
  const { profiles } = useProfilesStore();
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  return (
    <div className="flex flex-col gap-[16px] select-none">
      {isAddCardOpen ? (
        <AddModelCard onClose={() => setIsAddCardOpen(false)} />
      ) : (
        <Button className="self-start" onClick={() => setIsAddCardOpen(true)}>
          {t("AddModel")}
        </Button>
      )}

      <div className="flex flex-col gap-[16px]">
        {profiles.map((profile) => (
          <ModelCard key={profile.id} profile={profile} />
        ))}
      </div>
    </div>
  );
};
