import type { StorageAdapter } from "@onlyoffice/ai-chat";
import { isDesktopEditor } from "@/shared/lib/utils";
import { crossPluginBus } from "@/shared/sync/crossPluginBus";
import { runAction } from "./custom-actions/action-runner";
import {
  CUSTOM_ACTION_DELETE_DIALOG_EVENTS,
  CUSTOM_ACTION_DIALOG_EVENTS,
} from "./custom-actions/dialog-events";
import { getIconToolbarPath } from "./custom-actions/icons";
import { deleteAction, loadActions } from "./custom-actions/storage";
import type { CustomAiAction } from "./custom-actions/types";
import {
  CUSTOM_ASSISTANT_DELETE_DIALOG_EVENTS,
  CUSTOM_ASSISTANT_DIALOG_EVENTS,
} from "./custom-assistants/dialog-events";
import {
  ASSISTANT_RUN_STATUS,
  CustomAssistantManager,
} from "./custom-assistants/manager";
import { deleteAssistant, loadAssistants } from "./custom-assistants/storage";
import type { CustomAssistant } from "./custom-assistants/types";
import { CUSTOM_PROVIDERS_DIALOG_EVENTS } from "./custom-providers/dialog-events";
import {
  deleteProvider as deleteCustomProvider,
  loadProviders as loadCustomProviders,
  upsertProvider as upsertCustomProvider,
} from "./custom-providers/storage";
import {
  isDesktopOnlyProvider,
  validateProvider,
} from "./custom-providers/validate";
import { initAiAgentEngine, summarize, translate } from "./engine";
import {
  DEFAULT_TRANSLATION_LANG,
  TRANSLATION_LANG_KEY,
} from "./engine/languages";
import { install as installLibrary } from "./library";
import { editor } from "./library/editor";
import { library } from "./library/library.ts";
import { TextAnnotationPopup } from "./text-annotations/annotation-popup";
import { GrammarChecker } from "./text-annotations/grammar-checker";
import { SpellChecker } from "./text-annotations/spelling-checker";
import {
  listenForDesktopPluginUpdates,
  pluginWindows,
  registerWindow,
} from "./window-manager";

let engineStorage: StorageAdapter | null = null;

const ASSISTANT_BUTTON_ICON =
  "resources/%theme-type%(light|dark)/big/written-plugin%scale%(default).png";
const CREATE_ACTION_BUTTON_ICON =
  "resources/%theme-type%(light|dark)/big/btn-next-field%scale%(default).png";
const CREATE_ASSISTANT_BUTTON_ICON =
  "resources/%theme-type%(light|dark)/big/plugin-writer%scale%(default).png";

async function handleTranslation(): Promise<void> {
  const text = await library.GetSelectedText();
  if (!text.trim()) return;
  const lang =
    localStorage.getItem(TRANSLATION_LANG_KEY) ?? DEFAULT_TRANSLATION_LANG;

  window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
  try {
    const result = await translate(text, lang);
    await library.PasteText(result);
  } finally {
    window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
  }
}

function openSettings() {
  const existing = pluginWindows.get("settings");
  if (existing) {
    existing.activate();
    return;
  }

  const settingsWindow = new window.Asc.PluginWindow();
  settingsWindow.attachEvent("ai-open-custom-providers", () => {
    openCustomProvidersWindow();
  });
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

function openCustomProvidersWindow() {
  const existing = pluginWindows.get("custom-providers");
  if (existing) {
    existing.activate();
    return;
  }

  const win = new window.Asc.PluginWindow();

  const pushList = (): void => {
    const items = loadCustomProviders().map((record) => {
      const result = validateProvider(record.source);
      if (!result.ok) {
        return { name: record.name, reason: result.reason };
      }
      if (isDesktopOnlyProvider(result.Ctor) && !isDesktopEditor()) {
        return {
          name: record.name,
          reason: "Desktop-only provider, unavailable in this editor.",
        };
      }
      return { name: record.name };
    });
    win.command(
      CUSTOM_PROVIDERS_DIALOG_EVENTS.setProviders,
      JSON.stringify(items)
    );
  };

  const broadcastUpdate = (): void => {
    const names = loadCustomProviders().map((p) => p.name);
    crossPluginBus.publish("customProvidersUpdated", { providers: names });
  };

  win.attachEvent(CUSTOM_PROVIDERS_DIALOG_EVENTS.windowReady, () => {
    pushList();
  });

  win.attachEvent(
    CUSTOM_PROVIDERS_DIALOG_EVENTS.addProvider,
    (raw: unknown) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as { name: string; content: string })
          : (raw as { name: string; content: string });
      const fileName = payload?.name ?? "";
      const content = payload?.content ?? "";
      if (!content.trim()) {
        win.command(
          CUSTOM_PROVIDERS_DIALOG_EVENTS.error,
          "Empty provider file"
        );
        return;
      }

      const result = validateProvider(content);
      if (!result.ok) {
        win.command(CUSTOM_PROVIDERS_DIALOG_EVENTS.error, result.reason);
        return;
      }

      let providerName: string;
      try {
        providerName = String(result.Ctor.getName?.() ?? "").trim();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to read provider name";
        win.command(CUSTOM_PROVIDERS_DIALOG_EVENTS.error, message);
        return;
      }

      if (!providerName) {
        const fallback = fileName.replace(/\.js$/i, "").trim();
        providerName = fallback || "Custom provider";
      }

      upsertCustomProvider({
        name: providerName,
        source: content,
        createdAt: Date.now(),
      });
      pushList();
      broadcastUpdate();
    }
  );

  win.attachEvent(
    CUSTOM_PROVIDERS_DIALOG_EVENTS.deleteProvider,
    (raw: unknown) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as { name: string })
          : (raw as { name: string });
      if (!payload?.name) return;
      deleteCustomProvider(payload.name);
      pushList();
      broadcastUpdate();
    }
  );

  registerWindow("custom-providers", win);
  win.show({
    url: "customProviders.html",
    description: "Custom providers",
    type: "window",
    EditorsSupport: ["word", "slide", "cell", "pdf"],
    isVisual: true,
    isModal: true,
    size: [350, 240],
    buttons: [{ text: "Close", primary: false }],
  });
}

function openTranslationSettings() {
  const existing = pluginWindows.get("translation");
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
  const existing = pluginWindows.get("summarization");
  if (existing) {
    existing.activate();
    return;
  }

  const win = new window.Asc.PluginWindow();

  win.attachEvent("onInit", async () => {
    const text = (await library.GetSelectedText()) ?? "";
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
    const editorType = window.Asc.plugin.info?.editorType;
    switch (payload.type) {
      case "review":
        if (editorType === "word")
          void library.InsertAsReview(payload.data, false);
        else void library.InsertAsComment(payload.data);
        break;
      case "comment":
        void library.InsertAsComment(payload.data);
        break;
      case "replace":
        void library.PasteText(payload.data);
        break;
      case "end":
        void library.InsertAsText(payload.data);
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

interface OpenChatPayload {
  prompt: string;
  action: "send" | "attach";
}

function openChat(payload?: OpenChatPayload) {
  const existing = pluginWindows.get("chat");
  if (existing) {
    existing.activate();
    if (payload) {
      existing.command("sendToChat", JSON.stringify(payload));
    }
    return;
  }

  const chatWindow = new window.Asc.PluginWindow();
  chatWindow.attachEvent("ai-open-settings", openSettings);
  chatWindow.attachEvent("onChatReplace", async (raw: unknown) => {
    const payload =
      typeof raw === "string"
        ? (JSON.parse(raw) as { type: string; data: string })
        : (raw as { type: string; data: string });
    const md = payload?.data ?? "";
    const html = library.ConvertMdToHTML(md);
    const plain = html
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/\n{3,}/g, "\n\n");
    const editorType = window.Asc.plugin.info?.editorType;
    switch (payload?.type) {
      case "replace": {
        void library.ReplaceTextSmart(plain);
        break;
      }
      case "insert":
        void library.InsertAsHTML(html);
        break;
      case "comment":
        void library.InsertAsComment(plain);
        break;
      case "review":
        if (editorType === "word") void library.InsertAsReview(html, true);
        else void library.InsertAsComment(plain);
        break;
    }
  });
  chatWindow.attachEvent("chat-ready", () => {
    if (payload) {
      chatWindow.command("sendToChat", JSON.stringify(payload));
    }
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

window.openChat = openChat;

window.Asc.plugin.init = () => {
  const textAnnotatorPopup = new TextAnnotationPopup();
  const spellchecker = new SpellChecker(textAnnotatorPopup);
  const grammar = new GrammarChecker(textAnnotatorPopup);
  const assistantManager = new CustomAssistantManager(textAnnotatorPopup);

  void initAiAgentEngine().then((storage) => {
    engineStorage = storage;
    installLibrary();
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
    assistantManager.onChangeParagraph(
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
    else assistantManager.onBlurAnnotation(p.name);
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
    else assistantManager.onClickAnnotation(p.name, p.paragraphId, p.ranges);
  });

  const editorType = window.Asc.plugin.info?.editorType;
  const isPdf = editorType === "pdf";
  const isWord = editorType === "word";

  const actionButtons = new Map<string, AscButtonToolbar>();
  const assistantButtons = new Map<string, AscButtonToolbar>();
  let mainToolbar: AscButtonToolbar | null = null;
  let buttonCreateAction: AscButtonToolbar | null = null;

  function refreshToolbarButton(btn: AscButtonToolbar): void {
    // mainToolbar.id / .name are populated by the host *after*
    // registerToolbarMenu() runs; refreshing earlier is a programming
    // error (the host call would no-op on an empty id).
    if (!mainToolbar?.id) {
      throw new Error("refreshToolbarButton called before toolbar is ready");
    }
    window.Asc.Buttons.updateToolbarMenu(
      String(mainToolbar.id),
      mainToolbar.name ?? "",
      [btn]
    );
  }

  function refreshActions(): void {
    if (!mainToolbar?.id || !buttonCreateAction) return;

    const btns = [buttonCreateAction, ...actionButtons.values()];

    // To ensure the correct order (assistants before actions), we remove all
    // action-related buttons and then add them back. This forces the host to
    // append them at the end of the menu, effectively placing them after any
    // newly added assistant buttons.
    btns.forEach((b) => {
      b.removed = true;
    });
    window.Asc.Buttons.updateToolbarMenu(
      String(mainToolbar.id),
      mainToolbar.name ?? "",
      btns
    );

    btns.forEach((b) => {
      b.removed = false;
    });
    window.Asc.Buttons.updateToolbarMenu(
      String(mainToolbar.id),
      mainToolbar.name ?? "",
      btns
    );
  }

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

  function configureAssistantButton(
    btn: AscButtonToolbar,
    assistant: CustomAssistant
  ): void {
    btn.text = assistant.name;
    btn.icons = ASSISTANT_BUTTON_ICON;
    btn.split = true;
    btn.enableToggle = true;
    btn.menu = [
      {
        text: "Edit",
        id: crypto.randomUUID(),
        onclick: () => openCustomAssistantWindow(assistant.id),
      },
      {
        text: "Delete",
        id: crypto.randomUUID(),
        onclick: () => openAssistantDeleteWindow(assistant.id),
      },
    ];
    btn.attachOnClick(() => {
      void toggleAssistant(assistant.id);
    });
  }

  async function toggleAssistant(id: string): Promise<void> {
    if (assistantManager.isActive(id)) {
      await assistantManager.stop(id);
      return;
    }

    const selectedText = await library.GetSelectedText();
    const hasSelection = !!selectedText && !!selectedText.trim();

    Asc.scope.hasSelectedText = hasSelection;
    const paraIds = await editor.callCommand<string[]>(() => {
      const result: string[] = [];
      const paragraphs = Asc.scope.hasSelectedText
        ? (Api.GetDocument().GetRangeBySelect()?.GetAllParagraphs() ?? [])
        : Api.GetDocument().GetAllParagraphs();
      paragraphs.forEach((p: { GetInternalId: () => string }) => {
        result.push(p.GetInternalId());
      });
      return result;
    });

    if (!paraIds.length) return;

    window.Asc.plugin.executeMethod("StartAction", ["Block", "AI"]);
    let status: number;
    try {
      status = await assistantManager.start(id, paraIds);
    } finally {
      window.Asc.plugin.executeMethod("EndAction", ["Block", "AI"]);
    }

    switch (status) {
      case ASSISTANT_RUN_STATUS.ok:
        return;
      case ASSISTANT_RUN_STATUS.notFound:
        console.error(`Custom assistant not found: ${id}`);
        openAssistantWarningWindow(
          "Custom assistant is not available. Please check your configuration."
        );
        return;
      case ASSISTANT_RUN_STATUS.error:
        openAssistantWarningWindow(
          "Not able to perform this action. Please use prompts related to text analysis, editing, or formatting."
        );
        // TODO: Add the ability to remove a button press.
        // buttonAssistant.PRESSED = false;
        // Asc.Buttons.updateToolbarMenu(window.buttonMainToolbar.id, window.buttonMainToolbar.name, [buttonAssistant]);
        // customAssistantManager.stop(assistantId);
        return;
      case ASSISTANT_RUN_STATUS.noAiModel:
        // A window with settings will appear.
        return;
    }
  }

  function openAssistantWarningWindow(text: string): void {
    const existing = pluginWindows.get("custom-assistant-warning");
    if (existing) {
      existing.activate();
      existing.command(CUSTOM_ASSISTANT_DIALOG_EVENTS.warning, text);
      return;
    }

    const win = new window.Asc.PluginWindow();
    win.attachEvent(CUSTOM_ASSISTANT_DIALOG_EVENTS.windowReady, () => {
      win.command(CUSTOM_ASSISTANT_DIALOG_EVENTS.warning, text);
    });

    registerWindow("custom-assistant-warning", win);
    win.show({
      url: "customAssistant.html",
      description: "Warning",
      type: "window",
      EditorsSupport: ["word"],
      isVisual: true,
      isModal: true,
      size: [350, 110],
      buttons: [{ text: "OK", primary: true }],
    });
  }

  async function pushProfilesToWindow(win: AscPluginWindow): Promise<void> {
    if (!engineStorage) return;
    try {
      const profiles = await engineStorage.profiles.readAll();
      win.command(
        CUSTOM_ACTION_DIALOG_EVENTS.profilesList,
        JSON.stringify(profiles.map((p) => ({ id: p.id, name: p.name })))
      );
    } catch (e) {
      console.error(e);
    }
  }

  function openCustomActionWindow(actionId?: string): void {
    const existing = pluginWindows.get("custom-action");
    if (existing) {
      existing.activate();
      return;
    }

    const isEdit = !!actionId;
    const win = new window.Asc.PluginWindow();

    win.attachEvent(CUSTOM_ACTION_DIALOG_EVENTS.windowReady, () => {
      if (isEdit && actionId) {
        win.command(CUSTOM_ACTION_DIALOG_EVENTS.edit, actionId);
      }
      void pushProfilesToWindow(win);
      if (!window.AI) {
        win.command(
          CUSTOM_ACTION_DIALOG_EVENTS.warning,
          "AI provider is not configured. Please open AI Settings and assign a model."
        );
      }
    });

    win.attachEvent(CUSTOM_ACTION_DIALOG_EVENTS.addOrEdit, (raw: unknown) => {
      if (raw === null || raw === undefined) return;
      const action =
        typeof raw === "string"
          ? (JSON.parse(raw) as CustomAiAction)
          : (raw as CustomAiAction);
      if (!action?.id) return;
      const isUpdate = actionButtons.has(action.id);

      const existingBtn = actionButtons.get(action.id);
      if (isUpdate && existingBtn) {
        // The host caches the rendered icon at first paint, so mutating
        // existingBtn.icons does not refresh the visual. Remove the old
        // button and add a fresh one to force a re-render.
        existingBtn.removed = true;
        refreshToolbarButton(existingBtn);
        actionButtons.delete(action.id);
      }
      const btn = new window.Asc.ButtonToolbar(undefined);
      configureActionButton(btn, action);
      actionButtons.set(action.id, btn);
      refreshToolbarButton(btn);

      pluginWindows.set("custom-action", null);
      window.Asc.plugin.executeMethod("CloseWindow", [win.id]);
    });

    registerWindow("custom-action", win);
    win.show({
      url: "customAction.html",
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
    const existing = pluginWindows.get("custom-action-delete");
    if (existing) {
      existing.activate();
      return;
    }

    const win = new window.Asc.PluginWindow();

    win.attachEvent(CUSTOM_ACTION_DELETE_DIALOG_EVENTS.windowReady, () => {
      win.command(CUSTOM_ACTION_DELETE_DIALOG_EVENTS.setActionId, actionId);
    });

    win.attachEvent(
      CUSTOM_ACTION_DELETE_DIALOG_EVENTS.delete,
      (raw: unknown) => {
        const payload =
          typeof raw === "string"
            ? (JSON.parse(raw) as { id: string })
            : (raw as { id: string });
        const id = payload?.id;
        if (!id) return;
        deleteAction(id);

        const existingBtn = actionButtons.get(id);
        if (existingBtn) {
          existingBtn.removed = true;
          refreshToolbarButton(existingBtn);
          actionButtons.delete(id);
        }

        pluginWindows.set("custom-action-delete", null);
        window.Asc.plugin.executeMethod("CloseWindow", [win.id]);
      }
    );

    registerWindow("custom-action-delete", win);
    win.show({
      url: "customActionDelete.html",
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

  function openCustomAssistantWindow(assistantId?: string): void {
    const existing = pluginWindows.get("custom-assistant");
    if (existing) {
      existing.activate();
      return;
    }

    const isEdit = !!assistantId;
    const win = new window.Asc.PluginWindow();

    win.attachEvent(CUSTOM_ASSISTANT_DIALOG_EVENTS.windowReady, () => {
      if (isEdit && assistantId) {
        win.command(CUSTOM_ASSISTANT_DIALOG_EVENTS.edit, assistantId);
      }
      if (!window.AI) {
        win.command(
          CUSTOM_ASSISTANT_DIALOG_EVENTS.warning,
          "AI provider is not configured. Please open AI Settings and assign a model."
        );
      }
    });

    win.attachEvent(
      CUSTOM_ASSISTANT_DIALOG_EVENTS.addOrEdit,
      (raw: unknown) => {
        if (raw === null || raw === undefined) return;
        const assistant =
          typeof raw === "string"
            ? (JSON.parse(raw) as CustomAssistant)
            : (raw as CustomAssistant);
        if (!assistant?.id) return;

        const existingBtn = assistantButtons.get(assistant.id);
        if (existingBtn) {
          assistantManager.update(assistant);
          existingBtn.text = assistant.name;
          refreshToolbarButton(existingBtn);
        } else {
          assistantManager.create(assistant);
          const btn = new window.Asc.ButtonToolbar(undefined);
          configureAssistantButton(btn, assistant);
          assistantButtons.set(assistant.id, btn);
          refreshToolbarButton(btn);
          refreshActions();
        }

        pluginWindows.set("custom-assistant", null);
        window.Asc.plugin.executeMethod("CloseWindow", [win.id]);
      }
    );

    registerWindow("custom-assistant", win);
    win.show({
      url: "customAssistant.html",
      description: isEdit ? "Edit" : "Create a new assistant",
      type: "window",
      EditorsSupport: ["word"],
      isVisual: true,
      isModal: false,
      size: [427, 303],
      buttons: [
        { text: isEdit ? "Save" : "Create", primary: true },
        { text: "Cancel", primary: false },
      ],
    });
  }

  function openAssistantDeleteWindow(assistantId: string): void {
    const existing = pluginWindows.get("custom-assistant-delete");
    if (existing) {
      existing.activate();
      return;
    }

    const win = new window.Asc.PluginWindow();

    win.attachEvent(CUSTOM_ASSISTANT_DELETE_DIALOG_EVENTS.windowReady, () => {
      win.command(
        CUSTOM_ASSISTANT_DELETE_DIALOG_EVENTS.setAssistantId,
        assistantId
      );
    });

    win.attachEvent(
      CUSTOM_ASSISTANT_DELETE_DIALOG_EVENTS.delete,
      (raw: unknown) => {
        const payload =
          typeof raw === "string"
            ? (JSON.parse(raw) as { id: string })
            : (raw as { id: string });
        const id = payload?.id;
        if (!id) return;
        deleteAssistant(id);
        void assistantManager.remove(id);

        const existingBtn = assistantButtons.get(id);
        if (existingBtn) {
          existingBtn.removed = true;
          refreshToolbarButton(existingBtn);
          assistantButtons.delete(id);
        }

        pluginWindows.set("custom-assistant-delete", null);
        window.Asc.plugin.executeMethod("CloseWindow", [win.id]);
      }
    );

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

  // Group 1: AI Settings
  const buttonSettings = new window.Asc.ButtonToolbar(mainToolbar);
  buttonSettings.text = "AI Settings";
  buttonSettings.icons =
    "resources/%theme-type%(light|dark)/big/settings%scale%(default).png";
  buttonSettings.attachOnClick(() => openSettings());

  // Group 2: Summarization, Translation, Grammar & Spelling
  if (!isPdf) {
    const buttonSummarization = new window.Asc.ButtonToolbar(mainToolbar);
    buttonSummarization.text = "Summarization";
    buttonSummarization.icons =
      "resources/%theme-type%(light|dark)/big/summarization%scale%(default).png";
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

    // Group 3: Create AI Assistant + dynamic assistants
    const buttonCreateAssistant = new window.Asc.ButtonToolbar(mainToolbar);
    buttonCreateAssistant.text = "Create AI Assistant";
    buttonCreateAssistant.icons = CREATE_ASSISTANT_BUTTON_ICON;
    buttonCreateAssistant.separator = true;
    buttonCreateAssistant.attachOnClick(() => openCustomAssistantWindow());

    for (const assistant of loadAssistants()) {
      assistantManager.create(assistant);
      const btn = new window.Asc.ButtonToolbar(mainToolbar);
      configureAssistantButton(btn, assistant);
      assistantButtons.set(assistant.id, btn);
    }

    // Group 4: Create AI Action + dynamic actions
    buttonCreateAction = new window.Asc.ButtonToolbar(mainToolbar);
    buttonCreateAction.text = "Create AI Action";
    buttonCreateAction.icons = CREATE_ACTION_BUTTON_ICON;
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

    const translationWin = pluginWindows.get("translation");
    if (translationWin && translationWin.id === windowId && buttonId === 0) {
      translationWin.command("onKeepLang", "");
    }

    const actionWin = pluginWindows.get("custom-action");
    if (actionWin && actionWin.id === windowId) {
      if (buttonId === 0) {
        actionWin.command(CUSTOM_ACTION_DIALOG_EVENTS.clickAdd, "");
        return;
      }
    }

    const deleteWin = pluginWindows.get("custom-action-delete");
    if (deleteWin && deleteWin.id === windowId) {
      if (buttonId === 0) {
        deleteWin.command(CUSTOM_ACTION_DELETE_DIALOG_EVENTS.confirm, "");
        return;
      }
    }

    const assistantWin = pluginWindows.get("custom-assistant");
    if (assistantWin && assistantWin.id === windowId) {
      if (buttonId === 0) {
        assistantWin.command(CUSTOM_ASSISTANT_DIALOG_EVENTS.clickAdd, "");
        return;
      }
    }

    const assistantDeleteWin = pluginWindows.get("custom-assistant-delete");
    if (assistantDeleteWin && assistantDeleteWin.id === windowId) {
      if (buttonId === 0) {
        assistantDeleteWin.command(
          CUSTOM_ASSISTANT_DELETE_DIALOG_EVENTS.confirm,
          ""
        );
        return;
      }
    }

    window.Asc.plugin.executeMethod("CloseWindow", [windowId]);
    for (const [id, win] of pluginWindows) {
      if (win && win.id === windowId) {
        pluginWindows.set(id, null);
        break;
      }
    }
  };
};
