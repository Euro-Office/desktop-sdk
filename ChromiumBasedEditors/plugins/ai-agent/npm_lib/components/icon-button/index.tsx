import { memo } from "react";
import { cn } from "../../lib/utils";
import { Icon } from "../icon";
import type { IconButtonProps } from "./IconButton.types";

const IconButtonComponent = ({
  iconName,
  size,
  isStroke,
  isActive,
  className,
  insideElement,
  disableHover,
  color,
  noColor,
  width,
  height,
  ...props
}: IconButtonProps) => {
  const hoverStyles = !disableHover
    ? insideElement
      ? "hover:enabled:bg-[var(--icon-button-hover-on-active-background-color)]"
      : "hover:enabled:bg-[var(--icon-button-hover-background-color)]"
    : undefined;

  const activeStyles = !disableHover
    ? "active:enabled:bg-[var(--icon-button-pressed-background-color)]"
    : undefined;

  const baseStyles = "border-none cursor-pointer rounded-[4px] bg-none p-0 m-0";
  const layoutStyles = "flex items-center justify-center";
  const disabledStyles = "disabled:cursor-not-allowed disabled:opacity-[0.5]";
  const focusStyles =
    "outline-none focus:outline-none focus-visible:outline-none";

  return (
    <button
      className={cn(
        baseStyles,
        layoutStyles,
        hoverStyles,
        activeStyles,
        disabledStyles,
        focusStyles,
        className
      )}
      style={{
        width: `${size}px`,
        minWidth: `${size}px`,
        height: `${size}px`,
        ...(isActive
          ? {
              backgroundColor: "var(--icon-button-pressed-background-color)",
            }
          : {}),
      }}
      {...props}
    >
      <Icon
        name={iconName}
        size={size}
        isStroke={isStroke}
        color={color}
        noColor={noColor}
        width={width}
        height={height}
      />
    </button>
  );
};

const IconButton = memo(IconButtonComponent);
export { IconButton };
