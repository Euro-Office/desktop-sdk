import * as DialogPrimitive from "@radix-ui/react-dialog";
import type React from "react";
import { cn } from "../../../lib/utils";

const DialogDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) => {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
};

export { DialogDescription };
