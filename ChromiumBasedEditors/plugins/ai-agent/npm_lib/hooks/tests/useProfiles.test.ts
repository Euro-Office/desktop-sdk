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

const mockInit = vi.fn();

const mockProfilesState = {
  init: mockInit,
};

const mockStores = {
  useProfilesStore: vi.fn(() => mockProfilesState),
};

vi.mock("../../store/context", () => ({
  useStores: () => mockStores,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import useProfiles from "../useProfiles";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCallbacks.length = 0;
  });

  it("returns an empty object", () => {
    const result = useProfiles({ isReady: true });
    expect(result).toEqual({});
  });

  it("registers a useEffect callback", () => {
    useProfiles({ isReady: true });
    expect(effectCallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it("calls init() when isReady is true", () => {
    useProfiles({ isReady: true });

    // Run captured effect
    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockInit).toHaveBeenCalled();
  });

  it("does not call init() when isReady is false", () => {
    useProfiles({ isReady: false });

    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockInit).not.toHaveBeenCalled();
  });
});
