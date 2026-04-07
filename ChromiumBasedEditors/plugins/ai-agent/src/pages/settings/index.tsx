import React from "react";
import { useTranslation } from "react-i18next";
import { ModelAssignment } from "@/components/model-assignment";
import { RadioButton } from "@/components/radio-button";
import { Tabs } from "@/components/tabs";
import config from "@/config.json";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import useProfilesStore from "@/store/useProfilesStore";
import { Models } from "./sub-components/models";
import { Servers } from "./sub-components/servers";
import { Wallet } from "./sub-components/wallet";
import { WebSearch } from "./sub-components/web-search";

const showWallet = config.showWallet;

const Settings = () => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();

  const [selectedSection, setSelectedSection] = React.useState(
    showWallet ? "wallet" : "providers"
  );

  const profiles = useProfilesStore((s) => s.profiles);

  const aiSettingsTab = (
    <div className="flex flex-col gap-[16px] select-none max-w-full">
      {showWallet ? (
        <div>
          <h3 className="font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)]">
            {t("ChooseHowConnect")}
          </h3>
          <p className="text-[14px] leading-[20px] text-[var(--settings-description-color)] mt-[4px]">
            {t("SelectHowConnect")}
            <br />
            {t("SelectHowConnectDescription")}
          </p>
        </div>
      ) : null}
      {(showWallet ? ["wallet", "providers"] : ["providers"]).map((item) => {
        const isWallet = item === "wallet";

        return (
          <div
            key={item}
            className={cn("flex gap-[12px]", isRTL ? "justify-end" : "")}
          >
            {showWallet ? (
              <div className={cn("flex items-start w-[20px] flex-shrink-0")}>
                <RadioButton
                  checked={selectedSection === item}
                  onChange={() => setSelectedSection(item)}
                />
              </div>
            ) : null}
            <div className="select-none flex flex-col gap-[12px] w-full">
              <div className="flex flex-col gap-[4px] ">
                {showWallet ? (
                  <h2
                    className="font-normal text-[14px] leading-[20px] text-[var(--text-normal)] cursor-pointer"
                    onClick={() => setSelectedSection(item)}
                  >
                    {isWallet ? t("ONLYOFFICEWallet") : t("AIProviders")}
                  </h2>
                ) : null}
                <p
                  className={cn(
                    "text-[14px] leading-[20px] text-[var(--settings-description-color)]",
                    isRTL ? "text-end" : ""
                  )}
                >
                  {isWallet
                    ? t("ONLYOFFICEWalletDescription")
                    : t("AIProvidersDescription")}
                </p>
              </div>
              {isWallet ? (
                <Wallet isActive={selectedSection === item} />
              ) : (
                <Models />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex justify-center">
      <div className="flex flex-col gap-[16px] box-border max-w-[640px] w-[640px] mx-[32px] mt-[32px] overflow-hidden">
        <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)]">
          {t("Settings")}
        </h1>
        <Tabs
          items={[
            {
              value: "ai-settings",
              label: t("Connection"),
              content: aiSettingsTab,
            },
            {
              value: "model-assignment",
              label: t("ModelAssignment"),
              content: (
                <div className="max-w-[480px]">
                  <ModelAssignment />
                </div>
              ),
              disabled: !profiles.length,
            },
            {
              value: "mcp-servers",
              label: t("MCPServers"),
              content: <Servers />,
              disabled: !profiles.length,
            },
            {
              value: "web-search",
              label: t("WebSearch"),
              content: <WebSearch />,
              disabled: !profiles.length,
            },
          ]}
        />
      </div>
    </div>
  );
};

export default Settings;
