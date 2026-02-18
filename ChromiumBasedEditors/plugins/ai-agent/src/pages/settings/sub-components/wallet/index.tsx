import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { ComboBox } from "@/components/combo-box";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import useWalletStore from "@/store/useWalletStore";
import { WalletDialog } from "./WalletDialog";

type WalletProps = {
  isActive: boolean;
};

const Wallet = ({ isActive }: WalletProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const [dialogVisible, setDialogVisible] = React.useState(false);
  const { portals, selectedPortalId, setSelectedPortalId, refreshPortal } =
    useWalletStore();

  const selectedPortal = portals.find((p) => p.portalId === selectedPortalId);

  React.useEffect(() => {
    if (selectedPortalId) {
      refreshPortal(selectedPortalId);
    }
  }, [selectedPortalId, refreshPortal]);

  return (
    <>
      <div className={cn("flex", isRTL ? "justify-end" : "justify-start")}>
        <Button
          className="max-w-[fit-content]"
          disabled={!isActive}
          onClick={() => setDialogVisible(true)}
        >
          {t("RegisterConnectWallet")}
        </Button>
      </div>
      {portals.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-[12px]",
            isActive ? "" : "opacity-70 pointer-events-none"
          )}
        >
          <ComboBox
            className="w-full max-w-[312px]"
            value={selectedPortal?.url ?? ""}
            items={portals.map((portal) => ({
              text: portal.url,
              id: portal.portalId,
              onClick: () => setSelectedPortalId(portal.portalId),
            }))}
          />
          {selectedPortal && (
            <div className="flex gap-[12px] items-start px-[16px] py-[12px] rounded-[8px] bg-[var(--ai-provider-item-background-color)] shadow-[var(--ai-provider-item-shadow)] max-w-[312px]">
              <img
                src={`${selectedPortal.url}${selectedPortal.payer.avatar}`}
                alt={selectedPortal.payer.displayName}
                className="w-[48px] h-[48px] rounded-full flex-shrink-0"
              />
              <div className="flex flex-col gap-[4px] min-w-0">
                <p className="font-normal text-[14px] leading-[20px] text-[var(--text-normal)]">
                  {selectedPortal.payer.displayName}
                </p>
                <p className="text-[12px] leading-[14px] text-[var(--ai-provider-item-description-color)]">
                  {selectedPortal.email}
                </p>
                {selectedPortal.balance.subAccounts.map((acc, _i) => (
                  <p
                    key={acc.amount}
                    className="text-[12px] leading-[14px] text-[var(--ai-provider-item-description-color)]"
                  >
                    {acc.amount} {acc.currency}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {dialogVisible && (
        <WalletDialog onClose={() => setDialogVisible(false)} />
      )}
    </>
  );
};

export { Wallet };
