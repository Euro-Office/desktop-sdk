import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Capture useEffect callbacks and cleanup functions
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
// Mock stores and tools context
// ---------------------------------------------------------------------------

const mockInitServers = vi.fn();
const mockGetTools = vi.fn();
const mockSetCurrentProviderTools = vi.fn();

const mockServersState = {
  initServers: mockInitServers,
  getTools: mockGetTools,
  tools: [{ name: "tool1" }],
};

const mockProfilesState = {
  defaultProfile: {
    id: "p1",
    name: "Test",
    providerType: "openai",
    baseUrl: "",
    key: "",
    modelId: "gpt-4",
  },
  chatProfile: null,
  sessionChatProfile: null,
};

const mockSelectCurrentChatProfile = (s: typeof mockProfilesState) =>
  s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile;

const mockHostToolSource = {
  setGroups: vi.fn(),
};

const mockServersInstance = {
  hostToolSource: mockHostToolSource,
};

const mockStores = {
  useServersStore: vi.fn(() => mockServersState),
  useProfilesStore: vi.fn(
    (selector?: (s: typeof mockProfilesState) => unknown) => {
      if (selector) return selector(mockProfilesState);
      return mockProfilesState;
    }
  ),
  selectCurrentChatProfile: mockSelectCurrentChatProfile,
};

vi.mock("../../store/context", () => ({
  useStores: () => mockStores,
}));

vi.mock("../../providers/provider-holder", () => ({
  getProviderInstance: () => ({
    setCurrentProviderTools: mockSetCurrentProviderTools,
  }),
}));

const mockHostToolGroups = [{ name: "host-group", tools: [] }];

vi.mock("../../tools/context", () => ({
  useToolsContext: () => ({
    servers: mockServersInstance,
    hostToolGroups: mockHostToolGroups,
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import useServers from "../useServers";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCallbacks.length = 0;
  });

  it("returns an empty object", () => {
    const result = useServers({ isReady: true });
    expect(result).toEqual({});
  });

  it("registers multiple useEffect callbacks", () => {
    useServers({ isReady: true });
    // The hook has 4 useEffect calls
    expect(effectCallbacks.length).toBe(4);
  });

  it("first effect syncs host tool groups and gets tools", () => {
    useServers({ isReady: true });

    // First effect: sync host tool groups
    effectCallbacks[0]();

    expect(mockHostToolSource.setGroups).toHaveBeenCalledWith(
      mockHostToolGroups
    );
    expect(mockGetTools).toHaveBeenCalled();
  });

  it("second effect initializes servers and sets up polling when isReady", () => {
    vi.useFakeTimers();

    useServers({ isReady: true });

    // Run first effect so getTools call count is known
    effectCallbacks[0]();
    const firstCallCount = mockGetTools.mock.calls.length;

    // Second effect: init + polling
    const cleanup = effectCallbacks[1]();

    expect(mockInitServers).toHaveBeenCalled();
    expect(mockGetTools).toHaveBeenCalledTimes(firstCallCount + 1);

    // Advance timer to trigger polling
    vi.advanceTimersByTime(1000 * 60 * 5);
    expect(mockGetTools).toHaveBeenCalledTimes(firstCallCount + 2);

    // Cleanup clears interval
    if (typeof cleanup === "function") {
      cleanup();
    }

    vi.useRealTimers();
  });

  it("second effect does not init when isReady is false", () => {
    useServers({ isReady: false });

    effectCallbacks[1]();

    // initServers should not be called (early return)
    expect(mockInitServers).not.toHaveBeenCalled();
  });

  it("tools-changed effect adds event listener and calls getTools on event", () => {
    const mockAddEventListener = vi.fn();
    const mockRemoveEventListener = vi.fn();
    vi.stubGlobal("window", {
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    });

    useServers({ isReady: true });

    // The tools-changed effect is the third one (index 2)
    const cleanup = effectCallbacks[2]();

    expect(mockAddEventListener).toHaveBeenCalledWith(
      "tools-changed",
      expect.any(Function)
    );

    // Simulate the event firing
    const handler = mockAddEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === "tools-changed"
    )?.[1] as () => void;
    expect(handler).toBeDefined();

    mockGetTools.mockClear();
    handler();
    expect(mockGetTools).toHaveBeenCalledTimes(1);

    // Cleanup should remove the listener
    if (typeof cleanup === "function") {
      cleanup();
    }
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      "tools-changed",
      expect.any(Function)
    );

    vi.unstubAllGlobals();
  });

  it("third effect sets provider tools when tools and profile exist", () => {
    useServers({ isReady: true });

    effectCallbacks[3]();

    expect(mockSetCurrentProviderTools).toHaveBeenCalledWith(
      mockServersState.tools
    );
  });

  it("third effect does not set provider tools when no profile", () => {
    const originalDefault = mockProfilesState.defaultProfile;
    // biome-ignore lint/suspicious/noExplicitAny: intentionally null to test guard
    mockProfilesState.defaultProfile = null as any;

    useServers({ isReady: true });
    effectCallbacks[3]();

    expect(mockSetCurrentProviderTools).not.toHaveBeenCalled();

    mockProfilesState.defaultProfile = originalDefault;
  });
});
