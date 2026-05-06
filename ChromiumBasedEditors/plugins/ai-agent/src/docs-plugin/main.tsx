import type { StorageAdapter } from "@onlyoffice/ai-chat";
import { isDesktopEditor } from "@/shared/lib/utils";
import { runAction } from "./custom-actions/action-runner";
import {
  CUSTOM_ACTION_DELETE_DIALOG_EVENTS,
  CUSTOM_ACTION_DIALOG_EVENTS,
} from "./custom-actions/dialog-events";
import { getIconToolbarPath } from "./custom-actions/icons";
import { deleteAction, loadActions } from "./custom-actions/storage";
import type { CustomAiAction } from "./custom-actions/types";
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
  });

  window.Asc.plugin.attachEditorEvent("onBlurAnnotation", (obj: unknown) => {
    const p = obj as { name: string } | null;
    if (!p) return;
    if (p.name === "spelling") spellchecker.onBlur();
    else if (p.name === "grammar") grammar.onBlur();
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
        refreshActionButton(existingBtn);
        actionButtons.delete(action.id);
      }
      const btn = new window.Asc.ButtonToolbar(undefined);
      configureActionButton(btn, action);
      actionButtons.set(action.id, btn);
      refreshActionButton(btn);

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
          refreshActionButton(existingBtn);
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
    "resources/%theme-type%(light|dark)/big/btn-next-field%scale%(default).png";
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

    window.Asc.plugin.executeMethod("CloseWindow", [windowId]);
    for (const [id, win] of pluginWindows) {
      if (win && win.id === windowId) {
        pluginWindows.set(id, null);
        break;
      }
    }
  };
};
