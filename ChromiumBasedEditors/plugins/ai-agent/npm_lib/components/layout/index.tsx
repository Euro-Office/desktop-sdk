import React from "react";
import { useTranslation } from "react-i18next";
import { usePlatform } from "../../platform/context";
import { useDirection } from "../../hooks/useDirection";
import { useStores } from "../../store/context";
import { ChatList } from "./sub-components/ChatList";
import { Navigation } from "./sub-components/Header";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { useRouter, useThemeStore, useCloudsStore } = useStores();
  const { currentPage } = useRouter();
  const { themeId, setThemeId, initFromPlatform } = useThemeStore();
  const platform = usePlatform();
  const { fetchClouds } = useCloudsStore();

  // Initialize theme from platform on first render (after PlatformProvider is mounted)
  initFromPlatform();

  const { i18n } = useTranslation();
  const { isRTL } = useDirection();

  React.useLayoutEffect(() => {
    i18n.changeLanguage(platform.env.locale);

    const unsubscribe = platform.env.onEnvironmentChange?.((info) => {
      if (info.lang) {
        i18n.changeLanguage(info.lang);
      }

      if (info.theme) {
        if (info.theme === "theme-system") {
          const resolved =
            platform.env.systemTheme === "dark" ? "theme-night" : "theme-white";
          setThemeId(resolved);
        } else {
          setThemeId(info.theme);
        }
      }
    });

    const unsubscribeClouds = platform.clouds?.onCloudsChange?.(fetchClouds);

    return () => {
      unsubscribe?.();
      unsubscribeClouds?.();
    };
  }, [i18n, setThemeId, platform, fetchClouds]);

  const isHistory = currentPage === "history";

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
          {isHistory ? <ChatList /> : <div className="w-full">{children}</div>}
        </div>
      </main>
    </div>
  );
};

export { Layout };
