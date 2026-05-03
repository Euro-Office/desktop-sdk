import type { Profile, StorageAdapter } from "@onlyoffice/ai-chat";
import { isDesktopEditor } from "@/shared/lib/utils";
import {
  type CrossPluginEvents,
  crossPluginBus,
} from "@/shared/sync/crossPluginBus";
import { getIconToolbarPath } from "./ai-actions/icons";
import { deleteAction, loadActions } from "./ai-actions/storage";
import type { CustomAiAction } from "./ai-actions/types";
import { initAiAgentEngine, summarize, translate } from "./engine";
import {
  DEFAULT_TRANSLATION_LANG,
  TRANSLATION_LANG_KEY,
} from "./engine/languages";
import { install as installLibrary } from "./library";
import { editor } from "./library/editor";
import { TextAnnotationPopup } from "./text-annotations/annotation-popup";
import type { CustomAssistantData } from "./text-annotations/custom-annotations/custom-annotator";
import { CustomAssistantManager } from "./text-annotations/custom-annotations/manager";
import { GrammarChecker } from "./text-annotations/grammar-checker";
import { SpellChecker } from "./text-annotations/spelling-checker";

function actionToAssistantData(action: CustomAiAction): CustomAssistantData {
  const additional = action.additionalAction.trim();
  const query = additional
    ? `${action.query}\n\nAdditional instruction: ${additional}`
    : action.query;
  return {
    id: action.id,
    name: action.name,
    type: action.type,
    query,
    profileId: action.profileId,
  };
}

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
  | "custom-assistant"
  | "custom-assistant-delete";

const windows = new Map<WindowId, AscPluginWindow | null>([
  ["chat", null],
  ["settings", null],
  ["translation", null],
  ["summarization", null],
  ["custom-assistant", null],
  ["custom-assistant-delete", null],
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

function openChat() {
  const existing = windows.get("chat");
  if (existing) {
    existing.activate();
    return;
  }

  const chatWindow = new window.Asc.PluginWindow();
  chatWindow.attachEvent("ai-open-settings", openSettings);
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

window.Asc.plugin.init = () => {
  const textAnnotatorPopup = new TextAnnotationPopup();
  const spellchecker = new SpellChecker(textAnnotatorPopup);
  const grammar = new GrammarChecker(textAnnotatorPopup);
  const customAssistantManager = new CustomAssistantManager(textAnnotatorPopup);

  for (const action of loadActions()) {
    try {
      customAssistantManager.createAssistant(actionToAssistantData(action));
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
    customAssistantManager.onParagraphText(
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
    else customAssistantManager.onBlurAnnotation(p.name);
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
    else
      customAssistantManager.onClickAnnotation(p.name, p.paragraphId, p.ranges);
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
    btn.enableToggle = false;
    btn.menu = [
      {
        text: "Edit",
        id: `ai-action-edit-${action.id}`,
        onclick: () => openCustomActionWindow(action.id),
      },
      {
        text: "Delete",
        id: `ai-action-delete-${action.id}`,
        onclick: () => openDeleteConfirmWindow(action.id),
      },
    ];
    btn.attachOnClick(() => {
      void runAssistant(action.id);
    });
  }

  function refreshActionButton(btn: AscButtonToolbar): void {
    if (!mainToolbar) return;
    window.Asc.Buttons.updateToolbarMenu(
      String(mainToolbar.id ?? ""),
      mainToolbar.name ?? "",
      [btn]
    );
  }

  async function pushProfilesToWindow(win: AscPluginWindow): Promise<void> {
    if (!engineStorage) return;
    try {
      const profiles = await engineStorage.profiles.readAll();
      win.command(
        "onProfilesList",
        JSON.stringify(profiles.map(profileSummary))
      );
    } catch (e) {
      console.error(e);
    }
  }

  function openCustomActionWindow(actionId?: string): void {
    const existing = windows.get("custom-assistant");
    if (existing) {
      existing.activate();
      return;
    }

    const isEdit = !!actionId;
    const win = new window.Asc.PluginWindow();

    win.attachEvent("onWindowReady", () => {
      if (isEdit && actionId) {
        win.command("onEditAction", actionId);
      }
      void pushProfilesToWindow(win);
      if (!window.AI) {
        win.command(
          "onWarningAction",
          "AI provider is not configured. Please open AI Settings and assign a model."
        );
      }
    });

    win.attachEvent("onAddEditAction", (raw: unknown) => {
      if (raw === null || raw === undefined) return;
      const action =
        typeof raw === "string"
          ? (JSON.parse(raw) as CustomAiAction)
          : (raw as CustomAiAction);
      if (!action?.id) return;
      const data = actionToAssistantData(action);
      const isUpdate = customAssistantManager.hasAssistant(data.id);
      try {
        if (isUpdate) {
          customAssistantManager.updateAssistant(data);
        } else {
          customAssistantManager.createAssistant(data);
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

      windows.set("custom-assistant", null);
      window.Asc.plugin.executeMethod("CloseWindow", [win.id]);
    });

    registerWindow("custom-assistant", win);
    win.show({
      url: "customAssistant.html",
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

  function openDeleteConfirmWindow(assistantId: string): void {
    const existing = windows.get("custom-assistant-delete");
    if (existing) {
      existing.activate();
      return;
    }

    const win = new window.Asc.PluginWindow();

    win.attachEvent("onWindowReady", () => {
      win.command("onSetAssistantId", assistantId);
    });

    win.attachEvent("onDeleteAssistant", (raw: unknown) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as { id: string })
          : (raw as { id: string });
      const id = payload?.id;
      if (!id) return;
      deleteAction(id);
      customAssistantManager.deleteAssistant(id);

      const existingBtn = actionButtons.get(id);
      if (existingBtn) {
        existingBtn.removed = true;
        refreshActionButton(existingBtn);
        actionButtons.delete(id);
      }

      windows.set("custom-assistant-delete", null);
      window.Asc.plugin.executeMethod("CloseWindow", [win.id]);
    });

    registerWindow("custom-assistant-delete", win);
    win.show({
      url: "customAssistantDelete.html",
      description: "Delete assistant",
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

  async function runAssistant(id: string): Promise<void> {
    const lib = window.Asc.Library;
    if (!lib) return;

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
      await customAssistantManager.run(id, paraIds);
    } finally {
      window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
      customAssistantManager.disableTracking(id);
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

    const buttonCreateAction = new window.Asc.ButtonToolbar(mainToolbar);
    buttonCreateAction.text = "Create AI Action";
    buttonCreateAction.icons =
      "resources/%theme-type%(light|dark)/big/plugin-writer%scale%(default).png";
    buttonCreateAction.separator = true;
    buttonCreateAction.attachOnClick(() => openCustomActionWindow());

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

    const assistantWin = windows.get("custom-assistant");
    if (assistantWin && assistantWin.id === windowId) {
      if (buttonId === 0) {
        assistantWin.command("onClickAdd", "");
        return;
      }
    }

    const deleteWin = windows.get("custom-assistant-delete");
    if (deleteWin && deleteWin.id === windowId) {
      if (buttonId === 0) {
        deleteWin.command("onConfirmDelete", "");
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
