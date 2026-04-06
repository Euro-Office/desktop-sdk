import React from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu } from "@/components/dropdown";
import { IconButton } from "@/components/icon-button";
import { EditModelCard } from "@/components/model-config-cards";
import { ProviderLogo } from "@/components/provider-logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { useDirection } from "@/hooks/useDirection";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { provider } from "@/providers";
import { DeleteProfileDialog } from "./DeleteProfileDialog";

type ModelCardProps = {
  profile: Profile;
};

const ModelCard = ({ profile }: ModelCardProps) => {
  const providerName = provider.getProviderInfo(profile.providerType).name;
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const { isRTL } = useDirection();
  const { t } = useTranslation();

  const [containerElement, setContainerElement] =
    React.useState<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const containerRef = React.useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
  }, []);

  if (isEditing) {
    return (
      <>
        <EditModelCard
          profile={profile}
          onClose={() => setIsEditing(false)}
          onDelete={() => setIsDeleteOpen(true)}
          isHorizontal
        />
        {isDeleteOpen && (
          <DeleteProfileDialog
            profile={profile}
            onClose={() => setIsDeleteOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div
      className={cn(
        "flex justify-between gap-[12px] px-[16px] py-[12px] w-full rounded-[var(--model-card-border-radius)] bg-[var(--model-card-background-color)] border border-[var(--model-card-border-color)]",
        isRTL ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-[12px] min-w-0 flex-1",
          isRTL ? "flex-row-reverse" : "flex-row"
        )}
      >
        <ProviderLogo providerType={profile.providerType} />
        <div className="flex flex-col overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-normal text-[14px] leading-[20px] text-[var(--model-card-color)] truncate">
                {profile?.name}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom">{profile?.name}</TooltipContent>
          </Tooltip>
          <p
            className={cn(
              "text-[12px] leading-[14px] text-[var(--model-card-description-color)] truncate",
              isRTL ? "text-end" : ""
            )}
          >
            {providerName}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end" ref={containerRef}>
        <DropdownMenu
          onOpenChange={setIsOpen}
          trigger={<IconButton iconName="more" size={20} isActive={isOpen} />}
          items={[
            {
              icon: (
                <IconButton
                  iconName="btn-edit"
                  size={20}
                  disableHover
                  isStroke
                />
              ),
              text: t("Edit"),
              onClick: () => setIsEditing(true),
            },
            {
              text: "",
              onClick: () => {
                // ignore
              },
              isSeparator: true,
            },
            {
              icon: <IconButton iconName="btn-remove" size={20} disableHover />,
              text: t("Delete"),
              onClick: () => setIsDeleteOpen(true),
            },
          ]}
          side={isRTL ? "left" : "right"}
          align={isRTL ? "end" : "start"}
          sideOffset={0}
          containerRef={containerElement}
        />
      </div>
      {isDeleteOpen && (
        <DeleteProfileDialog
          profile={profile}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
    </div>
  );
};

export { ModelCard };
