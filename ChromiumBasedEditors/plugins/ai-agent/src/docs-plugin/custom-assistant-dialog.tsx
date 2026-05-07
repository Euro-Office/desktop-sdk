import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Select, type SelectOption } from "./components/Select";
import { CUSTOM_ASSISTANT_DIALOG_EVENTS } from "./custom-assistants/dialog-events";
import { findAssistant, upsertAssistant } from "./custom-assistants/storage";
import {
  CUSTOM_ASSISTANT_TYPE,
  type CustomAssistant,
  type CustomAssistantType,
} from "./custom-assistants/types";
import { updateBodyThemeClasses, updateThemeVariables } from "./theme-utils";
import "./custom-assistant-dialog.css";

const TYPE_OPTIONS: SelectOption<string>[] = [
  { value: String(CUSTOM_ASSISTANT_TYPE.hint), label: "Hint" },
  { value: String(CUSTOM_ASSISTANT_TYPE.replace), label: "Replace" },
  {
    value: String(CUSTOM_ASSISTANT_TYPE.replaceHint),
    label: "Replace + Hint",
  },
];

function parseAssistantType(raw: string): CustomAssistantType {
  const n = Number(raw);
  if (
    n === CUSTOM_ASSISTANT_TYPE.hint ||
    n === CUSTOM_ASSISTANT_TYPE.replace ||
    n === CUSTOM_ASSISTANT_TYPE.replaceHint
  ) {
    return n;
  }
  return CUSTOM_ASSISTANT_TYPE.hint;
}

function generateAssistantId(): string {
  const date = new Date();
  const data = date.toISOString() + Math.random() + performance.now();
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `${Math.abs(hash).toString(36)}_${date.getTime().toString(36)}`;
}

const WARNING_SVG = (
  <svg
    width="44"
    height="39"
    viewBox="0 0 44 39"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M20.5201 0.853631C21.1693 -0.284655 22.8103 -0.284653 23.4594 0.853633L43.7548 36.4414C44.398 37.5693 43.5835 38.9714 42.2851 38.9714H1.69445C0.396056 38.9714 -0.418416 37.5693 0.224796 36.4414L20.5201 0.853631Z"
      fill="#F2BE08"
    />
    <circle cx="21.99" cy="32.4614" r="2.51612" fill="white" />
    <path
      d="M25.3447 12.3324C25.3447 13.1968 24.33 17.5992 23.6672 21.5581C23.0761 25.0894 22.8285 28.2678 22.8285 28.2678C22.4092 28.2678 21.7103 28.2678 21.1511 28.2678C21.1511 28.2678 20.9036 25.0894 20.3124 21.5581C19.6496 17.5992 18.635 13.1968 18.635 12.3324C18.635 10.4795 20.137 8.97754 21.9898 8.97754C23.8427 8.97754 25.3447 10.4795 25.3447 12.3324Z"
      fill="white"
    />
  </svg>
);

function noop(): void {
  // placeholder until the dialog has rendered once
}

function CustomAssistantDialog() {
  const [assistantId, setAssistantId] = useState<string>(() =>
    generateAssistantId()
  );
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CustomAssistantType>(
    CUSTOM_ASSISTANT_TYPE.hint
  );
  const [warning, setWarning] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);

  const submitRef = useRef<() => void>(noop);
  submitRef.current = () => {
    const trimmedName = name.trim();
    const trimmedQuery = query.trim();
    if (!trimmedName) {
      nameInputRef.current?.focus();
      window.Asc.plugin.sendToPlugin(
        CUSTOM_ASSISTANT_DIALOG_EVENTS.addOrEdit,
        null as never
      );
      return;
    }
    if (!trimmedQuery) {
      promptInputRef.current?.focus();
      window.Asc.plugin.sendToPlugin(
        CUSTOM_ASSISTANT_DIALOG_EVENTS.addOrEdit,
        null as never
      );
      return;
    }
    const data: CustomAssistant = {
      id: assistantId,
      name: trimmedName,
      query: trimmedQuery,
      type,
      profileId: null,
    };
    upsertAssistant(data);
    window.Asc.plugin.sendToPlugin(
      CUSTOM_ASSISTANT_DIALOG_EVENTS.addOrEdit,
      data
    );
  };

  useEffect(() => {
    const theme = window.Asc.plugin.info?.theme;
    if (theme) {
      updateBodyThemeClasses(theme.type, theme.name);
      updateThemeVariables(theme);
    }

    window.Asc.plugin.attachEvent("onThemeChanged", (rawTheme: unknown) => {
      const next = rawTheme as AscTheme;
      window.Asc.plugin.onThemeChangedBase?.(next);
      updateBodyThemeClasses(next.type, next.name);
      updateThemeVariables(next);
    });

    window.Asc.plugin.attachEvent(
      CUSTOM_ASSISTANT_DIALOG_EVENTS.edit,
      (raw: unknown) => {
        const id = typeof raw === "string" ? raw : "";
        if (!id) return;
        const found = findAssistant(id);
        if (!found) return;
        setAssistantId(found.id);
        setName(found.name);
        setQuery(found.query);
        setType(found.type);
        setTimeout(() => promptInputRef.current?.focus(), 0);
      }
    );

    window.Asc.plugin.attachEvent(
      CUSTOM_ASSISTANT_DIALOG_EVENTS.warning,
      (raw: unknown) => {
        setWarning(typeof raw === "string" ? raw : "");
      }
    );

    window.Asc.plugin.attachEvent(
      CUSTOM_ASSISTANT_DIALOG_EVENTS.clickAdd,
      () => {
        submitRef.current();
      }
    );

    window.Asc.plugin.sendToPlugin(
      CUSTOM_ASSISTANT_DIALOG_EVENTS.windowReady,
      {}
    );

    setTimeout(() => nameInputRef.current?.focus(), 0);

    return () => {
      window.Asc.plugin.detachEvent("onThemeChanged");
      window.Asc.plugin.detachEvent(CUSTOM_ASSISTANT_DIALOG_EVENTS.edit);
      window.Asc.plugin.detachEvent(CUSTOM_ASSISTANT_DIALOG_EVENTS.warning);
      window.Asc.plugin.detachEvent(CUSTOM_ASSISTANT_DIALOG_EVENTS.clickAdd);
    };
  }, []);

  if (warning !== null) {
    return (
      <div className="ai_assistant_window warning">
        <div id="warning_text" className="noselect">
          {WARNING_SVG}
          <p className="i18n">{warning}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai_assistant_window">
      <div id="custom_assistant_intro" className="noselect">
        <span className="i18n">
          Turn any repetitive text task into a custom button on your toolbar.
          Automate specific editing, checking, or rewriting tasks using the
          power of AI.
        </span>
      </div>
      <form
        id="input_assistant_wrapper"
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="hidden"
          id="input_assistant_id"
          value={assistantId}
          readOnly
        />
        <label htmlFor="input_assistant_name" className="noselect">
          <span className="i18n">Name</span>
          <strong>*</strong>
        </label>
        <input
          ref={nameInputRef}
          type="text"
          id="input_assistant_name"
          className="form-control i18n"
          maxLength={30}
          placeholder="Give your tool a short name for the toolbar"
          spellCheck={false}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="input_assistant_prompt" className="noselect">
          <span className="i18n">Prompt</span>
          <strong>*</strong>
        </label>
        <textarea
          ref={promptInputRef}
          id="input_assistant_prompt"
          minLength={1}
          rows={4}
          className="form-control i18n"
          placeholder='Tell the AI what to do with the selected text (e.g., "Find factual errors" or "Summarize")'
          spellCheck={false}
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <label htmlFor="assistantType" className="noselect">
          <span className="i18n">Action</span>
        </label>
        <Select<string>
          id="assistantType"
          value={String(type)}
          options={TYPE_OPTIONS}
          onValueChange={(v) => setType(parseAssistantType(v))}
        />
      </form>
    </div>
  );
}

window.Asc.plugin.init = () => {
  const container = document.getElementById("ai_assistant_window_root");
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <CustomAssistantDialog />
      </StrictMode>
    );
  }
};
