import type { ThreadMessageLike } from "@assistant-ui/react";
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

const mockSetIsStreamRunning = vi.fn();
const mockSetIsRequestRunning = vi.fn();
const mockAddMessage = vi.fn();
const mockUpdateLastMessage = vi.fn();
const mockFetchPrevMessages = vi.fn();
const mockInsertThread = vi.fn();
const mockInsertNewMessageToThread = vi.fn();
const mockSetManageToolData = vi.fn();
const mockClearAttachmentFiles = vi.fn();
const mockClearAttachmentImages = vi.fn();

const mockChatEngine = {
  sendMessage: vi.fn(),
  approveToolCall: vi.fn(),
  denyToolCall: vi.fn(),
  handleToolCall: vi.fn(),
};

const mockMessageState = {
  messages: [] as ThreadMessageLike[],
  setIsStreamRunning: mockSetIsStreamRunning,
  setIsRequestRunning: mockSetIsRequestRunning,
  addMessage: mockAddMessage,
  updateLastMessage: mockUpdateLastMessage,
  fetchPrevMessages: mockFetchPrevMessages,
};

const mockThreadsState = {
  threadId: "t1",
  insertThread: mockInsertThread,
  insertNewMessageToThread: mockInsertNewMessageToThread,
  threads: [],
};

const mockServersState = {
  manageToolData: undefined as
    | undefined
    | { message: ThreadMessageLike; idx: number; messageUID: string },
  setManageToolData: mockSetManageToolData,
};

const mockAttachmentsState = {
  attachmentFiles: [] as Array<{ path: string; content: string; type: string }>,
  clearAttachmentFiles: mockClearAttachmentFiles,
  attachmentImages: [] as Array<{ name: string; base64: string }>,
  clearAttachmentImages: mockClearAttachmentImages,
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
  extendedThinking: false,
};

const mockSelectCurrentChatProfile = (s: typeof mockProfilesState) =>
  s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile;

const mockThreadsStoreGetState = vi.fn(() => mockThreadsState);

const mockStores = {
  useMessageStore: vi.fn(() => mockMessageState),
  useThreadsStore: Object.assign(
    vi.fn(() => mockThreadsState),
    {
      getState: mockThreadsStoreGetState,
    }
  ),
  useServersStore: vi.fn(() => mockServersState),
  useAttachmentsStore: vi.fn(() => mockAttachmentsState),
  useProfilesStore: vi.fn(
    (selector?: (s: typeof mockProfilesState) => unknown) => {
      if (selector) return selector(mockProfilesState);
      return mockProfilesState;
    }
  ),
  chatEngine: mockChatEngine,
  selectCurrentChatProfile: mockSelectCurrentChatProfile,
};

vi.mock("../../store/context", () => ({
  useStores: () => mockStores,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import useMessages from "../useMessages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function* emptyAsyncGen(): AsyncGenerator<never> {
  // yields nothing
}

async function* eventGen(
  events: Array<{
    type: string;
    message?: ThreadMessageLike;
    messageUID?: string;
    title?: string;
    profileId?: string;
    idx?: number;
  }>
) {
  for (const e of events) {
    yield e;
  }
}

const flush = () => new Promise((r) => setTimeout(r, 10));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCallbacks.length = 0;
    mockServersState.manageToolData = undefined;
    mockAttachmentsState.attachmentFiles = [];
    mockAttachmentsState.attachmentImages = [];
    mockMessageState.messages = [];
    mockThreadsState.threads = [];
  });

  it("returns onNew, approveToolCall, denyToolCall", () => {
    const result = useMessages({ isReady: true });
    expect(result).toHaveProperty("onNew");
    expect(result).toHaveProperty("approveToolCall");
    expect(result).toHaveProperty("denyToolCall");
    expect(typeof result.onNew).toBe("function");
    expect(typeof result.approveToolCall).toBe("function");
    expect(typeof result.denyToolCall).toBe("function");
  });

  it("registers useEffect callbacks", () => {
    useMessages({ isReady: true });
    expect(effectCallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it("useEffect fetches prev messages when isReady", () => {
    useMessages({ isReady: true });

    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockFetchPrevMessages).toHaveBeenCalledWith("t1");
    expect(mockClearAttachmentFiles).toHaveBeenCalled();
  });

  it("useEffect does not fetch when isReady is false", () => {
    useMessages({ isReady: false });

    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockFetchPrevMessages).not.toHaveBeenCalled();
  });

  it("onNew sends message via chatEngine", async () => {
    mockChatEngine.sendMessage.mockReturnValue(emptyAsyncGen());

    const { onNew } = useMessages({ isReady: true });

    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });

    expect(mockAddMessage).toHaveBeenCalled();
    expect(mockChatEngine.sendMessage).toHaveBeenCalled();

    const callArgs = mockChatEngine.sendMessage.mock.calls[0][0];
    expect(callArgs.text).toBe("hello");
    expect(callArgs.threadId).toBe("t1");
  });

  it("onNew does nothing if no current profile", async () => {
    // Override profilesStore to return no profile
    const originalDefault = mockProfilesState.defaultProfile;
    // biome-ignore lint/suspicious/noExplicitAny: intentionally null to test guard
    mockProfilesState.defaultProfile = null as any;

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });

    expect(mockChatEngine.sendMessage).not.toHaveBeenCalled();
    mockProfilesState.defaultProfile = originalDefault;
  });

  it("onNew does nothing if message content is not text", async () => {
    const { onNew } = useMessages({ isReady: true });
    await onNew({
      // biome-ignore lint/suspicious/noExplicitAny: testing non-text content guard
      content: [{ type: "image", image: "base64" } as any],
      parentId: "root",
    });

    expect(mockChatEngine.sendMessage).not.toHaveBeenCalled();
  });

  it("onNew clears attachments if present", async () => {
    mockAttachmentsState.attachmentFiles = [
      { path: "/a.pdf", content: "data", type: "pdf" },
    ];
    mockAttachmentsState.attachmentImages = [
      { name: "img.png", base64: "abc" },
    ];
    mockChatEngine.sendMessage.mockReturnValue(emptyAsyncGen());

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });

    expect(mockClearAttachmentFiles).toHaveBeenCalled();
    expect(mockClearAttachmentImages).toHaveBeenCalled();
  });

  it("onNew calls insertNewMessageToThread for existing thread", async () => {
    mockThreadsState.threads = [
      { threadId: "t1", title: "Chat", lastEditDate: Date.now() },
    ] as typeof mockThreadsState.threads;
    mockThreadsStoreGetState.mockReturnValue(mockThreadsState);
    mockChatEngine.sendMessage.mockReturnValue(emptyAsyncGen());

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });

    expect(mockInsertNewMessageToThread).toHaveBeenCalledWith({
      profileId: "p1",
    });
  });

  it("approveToolCall does nothing if manageToolData is undefined", () => {
    mockServersState.manageToolData = undefined;

    const { approveToolCall } = useMessages({ isReady: true });
    approveToolCall(false);

    expect(mockChatEngine.approveToolCall).not.toHaveBeenCalled();
  });

  it("approveToolCall calls chatEngine.approveToolCall with data", () => {
    const toolMessage: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "tc1", toolName: "test", args: {} },
      ],
    };
    mockServersState.manageToolData = {
      message: toolMessage,
      idx: 0,
      messageUID: "uid-1",
    };
    mockChatEngine.approveToolCall.mockReturnValue(emptyAsyncGen());

    const { approveToolCall } = useMessages({ isReady: true });
    approveToolCall(true);

    expect(mockSetManageToolData).toHaveBeenCalledWith(undefined);
    expect(mockChatEngine.approveToolCall).toHaveBeenCalledWith(
      { message: toolMessage, idx: 0, messageUID: "uid-1" },
      true,
      false
    );
  });

  it("denyToolCall does nothing if manageToolData is undefined", () => {
    mockServersState.manageToolData = undefined;

    const { denyToolCall } = useMessages({ isReady: true });
    denyToolCall();

    expect(mockChatEngine.denyToolCall).not.toHaveBeenCalled();
  });

  // --- processEvents coverage via onNew ---
  // Note: processEvents is fire-and-forget (not awaited by onNew), need flush()

  it("onNew: processEvents handles message-start event", async () => {
    const msg: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "hi" }],
    };
    mockChatEngine.sendMessage.mockReturnValue(
      eventGen([
        { type: "message-start", message: msg, messageUID: "u1" },
        { type: "message-end", message: msg, messageUID: "u1" },
      ])
    );

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });
    await flush();

    expect(mockSetIsStreamRunning).toHaveBeenCalledWith(true);
    expect(mockSetIsRequestRunning).toHaveBeenCalledWith(true);
    expect(mockAddMessage).toHaveBeenCalledWith(msg);
    expect(mockSetIsStreamRunning).toHaveBeenCalledWith(false);
    expect(mockSetIsRequestRunning).toHaveBeenCalledWith(false);
  });

  it("onNew: processEvents handles message-delta event", async () => {
    const msg: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "partial" }],
    };
    const updated: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "full response" }],
    };
    mockChatEngine.sendMessage.mockReturnValue(
      eventGen([
        { type: "message-start", message: msg, messageUID: "u1" },
        { type: "message-delta", message: updated, messageUID: "u1" },
        { type: "message-end", message: updated, messageUID: "u1" },
      ])
    );

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });
    await flush();

    expect(mockUpdateLastMessage).toHaveBeenCalledWith(updated);
  });

  it("onNew: processEvents handles message-incomplete event", async () => {
    const msg: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "partial" }],
      status: { type: "incomplete", reason: "error" },
    };
    mockChatEngine.sendMessage.mockReturnValue(
      eventGen([{ type: "message-incomplete", message: msg }])
    );

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });
    await flush();

    expect(mockAddMessage).toHaveBeenCalledWith(msg);
    expect(mockSetIsStreamRunning).toHaveBeenCalledWith(false);
  });

  it("onNew: processEvents handles thread-title event", async () => {
    mockChatEngine.sendMessage.mockReturnValue(
      eventGen([{ type: "thread-title", title: "New Chat", profileId: "p1" }])
    );

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });
    await flush();

    expect(mockInsertThread).toHaveBeenCalledWith("New Chat", {
      profileId: "p1",
    });
  });

  it("onNew: processEvents handles tool-call-pending with auto-allow", async () => {
    const toolMsg: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "tc1",
          toolName: "test",
          args: {},
        },
      ],
    };
    // chatEngine.sendMessage yields tool-call-pending
    mockChatEngine.sendMessage.mockReturnValue(
      eventGen([
        {
          type: "tool-call-pending",
          message: toolMsg,
          idx: 0,
          messageUID: "u1",
        },
      ])
    );
    // handleToolCall yields message-delta (auto-allowed) then message-end
    const deltaMsg: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "result" }],
    };
    mockChatEngine.handleToolCall.mockReturnValue(
      eventGen([
        { type: "message-delta", message: deltaMsg, messageUID: "u1" },
        { type: "message-end", message: deltaMsg, messageUID: "u1" },
      ])
    );

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });
    await flush();

    expect(mockChatEngine.handleToolCall).toHaveBeenCalled();
    // processEvent was called for message-delta
    expect(mockUpdateLastMessage).toHaveBeenCalledWith(deltaMsg);
  });

  it("onNew: processEvents handles tool-call-pending without auto-allow (UI prompt)", async () => {
    const toolMsg: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "tc1",
          toolName: "test",
          args: {},
        },
      ],
    };
    mockChatEngine.sendMessage.mockReturnValue(
      eventGen([
        {
          type: "tool-call-pending",
          message: toolMsg,
          idx: 0,
          messageUID: "u1",
        },
      ])
    );
    // handleToolCall re-yields tool-call-pending (not auto-allowed)
    mockChatEngine.handleToolCall.mockReturnValue(
      eventGen([
        {
          type: "tool-call-pending",
          message: toolMsg,
          idx: 0,
          messageUID: "u1",
        },
      ])
    );

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });

    await flush();

    // Should set manageToolData for UI prompt
    expect(mockSetManageToolData).toHaveBeenCalledWith({
      message: toolMsg,
      idx: 0,
      messageUID: "u1",
    });
  });

  // --- processEvent coverage via inner events ---

  it("processEvent: handles message-start from inner tool call events", async () => {
    const toolMsg: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "tc1", toolName: "test", args: {} },
      ],
    };
    const startMsg: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "after tool" }],
    };
    mockChatEngine.sendMessage.mockReturnValue(
      eventGen([
        {
          type: "tool-call-pending",
          message: toolMsg,
          idx: 0,
          messageUID: "u1",
        },
      ])
    );
    mockChatEngine.handleToolCall.mockReturnValue(
      eventGen([
        { type: "message-start", message: startMsg, messageUID: "u2" },
        { type: "message-end", message: startMsg, messageUID: "u2" },
      ])
    );

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });

    await flush();

    // processEvent called with message-start
    expect(mockAddMessage).toHaveBeenCalledWith(startMsg);
  });

  it("processEvent: handles message-incomplete from inner events", async () => {
    const toolMsg: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "tc1", toolName: "test", args: {} },
      ],
    };
    const incompleteMsg: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "partial" }],
      status: { type: "incomplete", reason: "error" },
    };
    mockChatEngine.sendMessage.mockReturnValue(
      eventGen([
        {
          type: "tool-call-pending",
          message: toolMsg,
          idx: 0,
          messageUID: "u1",
        },
      ])
    );
    mockChatEngine.handleToolCall.mockReturnValue(
      eventGen([{ type: "message-incomplete", message: incompleteMsg }])
    );

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });

    await flush();

    expect(mockAddMessage).toHaveBeenCalledWith(incompleteMsg);
    expect(mockSetIsStreamRunning).toHaveBeenCalledWith(false);
  });

  it("processEvent: handles thread-title from inner events", async () => {
    const toolMsg: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "tc1", toolName: "test", args: {} },
      ],
    };
    mockChatEngine.sendMessage.mockReturnValue(
      eventGen([
        {
          type: "tool-call-pending",
          message: toolMsg,
          idx: 0,
          messageUID: "u1",
        },
      ])
    );
    mockChatEngine.handleToolCall.mockReturnValue(
      eventGen([{ type: "thread-title", title: "Auto Title", profileId: "p2" }])
    );

    const { onNew } = useMessages({ isReady: true });
    await onNew({
      content: [{ type: "text", text: "hello" }],
      parentId: "root",
    });

    await flush();

    expect(mockInsertThread).toHaveBeenCalledWith("Auto Title", {
      profileId: "p2",
    });
  });

  it("denyToolCall calls chatEngine.denyToolCall with data", () => {
    const toolMessage: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "tc1", toolName: "test", args: {} },
      ],
    };
    mockServersState.manageToolData = {
      message: toolMessage,
      idx: 0,
      messageUID: "uid-2",
    };
    mockChatEngine.denyToolCall.mockReturnValue(emptyAsyncGen());

    const { denyToolCall } = useMessages({ isReady: true });
    denyToolCall();

    expect(mockSetManageToolData).toHaveBeenCalledWith(undefined);
    expect(mockChatEngine.denyToolCall).toHaveBeenCalledWith(
      { message: toolMessage, idx: 0, messageUID: "uid-2" },
      false
    );
  });
});
