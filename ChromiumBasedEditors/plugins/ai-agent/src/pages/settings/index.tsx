import { useTranslation } from "react-i18next";
import { ModelAssignment } from "@/components/model-assignment";
import { Servers } from "@/components/servers";
import { Tabs } from "@/components/tabs";
import { WebSearch } from "@/components/web-search";
import useProfilesStore from "@/store/useProfilesStore";
import { Models } from "./sub-components/models";

const Settings = () => {
  const { t } = useTranslation();

  const profiles = useProfilesStore((s) => s.profiles);

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
              content: (
                <div className="max-w-[480px]">
                  <Models />
                </div>
              ),
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
