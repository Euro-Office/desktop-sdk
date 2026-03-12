import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { ComboBox } from "@/components/combo-box";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import useCloudsStore from "@/store/useCloudsStore";
import useWalletStore from "@/store/useWalletStore";

type WalletProps = {
  isActive: boolean;
};

const Wallet = ({ isActive }: WalletProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { selectedCloud, setSelectedCloud, walletInfo, fetchWalletInfo } =
    useWalletStore();
  const { clouds } = useCloudsStore();

  React.useEffect(() => {
    if (selectedCloud) {
      fetchWalletInfo();
    }
  }, [selectedCloud, fetchWalletInfo]);

  return (
    <>
      <div className={cn("flex", isRTL ? "justify-end" : "justify-start")}>
        <Button
          className="max-w-[fit-content]"
          disabled={!isActive}
          onClick={() => window.AscDesktopEditor?.openConnectCloud()}
        >
          {t("RegisterConnectWallet")}
        </Button>
      </div>
      {clouds.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-[12px]",
            isActive ? "" : "opacity-70 pointer-events-none"
          )}
        >
          <ComboBox
            className="w-full max-w-[312px]"
            value={selectedCloud?.url ?? ""}
            items={clouds.map((cloud) => ({
              text: cloud.url,
              id: cloud.url,
              checked:
                selectedCloud?.url === cloud.url &&
                selectedCloud?.data.apiKey === cloud.data.apiKey,
              onClick: () => setSelectedCloud(cloud),
            }))}
          />
          {walletInfo && selectedCloud && (
            <div className="flex gap-[12px] items-start px-[16px] py-[12px] rounded-[8px] bg-[var(--ai-provider-item-background-color)] shadow-[var(--ai-provider-item-shadow)] border border-[var(--border-divider)] max-w-[312px]">
              <img
                src={`${selectedCloud.url.replace(/\/+$/, "")}${walletInfo.payer.avatar}`}
                alt={walletInfo.payer.displayName}
                className="w-[48px] h-[48px] rounded-full flex-shrink-0"
              />
              <div className="flex flex-col gap-[4px] min-w-0">
                <p className="font-normal text-[14px] leading-[20px] text-[var(--text-normal)]">
                  {walletInfo.payer.displayName}
                </p>
                <p className="text-[12px] leading-[14px] text-[var(--ai-provider-item-description-color)]">
                  {walletInfo.email}
                </p>
                {walletInfo.balance.subAccounts.map((acc) => (
                  <p
                    key={acc.currency}
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
    </>
  );
};

export { Wallet };
