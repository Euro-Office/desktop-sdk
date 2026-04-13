import * as DialogPrimitive from "@radix-ui/react-dialog";
import type React from "react";

const DialogPortal = ({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) => {
  return (
    <DialogPrimitive.Portal
      data-slot="dialog-portal"
      container={document.getElementById("app")}
      {...props}
    />
  );
};

export { DialogPortal };
