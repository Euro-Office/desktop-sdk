import { useTranslation } from "react-i18next";
import { MAX_TOOL_COUNT, MAX_TOOL_COUNT_WITH_WEB_SEARCH } from "../../../config";
import { useStores } from "../../../store/context";

const TOOLS_COUNTER_THRESHOLD = 90;

const ToolsCounter = () => {
  const { t } = useTranslation();
  const { useServersStore } = useStores();
  const { tools, webSearchEnabled } = useServersStore();

  const allToolsCount = webSearchEnabled ? tools.length - 2 : tools.length;
  const maxCount = webSearchEnabled
    ? MAX_TOOL_COUNT_WITH_WEB_SEARCH - 2
    : MAX_TOOL_COUNT;

  if (allToolsCount <= TOOLS_COUNTER_THRESHOLD) return null;

  return (
    <p className="font-normal leading-[16px] text-[var(--servers-available-tools-sub-header-color)]">
      <span className="text-[var(--servers-available-tools-current-tool-color)]">
        {allToolsCount}
      </span>
      /{maxCount} {t("Tools")}
    </p>
  );
};

export default ToolsCounter;
