import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

interface ModelCardShellProps {
  children: ReactNode;
}

export const ModelCardShell = ({ children }: ModelCardShellProps) => (
  <div
    className={cn(
      "w-full p-[12px_16px] flex flex-col mb-[16px]",
      "bg-[var(--model-config-card-background-color)]",
      "border-[length:var(--model-config-card-border-width)] border-[color:var(--model-config-card-border-color)]",
      "rounded-[var(--model-config-card-border-radius)]"
    )}
  >
    {children}
  </div>
);
