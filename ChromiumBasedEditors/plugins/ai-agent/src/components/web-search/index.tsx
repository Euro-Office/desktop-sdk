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
import useCloudsStore from "@/store/useCloudsStore";

type WebSearchProps = {
  variant?: "tab" | "page";
};

const ONLYOFFICE_PROVIDER = "ONLYOFFICE";

const WebSearch = ({ variant = "tab" }: WebSearchProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { clouds } = useCloudsStore();

  const [selectedProvider, setSelectedProvider] = React.useState<string>("Exa");
  const [apiKey, setApiKey] = React.useState<string>("");
  const [baseUrl, setBaseUrl] = React.useState<string>("");
  const [baseUrlError, setBaseUrlError] = React.useState<string>("");
  const [isCloudProvider, setIsCloudProvider] = React.useState(false);

  React.useEffect(() => {
    const data = client.getWebSearchData();

    if (data) {
      setSelectedProvider(data.provider);
      setApiKey(data.key);
      setBaseUrl(data.baseUrl ?? "");
      setIsCloudProvider(data.isCloudProvider ?? false);
    }
  }, []);

  const isOnlyOffice = selectedProvider === ONLYOFFICE_PROVIDER;

  const handleBaseUrlBlur = React.useCallback(() => {
    if (!isOnlyOffice) return;
    try {
      new URL(baseUrl);
      setBaseUrlError("");
      if (apiKey) {
        client.setWebSearchData({
          provider: ONLYOFFICE_PROVIDER,
          key: apiKey,
          baseUrl,
        });
      }
    } catch {
      setBaseUrlError(t("InvalidUrl"));
      client.setWebSearchData(null);
    }
  }, [isOnlyOffice, baseUrl, apiKey, t]);

  const handleApiKeyBlur = React.useCallback(() => {
    if (isOnlyOffice) {
      try {
        new URL(baseUrl);
        if (apiKey) {
          client.setWebSearchData({
            provider: ONLYOFFICE_PROVIDER,
            key: apiKey,
            baseUrl,
          });
        } else {
          client.setWebSearchData(null);
        }
      } catch {
        client.setWebSearchData(null);
      }
      return;
    }
    if (selectedProvider && apiKey) {
      client.setWebSearchData({ provider: selectedProvider, key: apiKey });
    } else {
      client.setWebSearchData(null);
    }
  }, [isOnlyOffice, selectedProvider, apiKey, baseUrl]);

  const isPage = variant === "page";

  const providerItems = [
    ...clouds.map((cloud) => ({
      text: new URL(cloud.url).hostname,
      id: cloud.url,
      onClick: () => {
        setSelectedProvider(cloud.url);
        setApiKey(cloud.data.apiKey);
        setBaseUrl("");
        setBaseUrlError("");
        setIsCloudProvider(true);
        client.setWebSearchData({
          provider: cloud.url,
          key: cloud.data.apiKey,
          isCloudProvider: true,
        });
      },
    })),
    {
      text: ONLYOFFICE_PROVIDER,
      id: ONLYOFFICE_PROVIDER,
      onClick: () => {
        setSelectedProvider(ONLYOFFICE_PROVIDER);
        setApiKey("");
        setBaseUrl("");
        setBaseUrlError("");
        setIsCloudProvider(false);
        client.setWebSearchData(null);
      },
    },
    {
      text: "Exa",
      id: "Exa",
      onClick: () => {
        setSelectedProvider("Exa");
        setApiKey("");
        setBaseUrl("");
        setBaseUrlError("");
        setIsCloudProvider(false);
        client.setWebSearchData(null);
      },
    },
  ];

  const selectedProviderText =
    isCloudProvider && selectedProvider
      ? new URL(selectedProvider).hostname
      : selectedProvider || t("SelectEngine");

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
            value={selectedProviderText}
            items={providerItems}
          />
        </FieldContainer>
        {isOnlyOffice && (
          <FieldContainer
            header={t("BaseURL")}
            isHorizontal={isPage}
            error={baseUrlError}
          >
            <Input
              className="w-full"
              placeholder={t("EnterURL")}
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setBaseUrlError("");
              }}
              onBlur={handleBaseUrlBlur}
            />
          </FieldContainer>
        )}
        <FieldContainer
          header={t("APIKey")}
          isHorizontal={isPage}
          action={
            !isCloudProvider &&
            !isOnlyOffice &&
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
            onBlur={isCloudProvider ? undefined : handleApiKeyBlur}
            disabled={!selectedProvider || isCloudProvider}
          />
        </FieldContainer>
      </div>
    </div>
  );
};

export { WebSearch };
