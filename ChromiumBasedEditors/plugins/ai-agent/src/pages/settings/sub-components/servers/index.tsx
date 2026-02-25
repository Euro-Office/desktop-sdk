import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import AvailableTools from "./AvailableTools";
import ConfigDialog from "./ConfigDialog";

const Servers = () => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <div className="flex flex-col gap-[16px] mt-[16px] pb-[32px]">
        <p
          className={cn(
            "font-normal text-[14px] leading-[20px] text-[var(--servers-description-color)]",
            isRTL ? "text-end" : ""
          )}
        >
          {t("CustomServersDescription")}
        </p>
        <div className={cn("flex", isRTL ? "justify-end" : "justify-start")}>
          <Button className="w-fit" onClick={() => setIsOpen(true)}>
            {t("EditConfiguration")}
          </Button>
        </div>
        <AvailableTools />
      </div>
      {<ConfigDialog open={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
};

export { Servers };
