import { useEffect, useMemo, useRef } from "react";
import { debounce } from "@/lib/debounce";

export const useDebouncedCallback = <T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useMemo(
    () => debounce((...args: T) => callbackRef.current(...args), delay),
    [delay]
  );

  useEffect(() => () => debounced.cancel(), [debounced]);

  return debounced;
};
