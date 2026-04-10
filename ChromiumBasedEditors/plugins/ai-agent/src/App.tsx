import { useMemo } from "react";
import { AIChatWidget } from "../npm_lib";
import { isDesktopEditor } from "../npm_lib/lib/utils";
import config from "./config.json";
import { migrateProvidersToProfiles } from "./lib/migrateProvidersToProfiles";
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
      onMigrate={migrateProvidersToProfiles}
      features={{ showWallet: config.showWallet }}
    />
  );
};

export default App;
