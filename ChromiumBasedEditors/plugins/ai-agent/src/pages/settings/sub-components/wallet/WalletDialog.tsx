import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { Dialog, DialogContent } from "@/components/dialog";
import { FieldContainer } from "@/components/field-container";
import { Input } from "@/components/input";
import { Loader } from "@/components/loader";
import { useDirection } from "@/hooks/useDirection";
import useWalletStore from "@/store/useWalletStore";
import {
  dialogButtonContainerStyles,
  dialogButtonContainerStylesRTL,
  dialogContentContainerStyles,
  dialogMainContainerStyles,
} from "../providers/Providers.styles";

type WalletDialogProps = {
  onClose: VoidFunction;
};

const WalletDialog = ({ onClose }: WalletDialogProps) => {
  const { isRTL } = useDirection();
  const { t } = useTranslation();
  const { addPortal } = useWalletStore();

  const [value, setValue] = React.useState({
    url: "",
    key: "",
  });
  const [error, setError] = React.useState({
    url: "",
    key: "",
  });
  const [isRequestRunning, setIsRequestRunning] = React.useState(false);
  const isRequestRunningRef = React.useRef(isRequestRunning);

  const dialogRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [buttonWidth, setButtonWidth] = React.useState<number | undefined>(
    undefined
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value: inputValue } = e.target;

    setValue((prevValue) => ({
      ...prevValue,
      [name]: inputValue,
    }));
    setError((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const isDisabled = !value.url || !!error.url || !!error.key;

  const onSubmitAction = React.useCallback(async () => {
    if (isRequestRunningRef.current || isDisabled) return;
    isRequestRunningRef.current = true;
    setIsRequestRunning(true);

    try {
      const baseUrl = value.url.replace(/\/+$/, "");
      const headers: HeadersInit = value.key
        ? { Authorization: `Bearer ${value.key}` }
        : {};

      const [balanceRes, customerInfoRes] = await Promise.all([
        fetch(
          `onlyoffice-proxy://${baseUrl}/api/2.0/portal/payment/customer/balance`,
          { headers }
        ),
        fetch(
          `onlyoffice-proxy://${baseUrl}/api/2.0/portal/payment/customerinfo`,
          { headers }
        ),
      ]);

      const [balanceData, customerInfoData] = await Promise.all([
        balanceRes.json(),
        customerInfoRes.json(),
      ]);

      const customerInfo = customerInfoData.response;
      const balance = balanceData.response;

      addPortal({
        url: baseUrl,
        key: value.key,
        portalId: customerInfo.portalId,
        email: customerInfo.email,
        payer: {
          displayName: customerInfo.payer.displayName,
          email: customerInfo.email,
          avatar: customerInfo.payer.avatarMedium,
          id: customerInfo.payer.id,
        },
        balance: {
          accountNumber: balance.accountNumber,
          subAccounts: balance.subAccounts,
        },
      });

      onClose();
    } catch (err) {
      setError((prev) => ({
        ...prev,
        url: String(err),
      }));
    }

    isRequestRunningRef.current = false;
    setIsRequestRunning(false);
  }, [value, isDisabled, addPortal, onClose]);

  React.useEffect(() => {
    if (buttonRef.current && buttonWidth === undefined) {
      const width = buttonRef.current.offsetWidth + 1;
      setButtonWidth(width);
    }
  }, [buttonWidth]);

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
        header={t("RegisterConnectWallet")}
        onClose={onClose}
        ref={dialogRef}
      >
        <div className={dialogMainContainerStyles}>
          <div className={dialogContentContainerStyles}>
            <FieldContainer header={t("URL")} error={error.url}>
              <Input
                name="url"
                onChange={onChange}
                value={value.url}
                isError={!!error.url}
                placeholder={t("EnterURL")}
                className="w-full"
              />
            </FieldContainer>
            <FieldContainer header={t("APIKey")} error={error.key}>
              <Input
                name="key"
                onChange={onChange}
                value={value.key}
                isError={!!error.key}
                placeholder={t("EnterKey")}
                className="w-full"
                type="password"
              />
            </FieldContainer>
          </div>
          <div
            className={
              isRTL
                ? dialogButtonContainerStylesRTL
                : dialogButtonContainerStyles
            }
          >
            <Button variant="default" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button
              ref={buttonRef}
              onClick={onSubmitAction}
              disabled={isDisabled || isRequestRunning}
              style={buttonWidth ? { width: `${buttonWidth}px` } : undefined}
            >
              {isRequestRunning ? (
                <Loader className="border-[var(--text-contrast-background)] border-r-transparent" />
              ) : (
                t("RegisterConnectWallet")
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { WalletDialog };
