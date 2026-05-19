import type { AIChatWidgetRef } from "@onlyoffice/ai-chat";
import { type RefObject, useEffect, useState } from "react";
import type { IndexedDBStorage } from "@/shared/storage/indexeddb";

export const useIsChatReady = (
  storage: IndexedDBStorage,
  widgetRef: RefObject<AIChatWidgetRef | null>
): boolean => {
  const [hadProfilesAtStart, setHadProfilesAtStart] = useState<boolean | null>(
    null
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storage.profiles
      .readAll()
      .then((profiles) => {
        if (!cancelled) setHadProfilesAtStart(profiles.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHadProfilesAtStart(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (hadProfilesAtStart === null) return;
    if (!hadProfilesAtStart) {
      setIsReady(true);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 100;
    const intervalMs = 30;
    const tick = () => {
      if (cancelled) return;
      const profiles = widgetRef.current?.getProfiles?.();
      if ((profiles && profiles.length > 0) || ++attempts >= maxAttempts) {
        setIsReady(true);
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [hadProfilesAtStart, widgetRef]);

  return isReady;
};
