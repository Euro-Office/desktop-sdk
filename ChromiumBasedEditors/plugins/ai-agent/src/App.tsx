import { useMemo } from "react";
import { AIChatWidget } from "../npm_lib";
import { DEFAULT_STORE_KEYS } from "./config/store-keys";
import { migrateProvidersToProfiles } from "./lib/migrateProvidersToProfiles";
import { isDesktopEditor } from "./lib/utils";
import { NoopPlatform } from "./platform/noop";
import { OnlyOfficePlatform } from "./platform/onlyoffice";
import { LocalStorageSettings } from "./settings/localStorage";
import { IndexedDBStorage } from "./storage/indexeddb";

const App = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(
    () => (isDesktopEditor() ? new OnlyOfficePlatform() : new NoopPlatform()),
    []
  );

  return (
    <AIChatWidget
      storage={storage}
      settings={settings}
      platform={platform}
      storeKeys={DEFAULT_STORE_KEYS}
      onMigrate={migrateProvidersToProfiles}
    />
  );
};

export default App;
