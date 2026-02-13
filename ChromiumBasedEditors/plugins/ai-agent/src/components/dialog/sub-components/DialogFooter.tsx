import type React from "react";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "../../../lib/utils";

const DialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => {
  const { isRTL } = useDirection();

  return (
    <div
      dir="rtl"
      data-slot="dialog-footer"
      className={cn(
        "flex gap-2",
        isRTL ? "flex-row-reverse justify-end" : "flex-row justify-start",
        className
      )}
      {...props}
    />
  );
};

export { DialogFooter };
