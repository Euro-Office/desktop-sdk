import * as DialogPrimitive from "@radix-ui/react-dialog";
import type React from "react";

const DialogTrigger = ({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) => {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
};

export { DialogTrigger };
