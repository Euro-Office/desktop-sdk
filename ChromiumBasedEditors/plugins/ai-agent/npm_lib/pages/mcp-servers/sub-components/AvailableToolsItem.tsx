import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useToolsContext } from "../../../tools/context";
import { useDirection } from "../../../hooks/useDirection";
import { cn } from "../../../lib/utils";
import { useStores } from "../../../store/context";
import type { TMCPItem } from "../../../types";
import { DropdownMenu } from "../../../components/dropdown";
import { Icon } from "../../../components/icon";
import { IconButton } from "../../../components/icon-button";
import { Loader } from "../../../components/loader";
import { ToggleButton } from "../../../components/toggle-button";

type AvailableToolsItemProps = {
  name: string;
  mcpItems: TMCPItem[];
  isLoading: boolean;
  disableEnable: boolean;
};

const AvailableToolsItem = ({
  name,
  mcpItems,
  isLoading,
  disableEnable,
}: AvailableToolsItemProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { servers: serversInstance } = useToolsContext();

  const [opened, setOpened] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [isStoped, setIsStoped] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);

  const { useServersStore } = useStores();
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

  React.useEffect(() => {
    if (isLoading) setOpened(false);
  }, [isLoading]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIsStoped(serversInstance.getCustomServersStoped().includes(name));
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
        },
        {
          text: t("DisableAllTools"),
          onClick: onDisableAllTools,
        }
      );
    }

    return items;
  }, [mcpItems.length, t, onEnableAllTools, onDisableAllTools]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="flex flex-col">
      <div
        className={cn(
          "h-[36px] px-[8px] rounded-[var(--servers-available-tools-item-border-radius)] flex items-center justify-between",
          isLoadingAction ? "" : "cursor-pointer",
          "bg-[var(--servers-available-tools-item-background-color)]",
          "active:bg-[var(--servers-available-tools-item-active-background-color)]",
          !isLoading
            ? "hover:bg-[var(--servers-available-tools-item-hover-background-color)]"
            : ""
        )}
        onClick={() => {
          if (isLoading || dropdownOpen || mcpItems.length === 0) return;
          setOpened((val) => !val);
        }}
      >
        <div className="flex items-center gap-[8px]">
          <div
            className="flex items-center justify-center w-[12px] h-full"
            style={{
              transform: isRTL
                ? `rotate(${opened ? 180 : 90}deg)`
                : `rotate(${opened ? 0 : -90}deg)`,
            }}
          >
            <Icon name="chevron" width={6} height={3} isStroke />
          </div>
          <p className="text-[var(--servers-available-tools-item-name-color)] font-bold">
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
        <div className="flex flex-col gap-[8px] mt-[4px]">
          {mcpItems.map((tool) => {
            return (
              <div
                key={tool.name}
                className={cn(
                  "rounded-[var(--servers-available-tools-item-border-radius)] cursor-pointer flex flex-col hover:bg-[var(--servers-available-tools-item-hover-background-color)] ps-[28px] pe-[8px] h-[32px]"
                )}
                onClick={() => {
                  changeToolStatus(name, tool.name, !tool.enabled);
                }}
              >
                <div className="flex items-center justify-between w-full h-full">
                  <p className="text-[var(--servers-available-tools-item-name-color)] leading-[20px]">
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
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default AvailableToolsItem;
