import { useTranslation } from "react-i18next";
import { Servers } from "@/components/servers";

const McpServersPage = () => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center p-[24px]">
      <div className="w-full max-w-[560px]">
        <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
          {t("MCPServers")}
        </h1>
        <Servers variant="page" />
      </div>
    </div>
  );
};

export default McpServersPage;
