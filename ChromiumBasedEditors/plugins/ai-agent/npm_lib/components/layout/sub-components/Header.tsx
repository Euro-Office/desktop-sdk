import { useTranslation } from "react-i18next";
import { useStores } from "../../../store/context";
import { IconButton } from "../../icon-button";
import { TooltipIconButton } from "../../tooltip-icon-button";

const Navigation = () => {
  const { t } = useTranslation();
  const { useRouter, useThreadsStore } = useStores();

  const { currentPage, setCurrentPage } = useRouter();
  const { onSwitchToNewThread } = useThreadsStore();

  return (
    <nav className="w-full flex justify-between items-center h-[56px] min-h-[56px] box-border border-b-[1px] border-[var(--header-border-color)] bg-[var(--header-background-color)] px-[32px]">
      <div className="flex items-center gap-[12px]">
        <h3 className="text-[var(--header-color)] font-bold text-[16px] leading-[24px]">
          {t("AIAgent")}
        </h3>
        <TooltipIconButton tooltip={t("NewChat")}>
          <IconButton
            iconName="btn-zoomup"
            size={24}
            isStroke
            onClick={() => {
              setCurrentPage("chat");
              onSwitchToNewThread();
            }}
            data-testid="new-chat-button"
          />
        </TooltipIconButton>
        <TooltipIconButton tooltip={t("ChatHistory")}>
          <IconButton
            iconName="btn-list-search"
            size={24}
            isActive={currentPage === "history"}
            onClick={() =>
              setCurrentPage(currentPage === "history" ? "chat" : "history")
            }
            data-testid="chat-history-button"
          />
        </TooltipIconButton>
      </div>
      <TooltipIconButton tooltip={t("Settings")}>
        <IconButton
          iconName="btn-settings"
          size={24}
          isStroke
          isActive={currentPage === "settings"}
          onClick={() =>
            setCurrentPage(currentPage === "settings" ? "chat" : "settings")
          }
          data-testid="settings-button"
        />
      </TooltipIconButton>
    </nav>
  );
};

export { Navigation };
