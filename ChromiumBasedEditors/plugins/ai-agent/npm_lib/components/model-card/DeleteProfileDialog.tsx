import React from "react";
import { useTranslation } from "react-i18next";
import { useDirection } from "../../hooks/useDirection";
import { useStores } from "../../store/context";
import type { Profile } from "../../types";
import { Button } from "../button";
import { Dialog, DialogContent } from "../dialog";

type DeleteProfileDialogProps = {
  profile: Profile;
  onClose: VoidFunction;
};

const DeleteProfileDialog = ({
  profile,
  onClose,
}: DeleteProfileDialogProps) => {
  const { useProfilesStore } = useStores();
  const { deleteProfile } = useProfilesStore();
  const { isRTL } = useDirection();
  const { t } = useTranslation();

  const onSubmitAction = React.useCallback(async () => {
    await deleteProfile(profile.id);
    onClose();
  }, [deleteProfile, profile.id, onClose]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmitAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSubmitAction]);

  return (
    <Dialog open={true}>
      <DialogContent
        header={t("DeleteModel")}
        onClose={onClose}
        withWarningIcon
      >
        <div className="flex flex-col justify-between h-full">
          <p className="select-none h-[40px] flex items-center text-[12px] leading-[16px] text-[var(--text-normal)]">
            {t("WantDeleteModel")}
          </p>
          <div
            className={
              isRTL
                ? "flex flex-row-reverse justify-end items-center gap-[8px] h-[48px]"
                : "flex flex-row justify-end items-center gap-[8px] h-[48px]"
            }
          >
            <Button variant="default" onClick={onClose}>
              {t("No")}
            </Button>
            <Button onClick={onSubmitAction}>{t("Yes")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { DeleteProfileDialog };
