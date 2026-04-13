import { useTranslation } from "react-i18next";
import { ModelAssignment } from "../../components/model-assignment";
import { Servers } from "../../components/servers";
import { Tabs } from "../../components/tabs";
import { WebSearch } from "../../components/web-search";
import { useDirection } from "../../hooks/useDirection";
import { cn } from "../../lib/utils";
import { useStores } from "../../store/context";
import { Models } from "./sub-components/models";

const Settings = () => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { useProfilesStore } = useStores();

  const profiles = useProfilesStore((s) => s.profiles);

  const aiSettingsTab = (
    <div className="flex flex-col gap-[16px] select-none max-w-full">
      <div className={cn("flex gap-[12px]", isRTL ? "justify-end" : "")}>
        <div className="select-none flex flex-col gap-[12px] w-full">
          <div className="flex flex-col gap-[4px] ">
            <p
              className={cn(
                "text-[14px] leading-[20px] text-[var(--settings-description-color)]",
                isRTL ? "text-end" : ""
              )}
            >
              {t("AIProvidersDescription")}
            </p>
          </div>
          <Models />
        </div>
      </div>
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
              label: t("AIModels"),
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
              content: (
                <div className="max-w-[480px] mt-[16px]">
                  <Servers />
                </div>
              ),
              disabled: !profiles.length,
            },
            {
              value: "web-search",
              label: t("WebSearch"),
              content: (
                <div className="max-w-[480px] mt-[16px]">
                  <WebSearch />
                </div>
              ),
              disabled: !profiles.length,
            },
          ]}
        />
      </div>
    </div>
  );
};

export default Settings;
