import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { Input } from "@/components/input";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import client from "@/servers";

const WebSearch = () => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();

  const [selectedProvider, setSelectedProvider] = React.useState<string>("");
  const [apiKey, setApiKey] = React.useState<string>("");
  const [saved, setSaved] = React.useState<boolean>(false);

  React.useEffect(() => {
    const data = client.getWebSearchData();

    if (data) {
      setSelectedProvider(data.provider);
      setApiKey(data.key);
      setSaved(true);
    }
  }, []);

  const saveWebSearchData = React.useCallback(() => {
    if (!selectedProvider || !apiKey) return;
    client.setWebSearchData({
      provider: selectedProvider,
      key: apiKey,
    });
    setSaved(true);
  }, [selectedProvider, apiKey]);

  const resetSettings = () => {
    setSelectedProvider("");
    setApiKey("");
    setSaved(false);
    client.setWebSearchData(null);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveWebSearchData();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [saveWebSearchData]);

  return (
    <div className="flex flex-col gap-[16px] mt-[16px]">
      <p
        className={cn(
          "font-normal text-[14px] leading-[20px] text-[var(--servers-description-color)]",
          isRTL ? "text-end" : ""
        )}
      >
        {t("WebSearchDescription")}
      </p>
      <div className="flex flex-col gap-[16px]">
        <FieldContainer header={t("WebSearchEngine")}>
          <ComboBox
            className="w-[260px]"
            value={selectedProvider || t("SelectEngine")}
            items={
              saved
                ? []
                : [
                    {
                      text: "Exa",
                      id: "Exa",
                      onClick: () => setSelectedProvider("Exa"),
                    },
                  ]
            }
          />
        </FieldContainer>
        <FieldContainer header={t("APIKey")}>
          <Input
            className="w-[260px]"
            type="password"
            value={apiKey}
            disabled={saved}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </FieldContainer>
      </div>
      <div
        className={cn(
          "flex gap-[8px]",
          isRTL ? "flex-row-reverse" : "flex-row"
        )}
      >
        <Button
          className="w-fit"
          onClick={saveWebSearchData}
          disabled={!selectedProvider || !apiKey || saved}
        >
          {t("Save")}
        </Button>
        <Button
          className="w-fit"
          disabled={!saved}
          onClick={resetSettings}
          variant="default"
        >
          {t("ResetSettings")}
        </Button>
      </div>
    </div>
  );
};

export { WebSearch };
