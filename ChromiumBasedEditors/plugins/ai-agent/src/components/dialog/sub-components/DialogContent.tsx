import * as DialogPrimitive from "@radix-ui/react-dialog";
import React from "react";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import { DialogOverlay } from "./DialogOverlay";
import { DialogPortal } from "./DialogPortal";
import { DialogTitle } from "./DialogTitle";

const HiddenComponents = () => (
  <>
    <DialogPrimitive.Description className="hidden">
      Dialog content
    </DialogPrimitive.Description>
  </>
);

type DialogContentProps = React.ComponentProps<
  typeof DialogPrimitive.Content
> & {
  header: string;
  onClose: VoidFunction;
  isHuge?: boolean;
  withWarningIcon?: boolean;
};

const widthDefaultStyles = "w-[348px]";
const widthHugeStyles = "w-[548px]";
const centeredSizeStyles =
  " box-border h-fit-content fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 rounded-[8px]";
const warningSizeStyles =
  "w-[352px] box-border h-fit-content fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 rounded-[8px]";
const colorStyles =
  "bg-[var(--modal-dialog-background-color)]  shadow-[var(--modal-dialog-shadows)]";

const DialogContent = ({
  className,
  children,
  header,
  onClose,
  isHuge = false,
  withWarningIcon = false,
  ...props
}: DialogContentProps) => {
  const { isRTL } = useDirection();
  const widthStyles = isHuge ? widthHugeStyles : widthDefaultStyles;
  const sizeStyles = withWarningIcon ? warningSizeStyles : centeredSizeStyles;

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        id="dialog-content"
        data-slot="dialog-content"
        dir={isRTL ? "rtl" : "ltr"}
        className={cn(
          widthStyles,
          sizeStyles,
          colorStyles,
          "flex flex-col",
          className
        )}
        onInteractOutside={(e) => e.preventDefault()}
        {...props}
      >
        <HiddenComponents />
        <div
          className={cn(
            "flex items-center justify-between align-center",
            withWarningIcon ? "h-[40px]" : "h-[56px]",
            withWarningIcon ? "ps-[16px] pe-[8px]" : "ps-[32px] pe-[16px]"
          )}
        >
          <div className="flex items-center gap-[4px]">
            {withWarningIcon ? (
              <Icon name="attention" size={20} noColor />
            ) : null}
            <DialogTitle withWarningIcon={withWarningIcon}>
              {header}
            </DialogTitle>
          </div>
          <IconButton iconName="btn-close" size={24} onClick={onClose} />
        </div>
        <div
          className={cn(
            "flex-1 min-h-0",
            withWarningIcon ? "px-[16px]" : "px-[32px]"
          )}
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
};

export { DialogContent };
