import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let cleanupFn: (() => void) | undefined;

vi.mock("react", () => ({
  useRef: (val: unknown) => ({ current: val }),
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (fn: () => (() => void) | void) => {
    const result = fn();
    if (typeof result === "function") {
      cleanupFn = result;
    }
  },
}));

import { useDebouncedCallback } from "../useDebouncedCallback";

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanupFn = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a debounced function", () => {
    const callback = vi.fn();
    const debounced = useDebouncedCallback(callback, 100);

    expect(typeof debounced).toBe("function");
    expect(typeof debounced.cancel).toBe("function");
  });

  it("calls callback after delay", () => {
    const callback = vi.fn();
    const debounced = useDebouncedCallback(callback, 200);

    debounced();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("resets timer on subsequent calls", () => {
    const callback = vi.fn();
    const debounced = useDebouncedCallback(callback, 200);

    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("cleanup cancels the debounced function", () => {
    const callback = vi.fn();
    const debounced = useDebouncedCallback(callback, 200);

    debounced();
    expect(cleanupFn).toBeDefined();
    cleanupFn?.();

    vi.advanceTimersByTime(300);
    expect(callback).not.toHaveBeenCalled();
  });
});
