import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import AvailableTools from "./AvailableTools";
import ConfigDialog from "./ConfigDialog";

type ServersProps = {
  variant?: "tab" | "page";
};

const Servers = ({ variant = "tab" }: ServersProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <div className="flex flex-col pb-[32px] w-full">
        <p
          className={cn(
            "font-normal leading-[20px] text-[var(--servers-description-color)] mb-[16px]",
            isRTL ? "text-end" : ""
          )}
        >
          {t("MCPServersDescription")}
        </p>
        <div
          className={cn(
            "flex",
            isRTL ? "justify-end" : "justify-start",
            variant === "page" ? "mb-[28px]" : "mb-[16px]"
          )}
        >
          <Button className="w-fit" onClick={() => setIsOpen(true)}>
            {t("EditConfiguration")}
          </Button>
        </div>
        {variant === "page" ? (
          <p className="font-bold leading-[16px] text-[var(--servers-available-tools-header-color)] mb-[12px]">
            {t("Permissions")}
          </p>
        ) : null}
        <AvailableTools withHeader={variant === "tab"} />
      </div>
      {<ConfigDialog open={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
};

export { Servers };
