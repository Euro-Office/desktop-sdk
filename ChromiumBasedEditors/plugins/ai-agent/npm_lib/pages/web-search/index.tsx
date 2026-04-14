import { useTranslation } from "react-i18next";
import { WebSearch } from "./sub-components";

const WebSearchPage = () => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center p-[24px]">
      <div className="w-full max-w-[560px]">
        <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
          {t("WebSearch")}
        </h1>
        <WebSearch variant="page" />
      </div>
    </div>
  );
};

export default WebSearchPage;
