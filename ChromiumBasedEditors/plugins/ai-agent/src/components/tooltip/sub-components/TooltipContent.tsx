import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type React from "react";
import { cn } from "@/lib/utils";

import "./TooltipContent.css";

const TooltipContent = ({
  className,
  sideOffset = 0,
  children,
  isAbout,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
  isAbout?: boolean;
}) => {
  return (
    <TooltipPrimitive.Portal container={document.getElementById("app")}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "mt-[4px] z-[9999]",
          "bg-[var(--tooltip-background-color)] text-[var(--tooltip-text-color)] border border-[var(--tooltip-border-color)] p-[4px] rounded-[4px] text-[12px] font-[400] leading-[16px]",
          "whitespace-pre-line",
          isAbout ? "max-w-[272px]" : "",
          className
        )}
        {...props}
      >
        {children}
        {isAbout ? <TooltipPrimitive.Arrow className="tooltip-arrow" /> : null}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
};

export { TooltipContent };
