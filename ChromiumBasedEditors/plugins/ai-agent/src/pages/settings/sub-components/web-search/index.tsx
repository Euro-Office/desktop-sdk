import React from "react";
import { useTranslation } from "react-i18next";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { Input } from "@/components/input";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import client from "@/servers";

const WebSearch = () => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();

  const [selectedProvider, setSelectedProvider] = React.useState<string>("Exa");
  const [apiKey, setApiKey] = React.useState<string>("");

  React.useEffect(() => {
    const data = client.getWebSearchData();

    if (data) {
      setSelectedProvider(data.provider);
      setApiKey(data.key);
    }
  }, []);

  const handleApiKeyBlur = React.useCallback(() => {
    if (selectedProvider && apiKey) {
      client.setWebSearchData({ provider: selectedProvider, key: apiKey });
    } else {
      client.setWebSearchData(null);
    }
  }, [selectedProvider, apiKey]);

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
            items={[
              {
                text: "Exa",
                id: "Exa",
                onClick: () => setSelectedProvider("Exa"),
              },
            ]}
          />
        </FieldContainer>
        <FieldContainer header={t("APIKey")}>
          <Input
            className="w-[260px]"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onBlur={handleApiKeyBlur}
            disabled={!selectedProvider}
          />
        </FieldContainer>
      </div>
    </div>
  );
};

export { WebSearch };
