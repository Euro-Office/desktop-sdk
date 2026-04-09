import React from "react";
import { useTranslation } from "react-i18next";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { Input } from "@/components/input";
import { Link } from "@/components/link";
import { useDirection } from "@/hooks/useDirection";
import { getApiKeyLink } from "@/lib/apiKeyLinks";
import { cn } from "@/lib/utils";
import client from "@/servers";

type WebSearchProps = {
  variant?: "tab" | "page";
};

const WebSearch = ({ variant = "tab" }: WebSearchProps) => {
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

  const isPage = variant === "page";

  return (
    <div
      className={cn(
        "flex flex-col w-full",
        isPage ? "gap-[24px]" : "gap-[16px]"
      )}
    >
      <p
        className={cn(
          "font-normal text-[14px] leading-[20px] text-[var(--servers-description-color)]",
          isRTL ? "text-end" : ""
        )}
      >
        {t("WebSearchDescription")}
      </p>
      <div className="flex flex-col gap-[16px]">
        <FieldContainer header={t("WebSearchEngine")} isHorizontal={isPage}>
          <ComboBox
            className="w-full"
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
        <FieldContainer
          header={t("APIKey")}
          isHorizontal={isPage}
          action={
            getApiKeyLink(selectedProvider) ? (
              <Link href={getApiKeyLink(selectedProvider)} target="_blank">
                {t("GetAPIKey")}
              </Link>
            ) : undefined
          }
        >
          <Input
            className="w-full"
            type="password"
            placeholder={t("EnterKey")}
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
