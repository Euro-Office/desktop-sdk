import React from "react";
import { useTranslation } from "react-i18next";
import { RadioButton } from "@/components/radio-button";
import { Tabs } from "@/components/tabs";
import config from "@/config.json";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import useProviders from "@/store/useProviders";
import { Providers } from "./sub-components/providers";
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

  const { providers } = useProviders();

  const aiSettingsTab = (
    <div className="flex flex-col gap-[16px] select-none">
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
            <div className="select-none flex flex-col gap-[12px]">
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
                    "text-[14px] leading-[20px] text-[var(--settings-description-color)]"
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
                <Providers isActive={selectedSection === item} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex justify-center">
      <div className="flex flex-col gap-[16px] box-border max-w-[640px] w-[640px] mx-[32px] mt-[32px]">
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
              value: "mcp-servers",
              label: t("MCPServers"),
              content: <Servers />,
              disabled: !providers.length,
            },
            {
              value: "web-search",
              label: t("WebSearch"),
              content: <WebSearch />,
              disabled: !providers.length,
            },
          ]}
        />
      </div>
    </div>
  );
};

export default Settings;
