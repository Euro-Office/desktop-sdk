import React from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { DropdownMenu } from "../dropdown";
import type { DropDownItemProps } from "../dropdown-item/DropDownItem.types";

type ComboBoxProps = {
  placeholder?: string;
  value?: string;
  className?: string;
  isError?: boolean;
  withoutBg?: boolean;
  disabled?: boolean;
  items: DropDownItemProps[];
  "data-testid"?: string;
};

const ComboBox = ({
  placeholder,
  value,
  className,
  isError,
  withoutBg,
  disabled,
  items,
  "data-testid": dataTestId,
}: ComboBoxProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <DropdownMenu
      onOpenChange={(value: boolean) => setIsOpen(value)}
      trigger={
        <div
          ref={containerRef}
          data-testid={dataTestId}
          className={cn(
            "h-[36px] rounded-[var(--input-border-radius)] ps-[12px] box-border",
            "cursor-pointer flex items-center justify-between",
            "text-[var(--input-color)] text-[14px] leading-[16px]",
            isOpen
              ? "border bg-[var(--input-background-color)] border-[var(--input-active-border-color)]"
              : withoutBg
                ? "hover:bg-[var(--input-hover-background-color)) hover:border-[var(--input-hover-border-color)]"
                : "border bg-[var(--input-background-color)] border-[var(--input-border-color)] hover:bg-[var(--input-hover-background-color)] hover:border-[var(--input-hover-border-color)]",
            className,
            disabled || items.length === 0
              ? "cursor-not-allowed pointer-events-none opacity-50"
              : ""
          )}
          style={{
            borderColor: isError ? "var(--border-error)" : undefined,
          }}
        >
          <span
            className={cn(
              value
                ? "text-[var(--input-color)]"
                : "text-[var(--input-placeholder-color)]"
            )}
          >
            {value || placeholder}
          </span>
          <div className="flex items-center h-full w-[25px]">
            <Icon
              name="arrow.bottom.big"
              color="var(--input-color)"
              width={9}
              height={4.5}
              isStroke
              className={cn("transition-transform ms-[4px]", {
                "rotate-180": isOpen,
              })}
            />
          </div>
        </div>
      }
      align="start"
      side="bottom"
      containerRef={containerRef.current}
      matchTriggerWidth={true}
      items={items}
    />
  );
};

export { ComboBox };
