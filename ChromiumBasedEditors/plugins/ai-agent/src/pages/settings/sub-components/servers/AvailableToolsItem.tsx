import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu } from "@/components/dropdown";
import { IconButton } from "@/components/icon-button";
import { Loader } from "@/components/loader";
import { ToggleButton } from "@/components/toggle-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { useDirection } from "@/hooks/useDirection";
import type { TMCPItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import client from "@/servers";
import useServersStore from "@/store/useServersStore";
import DeleteServerDialog from "./DeleteServerDialog";
import LogsDialog from "./LogsDialog";

type AvailableToolsItemProps = {
  name: string;
  mcpItems: TMCPItem[];
  isLoading: boolean;
  isSystem: boolean;
  disableEnable: boolean;
};

const AvailableToolsItem = ({
  name,
  mcpItems,
  isLoading,
  isSystem,
  disableEnable,
}: AvailableToolsItemProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();

  const [opened, setOpened] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [openLogsDialog, setOpenLogsDialog] = React.useState(false);
  const [isStoped, setIsStoped] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);

  const { changeToolStatus } = useServersStore();

  const onEnableAllTools = useCallback(() => {
    mcpItems
      .filter((tool) => !tool.enabled)
      .forEach((tool) => {
        changeToolStatus(name, tool.name, true);
      });
  }, [mcpItems, name, changeToolStatus]);

  const onDisableAllTools = useCallback(() => {
    mcpItems
      .filter((tool) => tool.enabled)
      .forEach((tool) => {
        changeToolStatus(name, tool.name, false);
      });
  }, [mcpItems, name, changeToolStatus]);

  const openLogs = useCallback(() => setOpenLogsDialog(true), []);

  React.useEffect(() => {
    if (isLoading) setOpened(false);
  }, [isLoading]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIsStoped(client.getCustomServersStoped().includes(name));
    }, 1000);

    return () => clearInterval(interval);
  }, [name]);

  const isLoadingAction = isStoped ? false : isLoading;

  const dropdownItems = useMemo(() => {
    const items = [];

    if (mcpItems.length > 0) {
      items.push(
        {
          text: t("EnableAllTools"),
          onClick: onEnableAllTools,
          withSpace: !isSystem,
        },
        {
          text: t("DisableAllTools"),
          onClick: onDisableAllTools,
          withSpace: !isSystem,
        }
      );
      if (!isSystem) {
        items.push({
          text: "",
          onClick: () => {
            /* ignore */
          },
          isSeparator: true,
        });
      }
    }

    if (!isSystem) {
      items.push(
        {
          icon: (
            <IconButton iconName="btn-reset" size={20} disableHover isStroke />
          ),
          text: t("Restart"),
          onClick: () => client.restartCustomServer(name),
        },
        {
          icon: (
            <IconButton
              iconName="btn-menu-navigation"
              size={20}
              disableHover
              isStroke
            />
          ),
          text: t("Logs"),
          onClick: openLogs,
        },
        {
          text: "",
          onClick: () => {
            /* ignore */
          },
          isSeparator: true,
        },
        {
          icon: <IconButton iconName="btn-remove" size={20} disableHover />,
          text: t("Delete"),
          onClick: () => setDeleteDialogOpen(true),
        }
      );
    }

    return items;
  }, [
    mcpItems.length,
    isSystem,
    name,
    t,
    onEnableAllTools,
    onDisableAllTools,
    openLogs,
  ]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="flex flex-col">
      <div
        className={cn(
          "h-[36px] px-[8px] rounded-[4px] flex items-center justify-between",
          isLoadingAction ? "" : "cursor-pointer",
          opened
            ? "bg-[var(--servers-available-tools-item-active-background-color)]"
            : "bg-[var(--servers-available-tools-item-background-color)]",
          !isLoading && !opened
            ? "hover:bg-[var(--servers-available-tools-item-hover-background-color)]"
            : ""
        )}
        onClick={() => {
          if (isLoading || dropdownOpen || mcpItems.length === 0) return;
          setOpened((val) => !val);
        }}
      >
        <div className="flex items-center gap-[8px]">
          <IconButton
            iconName="arrow.right"
            size={24}
            width={8}
            height={8}
            disableHover
            isStroke
            isTransform={opened}
            className={isRTL ? "rotate-180" : ""}
          />
          <p className="text-[var(--servers-available-tools-item-name-color)]">
            {name}
          </p>
          {!isLoadingAction && isStoped ? (
            <IconButton
              iconName="status.error"
              size={16}
              disableHover
              noColor
            />
          ) : null}
          {isLoading ? null : (
            <p className="font-normal text-[14px] text-[var(--servers-available-tools-sub-header-color)]">
              <span className="text-[var(--servers-available-tools-current-tool-color)]">
                {mcpItems.filter((tool) => tool.enabled).length}
              </span>
              /{mcpItems.length} {t("ToolsEnabled")}
            </p>
          )}
        </div>
        <div ref={containerRef}>
          {isLoadingAction ? (
            <Loader />
          ) : (
            <DropdownMenu
              onOpenChange={setDropdownOpen}
              trigger={
                <IconButton
                  iconName="more"
                  size={20}
                  isActive={dropdownOpen}
                  insideElement
                />
              }
              items={dropdownItems}
              side={isRTL ? "left" : "right"}
              align={isRTL ? "end" : "start"}
              sideOffset={0}
              containerRef={containerRef.current}
            />
          )}
        </div>
      </div>
      {opened ? (
        <div className="flex flex-col gap-[12px] mt-[4px]">
          {mcpItems.map((tool) => {
            const description = isSystem
              ? `${tool.description?.split(". ")[0]}.`
              : tool.description;
            return (
              <div
                key={tool.name}
                className={cn(
                  "rounded-[4px] cursor-pointer flex flex-col hover:bg-[var(--servers-available-tools-item-hover-background-color)]",
                  isRTL ? "pr-[40px] pl-[8px]" : "pl-[40px] pr-[8px]"
                )}
                onClick={() => {
                  changeToolStatus(name, tool.name, !tool.enabled);
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <p className="text-[var(--servers-available-tools-item-name-color)]">
                    {tool.name}
                  </p>
                  <ToggleButton
                    checked={tool.enabled ?? false}
                    disabled={disableEnable && !tool.enabled}
                    onCheckedChange={() => {
                      // empty change because change will be applied in onClick at div element
                    }}
                  />
                </div>
                {description && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p
                        className="text-[13px] leading-[18px] line-clamp-2 text-[var(--servers-available-tools-sub-header-color)]"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {description}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-[300px]">{description}</div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      {openLogsDialog ? (
        <LogsDialog
          type={name}
          open={openLogsDialog}
          onClose={() => setOpenLogsDialog(false)}
        />
      ) : null}
      {deleteDialogOpen ? (
        <DeleteServerDialog
          name={name}
          onClose={() => setDeleteDialogOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default AvailableToolsItem;
