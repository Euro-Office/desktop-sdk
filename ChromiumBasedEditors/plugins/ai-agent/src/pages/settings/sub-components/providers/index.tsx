import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import useProviders from "@/store/useProviders";
import { AddProviderDialog } from "./AddProviderDialog";
import { ProviderItem } from "./ProviderItem";

type ProvidersProps = {
  isActive: boolean;
};

const Providers = ({ isActive }: ProvidersProps) => {
  const [addProviderVisible, setAddProviderVisible] = React.useState(false);

  const { providers } = useProviders();

  const { t } = useTranslation();

  return (
    <>
      <Button
        className="max-w-[fit-content]"
        onClick={() => setAddProviderVisible(true)}
        disabled={!isActive}
      >
        {t("AddProvider")}
      </Button>

      <div
        className={cn(
          "flex flex-wrap gap-[16px]",
          isActive ? "" : "opacity-70 pointer-events-none"
        )}
      >
        {providers.map((provider) => (
          <ProviderItem key={provider.name} provider={provider} />
        ))}
      </div>
      {addProviderVisible ? (
        <AddProviderDialog onClose={() => setAddProviderVisible(false)} />
      ) : null}
    </>
  );
};

export { Providers };
