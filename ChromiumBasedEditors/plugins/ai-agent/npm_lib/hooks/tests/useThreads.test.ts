import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Capture useEffect callbacks
// ---------------------------------------------------------------------------

type EffectFn = () => undefined | (() => void);
const effectCallbacks: EffectFn[] = [];

vi.mock("react", () => ({
  useEffect: (fn: EffectFn) => {
    effectCallbacks.push(fn);
  },
  useRef: (val: unknown) => ({ current: val }),
  useContext: vi.fn(),
  createContext: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------

const mockInitThreads = vi.fn();
const mockInitPrompts = vi.fn();

const mockThreadsState = {
  initThreads: mockInitThreads,
};

const mockPromptsState = {
  initPrompts: mockInitPrompts,
};

const mockStores = {
  useThreadsStore: vi.fn(() => mockThreadsState),
  usePromptsStore: vi.fn(() => mockPromptsState),
};

vi.mock("../../store/context", () => ({
  useStores: () => mockStores,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import useThreads from "../useThreads";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useThreads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCallbacks.length = 0;
  });

  it("returns an empty object", () => {
    const result = useThreads({ isReady: true });
    expect(result).toEqual({});
  });

  it("registers a useEffect callback", () => {
    useThreads({ isReady: true });
    expect(effectCallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it("calls initThreads and initPrompts when isReady is true", () => {
    useThreads({ isReady: true });

    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockInitThreads).toHaveBeenCalled();
    expect(mockInitPrompts).toHaveBeenCalled();
  });

  it("does not call init when isReady is false", () => {
    useThreads({ isReady: false });

    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockInitThreads).not.toHaveBeenCalled();
    expect(mockInitPrompts).not.toHaveBeenCalled();
  });
});
