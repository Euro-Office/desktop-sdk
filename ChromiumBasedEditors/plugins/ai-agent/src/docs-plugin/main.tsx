import type { Profile, StorageAdapter } from "@onlyoffice/ai-chat";
import { isDesktopEditor } from "@/shared/lib/utils";
import {
  type CrossPluginEvents,
  crossPluginBus,
} from "@/shared/sync/crossPluginBus";
import {
  ACTION_DIALOG_EVENTS,
  DELETE_DIALOG_EVENTS,
} from "./ai-actions/dialog-events";
import { getIconToolbarPath } from "./ai-actions/icons";
import { deleteAction, findAction, loadActions } from "./ai-actions/storage";
import type { CustomAiAction } from "./ai-actions/types";
import { initAiAgentEngine, summarize, translate } from "./engine";
import {
  DEFAULT_TRANSLATION_LANG,
  TRANSLATION_LANG_KEY,
} from "./engine/languages";
import { install as installLibrary } from "./library";
import { editor } from "./library/editor";
import { prompts } from "./library/prompts";
import { TextAnnotationPopup } from "./text-annotations/annotation-popup";
import { CustomActionManager } from "./text-annotations/custom-actions/manager";
import { GrammarChecker } from "./text-annotations/grammar-checker";
import { SpellChecker } from "./text-annotations/spelling-checker";

let engineStorage: StorageAdapter | null = null;

interface ProfileSummary {
  id: string;
  name: string;
}

function profileSummary(profile: Profile): ProfileSummary {
  return { id: profile.id, name: profile.name };
}

const AI_STATE_EVENT = "onAiStateChanged";

type SyncEventName = keyof CrossPluginEvents;

type SyncPayload = {
  [K in SyncEventName]: { event: K; data: CrossPluginEvents[K] };
}[SyncEventName];

const SYNC_EVENT_NAMES: readonly SyncEventName[] = [
  "modelAssignmentUpdated",
  "currentChatProfileUpdated",
  "profilesUpdated",
  "serversUpdated",
  "webSearchUpdated",
  "threadsUpdated",
  "extendedThinkingUpdated",
];

function parsePayload(raw: unknown): SyncPayload | null {
  const payload =
    typeof raw === "string"
      ? (JSON.parse(raw) as SyncPayload)
      : (raw as SyncPayload);

  if (!payload || typeof payload !== "object" || !("event" in payload)) {
    return null;
  }

  if (!SYNC_EVENT_NAMES.includes(payload.event)) {
    return null;
  }

  return payload;
}

function notifyDesktopPlugin(payload: SyncPayload): void {
  console.log(`[Docs bg] → bus: ${payload.event}`, payload.data);
  switch (payload.event) {
    case "modelAssignmentUpdated":
      crossPluginBus.publish("modelAssignmentUpdated", payload.data);
      return;
    case "currentChatProfileUpdated":
      crossPluginBus.publish("currentChatProfileUpdated", payload.data);
      return;
    case "profilesUpdated":
      crossPluginBus.publish("profilesUpdated", payload.data);
      return;
    case "serversUpdated":
      crossPluginBus.publish("serversUpdated", payload.data);
      return;
    case "webSearchUpdated":
      crossPluginBus.publish("webSearchUpdated", payload.data);
      return;
    case "threadsUpdated":
      crossPluginBus.publish("threadsUpdated", payload.data);
      return;
    case "extendedThinkingUpdated":
      crossPluginBus.publish("extendedThinkingUpdated", payload.data);
      return;
  }
}

async function handleTranslation(): Promise<void> {
  const lib = window.Asc.Library;
  if (!lib) return;
  const text = await lib.GetSelectedText();
  if (!text.trim()) return;
  const lang =
    localStorage.getItem(TRANSLATION_LANG_KEY) ?? DEFAULT_TRANSLATION_LANG;

  window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
  try {
    const result = await translate(text, lang);
    await lib.PasteText(result);
  } finally {
    window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
  }
}

type WindowId =
  | "chat"
  | "settings"
  | "translation"
  | "summarization"
  | "custom-action"
  | "custom-action-delete";

const windows = new Map<WindowId, AscPluginWindow | null>([
  ["chat", null],
  ["settings", null],
  ["translation", null],
  ["summarization", null],
  ["custom-action", null],
  ["custom-action-delete", null],
]);

function notifyPluginWindows(serialized: string, except?: WindowId): void {
  for (const [id, win] of windows) {
    if (id !== except) win?.command(AI_STATE_EVENT, serialized);
  }
}

function listenForDesktopPluginUpdates(): void {
  for (const event of SYNC_EVENT_NAMES) {
    crossPluginBus.subscribe(event, (data) => {
      console.log(`[Docs bg] ← bus: ${event}`, data);
      notifyPluginWindows(JSON.stringify({ event, data }));
    });
  }
}

function registerWindow(id: WindowId, win: AscPluginWindow): void {
  windows.set(id, win);
  win.attachEvent(AI_STATE_EVENT, (raw) => {
    const payload = parsePayload(raw);
    if (!payload) return;
    console.log(`[Docs bg] ← from ${id}: ${payload.event}`, payload.data);
    if (isDesktopEditor()) notifyDesktopPlugin(payload);
    notifyPluginWindows(JSON.stringify(payload), id);
  });
}

function openSettings() {
  const existing = windows.get("settings");
  if (existing) {
    existing.activate();
    return;
  }

  const settingsWindow = new window.Asc.PluginWindow();
  registerWindow("settings", settingsWindow);
  settingsWindow.show({
    url: "settings.html",
    description: "AI Settings",
    type: "window",
    EditorsSupport: ["word", "slide", "cell", "pdf"],
    isVisual: true,
    icons:
      "resources/%theme-type%(light|dark)/big/settings%scale%(default).png",
    size: [470, 600],
  });
}

function openTranslationSettings() {
  const existing = windows.get("translation");
  if (existing) {
    existing.activate();
    return;
  }

  const win = new window.Asc.PluginWindow();
  registerWindow("translation", win);
  win.show({
    url: "translation.html",
    description: "Translation settings",
    type: "window",
    EditorsSupport: ["word", "slide", "cell", "pdf"],
    isVisual: true,
    size: [320, 200],
    buttons: [{ text: "OK", primary: true }, { text: "Cancel" }],
  });
}

function openSummarizationWindow() {
  const existing = windows.get("summarization");
  if (existing) {
    existing.activate();
    return;
  }

  const win = new window.Asc.PluginWindow();

  win.attachEvent("onInit", async () => {
    const text = (await window.Asc.Library?.GetSelectedText()) ?? "";
    win.command("onGetSelection", text);
  });

  win.attachEvent("Summarize", async (raw: unknown) => {
    const payload =
      typeof raw === "string"
        ? (JSON.parse(raw) as { data: string; lang: string })
        : (raw as { data: string; lang: string });

    window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
    try {
      const result = await summarize(payload.data, payload.lang);
      win.command("onSummarize", JSON.stringify({ error: 0, data: result }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      win.command("onSummarize", JSON.stringify({ error: 1, message }));
    } finally {
      window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
    }
  });

  win.attachEvent("onSummarize", (raw: unknown) => {
    const payload =
      typeof raw === "string"
        ? (JSON.parse(raw) as { type: string; data: string })
        : (raw as { type: string; data: string });
    const lib = window.Asc.Library;
    const editorType = window.Asc.plugin.info?.editorType;
    switch (payload.type) {
      case "review":
        if (editorType === "word")
          void lib?.InsertAsReview(payload.data, false);
        else void lib?.InsertAsComment(payload.data);
        break;
      case "comment":
        void lib?.InsertAsComment(payload.data);
        break;
      case "replace":
        void lib?.PasteText(payload.data);
        break;
      case "end":
        void lib?.InsertAsText(payload.data);
        break;
    }
  });

  registerWindow("summarization", win);
  win.show({
    url: "summarization.html",
    description: "Summarization",
    type: "window",
    EditorsSupport: ["word", "slide", "cell", "pdf"],
    isVisual: true,
    isModal: true,
    size: [720, 310],
    buttons: [],
  });
}

interface InChatPayload {
  prompt: string;
  profileId: string | null;
}

let pendingInChatPayload: InChatPayload | null = null;

function flushPendingInChat(): void {
  if (!pendingInChatPayload) return;
  const chat = windows.get("chat");
  if (!chat) return;
  chat.command("sendToChat", JSON.stringify(pendingInChatPayload));
  pendingInChatPayload = null;
}

function openChat() {
  const existing = windows.get("chat");
  if (existing) {
    existing.activate();
    flushPendingInChat();
    return;
  }

  const chatWindow = new window.Asc.PluginWindow();
  chatWindow.attachEvent("ai-open-settings", openSettings);
  chatWindow.attachEvent("chat-ready", () => {
    flushPendingInChat();
  });
  registerWindow("chat", chatWindow);
  chatWindow.show({
    url: "chat.html",
    description: "AI Chat",
    type: "panelRight",
    EditorsSupport: ["word", "slide", "cell", "pdf"],
    isVisual: true,
    icons: "resources/%theme-type%(light|dark)/general-ai%scale%(default).png",
  });
}

async function getFullDocumentText(): Promise<string> {
  return (
    (await editor.callCommand<string>(() => {
      const doc = Api.GetDocument();
      const count = doc.GetElementsCount();
      const lines: string[] = [];
      for (let i = 0; i < count; i++) {
        const el = doc.GetElement(i) as { GetText?: () => string };
        if (typeof el?.GetText === "function") {
          lines.push(el.GetText());
        }
      }
      return lines.join("\n");
    })) ?? ""
  );
}

async function dispatchInChatAction(action: CustomAiAction): Promise<void> {
  const lib = window.Asc.Library;
  let sourceText = (await lib?.GetSelectedText()) ?? "";
  if (!sourceText.trim()) {
    sourceText = await getFullDocumentText();
  }
  pendingInChatPayload = {
    prompt: prompts.getActionInChatPrompt(
      sourceText.trim(),
      action.query,
      action.additionalAction
    ),
    profileId: action.profileId,
  };
  openChat();
}

async function dispatchReplaceInChatAction(
  action: CustomAiAction
): Promise<void> {
  const lib = window.Asc.Library;
  if (!lib) return;
  if (!window.AI) {
    console.error("[Docs bg] replace-in-chat: AI library not initialized");
    return;
  }

  let sourceText = (await lib.GetSelectedText()) ?? "";
  if (!sourceText.trim()) {
    sourceText = await getFullDocumentText();
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] replace-in-chat: no source text to rewrite");
    return;
  }

  const replacementPrompt = prompts.getActionReplaceInChatReplacementPrompt(
    original,
    action.query,
    action.additionalAction
  );

  let replacement = "";
  window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    replacement = (await request.chatRequest(replacementPrompt, false)) ?? "";
  } catch (e) {
    console.error("[Docs bg] replace-in-chat: AI request failed", e);
    return;
  } finally {
    window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
  }

  replacement = replacement.trim();
  if (!replacement) {
    console.error("[Docs bg] replace-in-chat: empty replacement");
    return;
  }

  await lib.PasteText(replacement);

  pendingInChatPayload = {
    prompt: prompts.getActionReplaceInChatExplanationPrompt(
      original,
      replacement,
      action.query,
      action.additionalAction
    ),
    profileId: action.profileId,
  };
  openChat();
}

async function dispatchReplaceAction(action: CustomAiAction): Promise<void> {
  const lib = window.Asc.Library;
  if (!lib) return;
  if (!window.AI) {
    console.error("[Docs bg] replace: AI library not initialized");
    return;
  }

  let sourceText = (await lib.GetSelectedText()) ?? "";
  let usedFullDocumentFallback = false;
  if (!sourceText.trim()) {
    sourceText = await getFullDocumentText();
    usedFullDocumentFallback = true;
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] replace: no source text to rewrite");
    return;
  }

  const replacementPrompt = prompts.getActionReplacePrompt(
    original,
    action.query,
    action.additionalAction
  );

  let replacement = "";
  window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    replacement = (await request.chatRequest(replacementPrompt, false)) ?? "";
  } catch (e) {
    console.error("[Docs bg] replace: AI request failed", e);
    return;
  } finally {
    window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
  }

  replacement = replacement.trim();
  if (!replacement) {
    console.error("[Docs bg] replace: empty replacement");
    return;
  }

  if (usedFullDocumentFallback) {
    // Select the whole document so PasteText replaces it (otherwise it
    // inserts at the current cursor position).
    await editor.callCommand(() => {
      const doc = Api.GetDocument();
      const range = doc.GetRange() as { Select?: () => void } | null;
      range?.Select?.();
    });
  }

  await lib.PasteText(replacement);
}

async function dispatchAsReviewAction(action: CustomAiAction): Promise<void> {
  const lib = window.Asc.Library;
  if (!lib) return;
  if (!window.AI) {
    console.error("[Docs bg] as-review: AI library not initialized");
    return;
  }

  let sourceText = (await lib.GetSelectedText()) ?? "";
  let usedFullDocumentFallback = false;
  if (!sourceText.trim()) {
    sourceText = await getFullDocumentText();
    usedFullDocumentFallback = true;
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] as-review: no source text to rewrite");
    return;
  }

  const reviewPrompt = prompts.getActionAsReviewPrompt(
    original,
    action.query,
    action.additionalAction
  );

  let replacement = "";
  window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    replacement = (await request.chatRequest(reviewPrompt, false)) ?? "";
  } catch (e) {
    console.error("[Docs bg] as-review: AI request failed", e);
    return;
  } finally {
    window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
  }

  replacement = replacement.trim();
  if (!replacement) {
    console.error("[Docs bg] as-review: empty replacement");
    return;
  }

  const editorType = window.Asc.plugin.info?.editorType;
  if (editorType === "word") {
    if (usedFullDocumentFallback) {
      // Select the whole document so PasteText replaces it under
      // track-revisions (otherwise nothing gets struck through).
      await editor.callCommand(() => {
        const doc = Api.GetDocument();
        const range = doc.GetRange() as { Select?: () => void } | null;
        range?.Select?.();
      });
    }
    void lib.InsertAsReview(replacement, false);
  } else {
    void lib.InsertAsComment(replacement);
  }
}

async function dispatchInCommentAction(action: CustomAiAction): Promise<void> {
  const lib = window.Asc.Library;
  if (!lib) return;
  if (!window.AI) {
    console.error("[Docs bg] in-comment: AI library not initialized");
    return;
  }

  let sourceText = (await lib.GetSelectedText()) ?? "";
  let usedFullDocumentFallback = false;
  if (!sourceText.trim()) {
    sourceText = await getFullDocumentText();
    usedFullDocumentFallback = true;
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] in-comment: no source text");
    return;
  }

  const commentPrompt = prompts.getActionInCommentPrompt(
    original,
    action.query,
    action.additionalAction
  );

  let comment = "";
  window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    comment = (await request.chatRequest(commentPrompt, false)) ?? "";
  } catch (e) {
    console.error("[Docs bg] in-comment: AI request failed", e);
    return;
  } finally {
    window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
  }

  comment = comment.trim();
  if (!comment) {
    console.error("[Docs bg] in-comment: empty response");
    return;
  }

  if (
    usedFullDocumentFallback &&
    window.Asc.plugin.info?.editorType === "word"
  ) {
    await editor.callCommand(() => {
      const doc = Api.GetDocument();
      const range = doc.GetRange() as { Select?: () => void } | null;
      range?.Select?.();
    });
  }

  void lib.InsertAsComment(comment);
}

async function dispatchToEndAction(action: CustomAiAction): Promise<void> {
  const lib = window.Asc.Library;
  if (!lib) return;
  if (!window.AI) {
    console.error("[Docs bg] to-end: AI library not initialized");
    return;
  }

  let sourceText = (await lib.GetSelectedText()) ?? "";
  if (!sourceText.trim()) {
    sourceText = await getFullDocumentText();
  }
  const original = sourceText.trim();
  if (!original) {
    console.error("[Docs bg] to-end: no source text");
    return;
  }

  const toEndPrompt = prompts.getActionToEndPrompt(
    original,
    action.query,
    action.additionalAction
  );

  let result = "";
  window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
  try {
    const request = window.AI.Request.create(
      window.AI.ActionType.Chat,
      action.profileId
    );
    result = (await request.chatRequest(toEndPrompt, false)) ?? "";
  } catch (e) {
    console.error("[Docs bg] to-end: AI request failed", e);
    return;
  } finally {
    window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
  }

  result = result.trim();
  if (!result) {
    console.error("[Docs bg] to-end: empty response");
    return;
  }

  void lib.InsertAsText(result);
}

window.Asc.plugin.init = () => {
  const textAnnotatorPopup = new TextAnnotationPopup();
  const spellchecker = new SpellChecker(textAnnotatorPopup);
  const grammar = new GrammarChecker(textAnnotatorPopup);
  const customActionManager = new CustomActionManager(textAnnotatorPopup);

  for (const action of loadActions()) {
    try {
      customActionManager.createAction(action);
    } catch (e) {
      console.error(e);
    }
  }

  void initAiAgentEngine().then((storage) => {
    engineStorage = storage;
    installLibrary(storage);
  });

  if (isDesktopEditor()) listenForDesktopPluginUpdates();

  window.Asc.plugin.attachEditorEvent("onParagraphText", (obj: unknown) => {
    const p = obj as {
      paragraphId: string;
      recalcId: string;
      text: string;
      annotations: unknown[];
    };
    if (!p) return;
    void spellchecker.onChangeParagraph(
      p.paragraphId,
      p.recalcId,
      p.text,
      p.annotations
    );
    void grammar.onChangeParagraph(
      p.paragraphId,
      p.recalcId,
      p.text,
      p.annotations
    );
    customActionManager.onParagraphText(
      p.paragraphId,
      p.recalcId,
      p.text,
      p.annotations
    );
  });

  window.Asc.plugin.attachEditorEvent("onBlurAnnotation", (obj: unknown) => {
    const p = obj as { name: string } | null;
    if (!p) return;
    if (p.name === "spelling") spellchecker.onBlur();
    else if (p.name === "grammar") grammar.onBlur();
    else customActionManager.onBlurAnnotation(p.name);
  });

  window.Asc.plugin.attachEditorEvent("onClickAnnotation", (obj: unknown) => {
    const p = obj as {
      name: string;
      paragraphId: string;
      ranges: number[];
    } | null;
    if (!p) return;
    if (p.name === "grammar") grammar.onClick(p.paragraphId, p.ranges);
    else if (p.name === "spelling")
      spellchecker.onClick(p.paragraphId, p.ranges);
    else customActionManager.onClickAnnotation(p.name, p.paragraphId, p.ranges);
  });

  const editorType = window.Asc.plugin.info?.editorType;
  const isPdf = editorType === "pdf";
  const isWord = editorType === "word";

  const actionButtons = new Map<string, AscButtonToolbar>();
  let mainToolbar: AscButtonToolbar | null = null;

  function configureActionButton(
    btn: AscButtonToolbar,
    action: CustomAiAction
  ): void {
    btn.text = action.name;
    btn.icons = getIconToolbarPath(action.iconId);
    btn.split = true;
    btn.menu = [
      {
        text: "Edit",
        id: crypto.randomUUID(),
        onclick: () => openCustomActionWindow(action.id),
      },
      {
        text: "Delete",
        id: crypto.randomUUID(),
        onclick: () => openDeleteConfirmWindow(action.id),
      },
    ];
    btn.attachOnClick(() => {
      void runAction(action.id);
    });
  }

  function refreshActionButton(btn: AscButtonToolbar): void {
    // mainToolbar.id / .name are populated by the host *after*
    // registerToolbarMenu() runs; refreshing earlier is a programming
    // error (the host call would no-op on an empty id).
    if (!mainToolbar?.id) {
      throw new Error("refreshActionButton called before toolbar is ready");
    }
    window.Asc.Buttons.updateToolbarMenu(
      String(mainToolbar.id),
      mainToolbar.name ?? "",
      [btn]
    );
  }

  async function pushProfilesToWindow(win: AscPluginWindow): Promise<void> {
    if (!engineStorage) return;
    try {
      const profiles = await engineStorage.profiles.readAll();
      win.command(
        ACTION_DIALOG_EVENTS.profilesList,
        JSON.stringify(profiles.map(profileSummary))
      );
    } catch (e) {
      console.error(e);
    }
  }

  function openCustomActionWindow(actionId?: string): void {
    const existing = windows.get("custom-action");
    if (existing) {
      existing.activate();
      return;
    }

    const isEdit = !!actionId;
    const win = new window.Asc.PluginWindow();

    win.attachEvent(ACTION_DIALOG_EVENTS.windowReady, () => {
      if (isEdit && actionId) {
        win.command(ACTION_DIALOG_EVENTS.edit, actionId);
      }
      void pushProfilesToWindow(win);
      if (!window.AI) {
        win.command(
          ACTION_DIALOG_EVENTS.warning,
          "AI provider is not configured. Please open AI Settings and assign a model."
        );
      }
    });

    win.attachEvent(ACTION_DIALOG_EVENTS.addOrEdit, (raw: unknown) => {
      if (raw === null || raw === undefined) return;
      const action =
        typeof raw === "string"
          ? (JSON.parse(raw) as CustomAiAction)
          : (raw as CustomAiAction);
      if (!action?.id) return;
      const isUpdate = customActionManager.hasAction(action.id);
      try {
        if (isUpdate) {
          customActionManager.updateAction(action);
        } else {
          customActionManager.createAction(action);
        }
      } catch (e) {
        console.error(e);
      }

      const existingBtn = actionButtons.get(action.id);
      if (isUpdate && existingBtn) {
        // The host caches the rendered icon at first paint, so mutating
        // existingBtn.icons does not refresh the visual. Remove the old
        // button and add a fresh one to force a re-render.
        existingBtn.removed = true;
        refreshActionButton(existingBtn);
        actionButtons.delete(action.id);
      }
      const btn = new window.Asc.ButtonToolbar(undefined);
      configureActionButton(btn, action);
      actionButtons.set(action.id, btn);
      refreshActionButton(btn);

      windows.set("custom-action", null);
      window.Asc.plugin.executeMethod("CloseWindow", [win.id]);
    });

    registerWindow("custom-action", win);
    win.show({
      url: "aiAction.html",
      description: isEdit ? "Edit AI Action" : "Create AI Action",
      type: "window",
      EditorsSupport: ["word"],
      isVisual: true,
      isModal: false,
      size: [460, 540],
      buttons: [
        { text: isEdit ? "Save" : "Create", primary: true },
        { text: "Cancel", primary: false },
      ],
    });
  }

  function openDeleteConfirmWindow(actionId: string): void {
    const existing = windows.get("custom-action-delete");
    if (existing) {
      existing.activate();
      return;
    }

    const win = new window.Asc.PluginWindow();

    win.attachEvent(DELETE_DIALOG_EVENTS.windowReady, () => {
      win.command(DELETE_DIALOG_EVENTS.setActionId, actionId);
    });

    win.attachEvent(DELETE_DIALOG_EVENTS.delete, (raw: unknown) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as { id: string })
          : (raw as { id: string });
      const id = payload?.id;
      if (!id) return;
      deleteAction(id);
      customActionManager.deleteAction(id);

      const existingBtn = actionButtons.get(id);
      if (existingBtn) {
        existingBtn.removed = true;
        refreshActionButton(existingBtn);
        actionButtons.delete(id);
      }

      windows.set("custom-action-delete", null);
      window.Asc.plugin.executeMethod("CloseWindow", [win.id]);
    });

    registerWindow("custom-action-delete", win);
    win.show({
      url: "aiActionDelete.html",
      description: "Delete action",
      type: "window",
      EditorsSupport: ["word"],
      isVisual: true,
      isModal: true,
      size: [380, 140],
      buttons: [
        { text: "Yes", primary: true },
        { text: "No", primary: false },
      ],
    });
  }

  async function runAction(id: string): Promise<void> {
    const lib = window.Asc.Library;
    if (!lib) return;

    const action = findAction(id);
    if (action?.type === "in-chat") {
      await dispatchInChatAction(action);
      return;
    }
    if (action?.type === "replace-in-chat") {
      await dispatchReplaceInChatAction(action);
      return;
    }
    if (action?.type === "replace") {
      await dispatchReplaceAction(action);
      return;
    }
    if (action?.type === "as-review") {
      await dispatchAsReviewAction(action);
      return;
    }
    if (action?.type === "in-comment") {
      await dispatchInCommentAction(action);
      return;
    }
    if (action?.type === "to-end") {
      await dispatchToEndAction(action);
      return;
    }

    const selectedText = await lib.GetSelectedText();
    Asc.scope.hasSelectedText = !!selectedText;
    const paraIds = await editor.callCommand<string[]>(() => {
      const result: string[] = [];
      let paragraphs: Array<{ GetInternalId: () => string }>;
      if (Asc.scope.hasSelectedText) {
        const range = Api.GetDocument().GetRangeBySelect();
        if (!range) return [];
        paragraphs = range.GetAllParagraphs();
      } else {
        paragraphs = Api.GetDocument().GetAllParagraphs();
      }
      for (const p of paragraphs) {
        result.push(p.GetInternalId());
      }
      return result;
    });

    if (!paraIds || !paraIds.length) return;

    window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
    try {
      await customActionManager.runOnce(id, paraIds);
    } finally {
      window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
    }
  }

  async function handleGrammarCheck(
    sc: SpellChecker,
    gc: GrammarChecker,
    isCurrent: boolean
  ): Promise<void> {
    let paraIds = [];
    if (isCurrent) {
      paraIds = await editor.callCommand<string[]>(() => {
        const result: string[] = [];
        const range = Api.GetDocument().GetRangeBySelect();
        if (!range) return [];

        const paragraphs = range.GetAllParagraphs();
        paragraphs.forEach((p: { GetInternalId: () => string }) => {
          result.push(p.GetInternalId());
        });
        return result;
      });
    } else {
      paraIds = await Asc.Editor.callCommand(() => {
        const result: string[] = [];
        const paragraphs = Api.GetDocument().GetAllParagraphs();
        paragraphs.forEach((p: { GetInternalId: () => string }) => {
          result.push(p.GetInternalId());
        });
        return result;
      });
    }

    if (!paraIds.length) return;

    window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
    try {
      await Promise.all([
        sc.checkParagraphs(paraIds),
        gc.checkParagraphs(paraIds),
      ]);
    } finally {
      window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
    }
  }

  const homeToolbar = new window.Asc.ButtonToolbar(null, "home");
  const buttonChat = new window.Asc.ButtonToolbar(homeToolbar);
  buttonChat.text = "AI Chat";
  buttonChat.icons =
    "resources/%theme-type%(light|dark)/general-ai%scale%(default).png";
  buttonChat.separator = true;
  buttonChat.attachOnClick(() => openChat());

  mainToolbar = new window.Asc.ButtonToolbar();
  mainToolbar.text = "AI Actions";

  const buttonSettings = new window.Asc.ButtonToolbar(mainToolbar);
  buttonSettings.text = "AI Settings";
  buttonSettings.icons =
    "resources/%theme-type%(light|dark)/big/settings%scale%(default).png";
  buttonSettings.attachOnClick(() => openSettings());

  const buttonCreateAction = new window.Asc.ButtonToolbar(mainToolbar);
  buttonCreateAction.text = "Create AI Action";
  buttonCreateAction.icons =
    "resources/%theme-type%(light|dark)/big/plugin-writer%scale%(default).png";
  buttonCreateAction.attachOnClick(() => openCustomActionWindow());

  if (!isPdf) {
    const buttonSummarization = new window.Asc.ButtonToolbar(mainToolbar);
    buttonSummarization.text = "Summarization";
    buttonSummarization.icons =
      "resources/%theme-type%(light|dark)/big/summarization%scale%(default).png";
    buttonSummarization.separator = true;
    buttonSummarization.attachOnClick(() => openSummarizationWindow());
  }

  const buttonTranslation = new window.Asc.ButtonToolbar(mainToolbar);
  buttonTranslation.text = "Translation";
  buttonTranslation.icons =
    "resources/%theme-type%(light|dark)/big/translation%scale%(default).png";
  buttonTranslation.split = true;
  buttonTranslation.menu = [
    {
      text: "Settings",
      id: "ai-translation-settings",
      onclick: () => openTranslationSettings(),
    },
  ];
  buttonTranslation.attachOnClick(() => {
    void handleTranslation();
  });

  if (isWord) {
    const buttonGrammar = new window.Asc.ButtonToolbar(mainToolbar);
    buttonGrammar.text = "Grammar & Spelling";
    buttonGrammar.icons =
      "resources/%theme-type%(light|dark)/big/grammar%scale%(default).png";
    buttonGrammar.split = true;
    buttonGrammar.menu = [
      {
        text: "Check all",
        id: "ai-grammar-check-all",
        onclick: () => {
          void handleGrammarCheck(spellchecker, grammar, false);
        },
      },
      {
        text: "Check current text",
        id: "ai-grammar-check-current",
        onclick: () => {
          void handleGrammarCheck(spellchecker, grammar, true);
        },
      },
    ];
    buttonGrammar.attachOnClick(() => {
      void handleGrammarCheck(spellchecker, grammar, true);
    });

    for (const action of loadActions()) {
      const btn = new window.Asc.ButtonToolbar(mainToolbar);
      configureActionButton(btn, action);
      actionButtons.set(action.id, btn);
    }
  }

  window.Asc.Buttons.registerToolbarMenu();

  window.Asc.plugin.button = (buttonId, windowId) => {
    if (textAnnotatorPopup.currentWindowId === windowId) {
      if (buttonId === 0) void textAnnotatorPopup.onAcceptCallback?.();
      else if (buttonId === 1) void textAnnotatorPopup.onRejectCallback?.();
      else textAnnotatorPopup.reset();
      return;
    }

    const translationWin = windows.get("translation");
    if (translationWin && translationWin.id === windowId && buttonId === 0) {
      translationWin.command("onKeepLang", "");
    }

    const actionWin = windows.get("custom-action");
    if (actionWin && actionWin.id === windowId) {
      if (buttonId === 0) {
        actionWin.command(ACTION_DIALOG_EVENTS.clickAdd, "");
        return;
      }
    }

    const deleteWin = windows.get("custom-action-delete");
    if (deleteWin && deleteWin.id === windowId) {
      if (buttonId === 0) {
        deleteWin.command(DELETE_DIALOG_EVENTS.confirm, "");
        return;
      }
    }

    window.Asc.plugin.executeMethod("CloseWindow", [windowId]);
    for (const [id, win] of windows) {
      if (win && win.id === windowId) {
        windows.set(id, null);
        break;
      }
    }
  };
};
