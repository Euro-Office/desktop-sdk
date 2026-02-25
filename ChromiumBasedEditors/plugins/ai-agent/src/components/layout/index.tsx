import React from "react";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import useRouter from "@/store/useRouter";
import useThemeStore from "@/store/useThemeStore";
import { ChatList } from "./sub-components/ChatList";
import { Navigation } from "./sub-components/Header";

const getSystemTheme = (system: "dark" | "light") => {
  if (system === "dark") {
    return "theme-night";
  }

  return "theme-white";
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { currentPage } = useRouter();
  const { themeId, setThemeId } = useThemeStore();

  const { i18n } = useTranslation();
  const { isRTL } = useDirection();

  React.useLayoutEffect(() => {
    if (window.RendererProcessVariable) {
      i18n.changeLanguage(window.RendererProcessVariable.lang);
    }

    window.on_update_plugin_info = (info) => {
      if (info.lang) {
        i18n.changeLanguage(info.lang);
      }

      if (info.theme) {
        if (info.theme === "theme-system") {
          const resolvedTheme = getSystemTheme(
            window.RendererProcessVariable.theme.system as "dark" | "light"
          );
          setThemeId(resolvedTheme);
        } else {
          setThemeId(info.theme);
        }
      }
    };
  }, [i18n, setThemeId]);

  const isSettings = currentPage === "settings";

  return (
    <div
      className={`h-[100vh] ${themeId} ${isRTL ? "font-rtl" : ""}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <main
        id="app"
        className="h-[100vh] bg-[var(--layout-background-color)] flex flex-col"
      >
        <Navigation />
        <div
          className="flex flex-row flex-1"
          style={{ height: "calc(100vh - 56px)" }}
        >
          {!isSettings ? <ChatList /> : null}
          <div className="w-full">{children}</div>
        </div>
      </main>
    </div>
  );
};

export { Layout };
