import React from "react";
import { useTranslation } from "react-i18next";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { Input } from "@/components/input";
import { Link } from "@/components/link";
import { useDirection } from "@/hooks/useDirection";
import { getApiKeyLink } from "@/lib/apiKeyLinks";
import { cn } from "@/lib/utils";
import useCloudsStore from "@/store/useCloudsStore";
import { getServersInstance } from "../../../npm_lib/tools/tools-holder";

type WebSearchProps = {
  variant?: "tab" | "page";
};

type WebSearchProvider = {
  id: string;
  label: string;
  baseUrl?: string;
  key?: string;
  isCloudProvider?: boolean;
};

const WEB_SEARCH_PROVIDERS: WebSearchProvider[] = [
  { id: "Exa", label: "Exa", baseUrl: "https://api.exa.ai" },
  { id: "ONLYOFFICE", label: "ONLYOFFICE" },
];

const WebSearch = ({ variant = "tab" }: WebSearchProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { clouds } = useCloudsStore();

  const [selectedId, setSelectedId] = React.useState<string>("Exa");
  const [apiKey, setApiKey] = React.useState<string>("");
  const [baseUrl, setBaseUrl] = React.useState<string>("");
  const [baseUrlError, setBaseUrlError] = React.useState<string>("");

  const allProviders = React.useMemo<WebSearchProvider[]>(
    () => [
      ...clouds.map((cloud) => ({
        id: cloud.url,
        label: new URL(cloud.url).hostname,
        baseUrl: cloud.url,
        key: cloud.keys[0].value || "",
        isCloudProvider: true,
      })),
      ...WEB_SEARCH_PROVIDERS,
    ],
    [clouds]
  );

  const provider = allProviders.find((p) => p.id === selectedId);

  React.useEffect(() => {
    const data = getServersInstance().getWebSearchData();

    if (data) {
      setSelectedId(data.provider);
      setApiKey(data.key);
      setBaseUrl(data.baseUrl ?? "");
    }
  }, []);

  const saveData = (desc: WebSearchProvider) => {
    const resolvedUrl = desc.baseUrl ?? baseUrl;

    if (!desc.baseUrl) {
      try {
        new URL(baseUrl);
      } catch {
        getServersInstance().setWebSearchData(null);
        return;
      }
    }

    if (apiKey) {
      getServersInstance().setWebSearchData({
        provider: desc.id,
        key: apiKey,
        baseUrl: resolvedUrl,
      });
    } else {
      getServersInstance().setWebSearchData(null);
    }
  };

  const handleSelect = (selected: WebSearchProvider) => {
    setSelectedId(selected.id);
    setApiKey(selected.key ?? "");
    setBaseUrl("");
    setBaseUrlError("");

    if (selected.isCloudProvider) {
      getServersInstance().setWebSearchData({
        provider: selected.id,
        key: selected.key ?? "",
        baseUrl: selected.baseUrl ?? "",
        isCloudProvider: true,
      });
    } else {
      getServersInstance().setWebSearchData(null);
    }
  };

  const handleBaseUrlBlur = () => {
    if (!provider) return;
    try {
      new URL(baseUrl);
      setBaseUrlError("");
    } catch {
      setBaseUrlError(t("InvalidUrl"));
    }
    saveData(provider);
  };

  const handleApiKeyBlur = () => {
    if (!provider) return;
    saveData(provider);
  };

  const isPage = variant === "page";

  const comboItems = allProviders.map((p) => ({
    text: p.label,
    id: p.id,
    onClick: () => handleSelect(p),
  }));

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
            value={provider?.label ?? t("SelectEngine")}
            items={comboItems}
          />
        </FieldContainer>
        {!provider?.baseUrl && (
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
            !provider?.isCloudProvider && getApiKeyLink(selectedId) ? (
              <Link href={getApiKeyLink(selectedId)} target="_blank">
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
            onBlur={provider?.isCloudProvider ? undefined : handleApiKeyBlur}
            disabled={!selectedId || provider?.isCloudProvider}
          />
        </FieldContainer>
      </div>
    </div>
  );
};

export { WebSearch };
