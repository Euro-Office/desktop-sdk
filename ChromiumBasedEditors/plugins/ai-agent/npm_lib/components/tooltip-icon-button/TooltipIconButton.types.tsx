import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type TooltipIconButtonProps = ComponentPropsWithoutRef<"div"> & {
  tooltip: string | ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  visible?: boolean;
};
