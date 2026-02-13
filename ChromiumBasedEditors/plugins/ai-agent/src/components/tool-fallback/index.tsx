import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { useDirection } from "@/hooks/useDirection";
import server from "@/servers";
import { IconButton } from "../icon-button";
import { Loader } from "../loader";

const TOOL_CALL_COLOR = "var(--chat-message-tool-call-name-color)";
export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isArgsCopied, setIsArgsCopied] = useState(false);
  const [isResultCopied, setIsResultCopied] = useState(false);

  useEffect(() => {
    if (isArgsCopied) {
      setTimeout(() => {
        setIsArgsCopied(false);
      }, 2000);
    }
  }, [isArgsCopied]);

  useEffect(() => {
    if (isResultCopied) {
      setTimeout(() => {
        setIsResultCopied(false);
      }, 2000);
    }
  }, [isResultCopied]);

  const type = server.getServerType(toolName);
  const name = toolName.replace(`${type}_`, "");

  const isLoading = result === undefined;

  const isWebSearch = name === "web_search";
  const isWebCrawling = name === "web_crawling";

  let webSearchName = "";

  let argsTextFinal = argsText;

  try {
    const parsedArgs = JSON.parse(argsTextFinal);

    if (parsedArgs.args) {
      argsTextFinal = JSON.stringify(parsedArgs.args);
    }

    webSearchName = argsTextFinal
      ? isWebSearch
        ? JSON.parse(argsTextFinal).query
        : isWebCrawling
          ? JSON.parse(argsTextFinal).urls[0]
          : ""
      : "";
  } catch {
    //ignore
  }

  let parsedResult = result;
  try {
    parsedResult = typeof result === "string" ? JSON.parse(result) : result;
  } catch {
    // ignore
  }

  return (
    <div className="my-[16px] flex w-full flex-col gap-3">
      <div
        className="flex items-center gap-[10px] cursor-pointer"
        onClick={() => {
          if (isWebCrawling) {
            window.open(webSearchName, "_blank");
            return;
          }

          if (isWebSearch && result === undefined) {
            return;
          }

          setIsCollapsed(!isCollapsed);
        }}
      >
        {!isLoading ? (
          <Icon
            name={parsedResult?.data?.error ? "status.error" : "tool.called"}
            size={16}
            noColor
          />
        ) : (
          <Loader size={16} />
        )}
        {isLoading && !isWebSearch && !isWebCrawling ? (
          <p className="text-[var(--chat-message-tool-call-header-color)] text-[14px] font-normal leading-[16px]">
            {t("ToolExecuted")}
          </p>
        ) : null}
        <span className="flex items-center gap-[8px] rounded-[4px] ps-[4px] pe-[8px] text-[14px] leading-[20px] font-normal text-[var(--chat-message-tool-call-name-color)] bg-[var(--chat-message-tool-call-name-background-color)] min-w-0 w-fit">
          {isWebSearch ? (
            <Icon name="btn-web-search" size={24} color={TOOL_CALL_COLOR} />
          ) : !isWebCrawling ? (
            <Icon name="code" size={24} color={TOOL_CALL_COLOR} isStroke />
          ) : null}
          <span className="truncate">
            {isWebSearch
              ? webSearchName
              : isWebCrawling
                ? `${name} | ${webSearchName}`
                : name}
          </span>
        </span>
        {isWebCrawling ? (
          <Icon
            name="btn-external"
            size={16}
            color={TOOL_CALL_COLOR}
            isStroke
          />
        ) : isWebSearch && result === undefined ? null : (
          <span className={isRTL && isCollapsed ? "rotate-180" : ""}>
            <Icon
              name={!isCollapsed ? "arrow.bottom" : "arrow.right"}
              size={16}
              width={8}
              height={8}
              color={TOOL_CALL_COLOR}
              isStroke
            />
          </span>
        )}
      </div>
      {!isCollapsed ? (
        <div className="flex flex-col gap-[24px] mt-[8px] p-[12px] bg-[var(--chat-message-tool-call-body-background-color)] rounded-[12px]">
          {isWebSearch ? null : (
            <div className="">
              <p className="flex flex-row items-center justify-between text-[var(--chat-message-tool-call-header-color)] text-[14px] font-bold leading-[20px]">
                {t("ToolCallArguments")}
                <span
                  onClick={() => setIsArgsCopied(true)}
                  className="cursor-pointer"
                >
                  <Icon
                    name={isArgsCopied ? "checked" : "btn-copy"}
                    size={24}
                    color={TOOL_CALL_COLOR}
                    isStroke={isArgsCopied}
                  />
                </span>
              </p>
              <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                {argsTextFinal ? argsTextFinal : "{}"}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div className="">
              {isWebSearch ? (
                <div>
                  {(() => {
                    try {
                      // Check if there's an error in the result

                      if (parsedResult?.data?.error) {
                        return (
                          <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                            {typeof parsedResult === "string"
                              ? result
                              : parsedResult?.data?.error}
                          </pre>
                        );
                      }

                      const searchResults = parsedResult?.data || [];

                      return searchResults.length > 0 ? (
                        <div className="flex flex-col gap-[10px]">
                          {searchResults.map(
                            (
                              item: {
                                id: string;
                                title: string;
                                url: string;
                                publishedDate?: string;
                                author?: string;
                              },
                              _index: number
                            ) => (
                              <div
                                key={item.id}
                                className="group h-[36px] px-[8px] rounded-[4px] flex flex-row items-center justify-between cursor-pointer hover:bg-[var(--drop-down-menu-item-hover-color)] transition-colors"
                                onClick={() => window.open(item.url, "_blank")}
                              >
                                <div className="flex flex-row items-center gap-[8px] min-w-0 flex-1">
                                  <IconButton
                                    iconName="btn-web-search"
                                    size={24}
                                    disableHover
                                  />
                                  <h4 className="text-[14px] font-normal text-[var(--chat-message-tool-call-pre-color)] truncate">
                                    {item.title}
                                  </h4>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <IconButton
                                    iconName="btn-external"
                                    size={24}
                                    disableHover
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                          {typeof result === "string"
                            ? result
                            : JSON.stringify(result, null, 2)}
                        </pre>
                      );
                    } catch {
                      return (
                        <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                          {typeof result === "string"
                            ? result
                            : JSON.stringify(result, null, 2)}
                        </pre>
                      );
                    }
                  })()}
                </div>
              ) : (
                <>
                  <p className="flex flex-row items-center justify-between text-[var(--chat-message-tool-call-header-color)] text-[14px] font-bold leading-[20px]">
                    {t("ToolCallResult")}
                    <span
                      onClick={() => setIsResultCopied(true)}
                      className="cursor-pointer"
                    >
                      <Icon
                        name={isResultCopied ? "checked" : "btn-copy"}
                        size={24}
                        color={TOOL_CALL_COLOR}
                        isStroke={isResultCopied}
                      />
                    </span>
                  </p>
                  <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-[var(--chat-message-tool-call-pre-color)] border border-[var(--chat-message-tool-call-pre-border-color)] bg-[var(--chat-message-tool-call-pre-background-color)] px-[8px] py-[2px] rounded-[4px]">
                    {typeof result === "string"
                      ? result
                      : JSON.stringify(result, null, 2)}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
