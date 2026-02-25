import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu } from "@/components/dropdown";
import { IconButton } from "@/components/icon-button";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import useModelsStore from "@/store/useModelsStore";
import useServersStore from "@/store/useServersStore";

const ServersSettings = () => {
  const { servers, changeToolStatus, webSearchEnabled, getWebSearchEnabled } =
    useServersStore();
  const { extendedThinking, toggleExtendedThinking } = useModelsStore();

  const [isOpen, setIsOpen] = useState(false);

  const { t } = useTranslation();

  const trigger = useMemo(
    () => (
      <TooltipIconButton visible={!isOpen} tooltip={t("MCPServers")}>
        <IconButton
          iconName="tools"
          size={24}
          width={12}
          height={16}
          isActive={isOpen}
        />
      </TooltipIconButton>
    ),
    [isOpen, t]
  );

  const toolsActions = useMemo(
    () => [
      {
        text: t("WebSearch"),
        onClick: () => {
          // ignore
        },
        icon: <IconButton iconName="btn-web-search" size={24} disableHover />,
        withToggle: true,
        toggleChecked: getWebSearchEnabled() ? webSearchEnabled : false,
        toggleDisabled: !getWebSearchEnabled(),
        tooltipText: getWebSearchEnabled() ? "" : t("EnableWebSearch"),
        onToggleChange: () => {
          changeToolStatus(
            "web-search",
            servers["web-search"][0].name,
            !webSearchEnabled
          );
          window.dispatchEvent(new CustomEvent("tools-changed"));
        },
      },
      {
        text: t("ExtendedThinking"),
        icon: (
          <IconButton iconName="btn-extended-thinking" size={24} disableHover />
        ),
        onClick: () => {
          // ignore
        },
        withToggle: true,
        toggleChecked: extendedThinking,
        onToggleChange: toggleExtendedThinking,
        withAbout: true,
        aboutContent: (
          <p className="p-[16px] text-[11px] leading-[16px] text-[var(--text-secondary)]">
            {t("ExtendedThinkingDescription")}
          </p>
        ),
      },
      {
        text: "",
        onClick: () => {
          // ignore
        },
        isSeparator: true,
      },
      ...Object.entries(servers)
        .map(([type, tools]) => {
          if (type === "web-search")
            return {
              text: type,
              onClick: () => {
                // ignore
              },
              subMenu: [],
            };

          const isAllEnabled = tools.some((tool) => tool.enabled);
          return {
            text: type,
            onClick: () => {
              // ignore
            },
            subMenu: [
              {
                text: "All tools",
                onClick: () => {
                  // ignore
                },
                withToggle: true,
                toggleChecked: isAllEnabled,
                onToggleChange: () => {
                  if (isAllEnabled) {
                    tools.forEach((tool) => {
                      changeToolStatus(type, tool.name, false);
                    });
                  } else {
                    tools.forEach((tool) => {
                      changeToolStatus(type, tool.name, true);
                    });
                  }
                },
              },
              {
                text: "",
                onClick: () => {
                  // ignore
                },
                isSeparator: true,
              },
              ...tools.map((tool) => {
                return {
                  text: tool.name,
                  onClick: () => {
                    // ignore
                  },
                  withToggle: true,
                  toggleChecked: tool.enabled,
                  onToggleChange: (checked: boolean) => {
                    changeToolStatus(type, tool.name, checked);
                  },
                };
              }),
            ],
          };
        })
        .filter((item) => item.subMenu.length > 2),
    ],
    [
      servers,
      changeToolStatus,
      t,
      webSearchEnabled,
      getWebSearchEnabled,
      toggleExtendedThinking,
      extendedThinking,
    ]
  );

  const actions = useMemo(() => [...toolsActions], [toolsActions]);

  if (!servers) return null;

  if (!toolsActions.length) return null;

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  return (
    <DropdownMenu
      trigger={trigger}
      items={actions}
      onOpenChange={onOpenChange}
    />
  );
};

export { ServersSettings };
