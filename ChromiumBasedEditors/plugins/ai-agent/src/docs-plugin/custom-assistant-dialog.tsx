import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Select, type SelectOption } from "./components/Select";
import { updateBodyThemeClasses, updateThemeVariables } from "./theme-utils";
import "./custom-assistant-dialog.css";

const LOCAL_STORAGE_KEY = "onlyoffice_ai_saved_assistants";

type AssistantType = "0" | "1" | "2";

interface SavedAssistant {
  id: string;
  name: string;
  type: number;
  query: string;
}

const ACTION_OPTIONS: SelectOption<AssistantType>[] = [
  { value: "0", label: "Hint" },
  { value: "2", label: "Replace" },
  { value: "1", label: "Replace + Hint" },
];

function generateHashedDateString(): string {
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

function loadAssistants(): SavedAssistant[] {
  try {
    return JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY) || "[]"
    ) as SavedAssistant[];
  } catch {
    return [];
  }
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

function CustomAssistantDialog() {
  const [assistantId, setAssistantId] = useState<string>(() =>
    generateHashedDateString()
  );
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AssistantType>("0");
  const [warning, setWarning] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement | null>(null);
  const queryRef = useRef<HTMLTextAreaElement | null>(null);

  const stateRef = useRef({ assistantId, name, query, type });
  useEffect(() => {
    stateRef.current = { assistantId, name, query, type };
  }, [assistantId, name, query, type]);

  const options = useMemo(() => ACTION_OPTIONS, []);

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

    window.Asc.plugin.attachEvent("onEditAssistant", (raw: unknown) => {
      const id = typeof raw === "string" ? raw : "";
      if (!id) return;
      const found = loadAssistants().find((a) => a.id === id);
      if (!found) return;
      setAssistantId(found.id);
      setName(found.name);
      setQuery(found.query);
      setType(String(found.type) as AssistantType);
      setTimeout(() => queryRef.current?.focus(), 0);
    });

    window.Asc.plugin.attachEvent("onWarningAssistant", (raw: unknown) => {
      setWarning(typeof raw === "string" ? raw : "");
    });

    window.Asc.plugin.attachEvent("onClickAdd", () => {
      const cur = stateRef.current;
      const trimmedName = cur.name.trim();
      const trimmedQuery = cur.query.trim();
      if (!trimmedName) {
        nameRef.current?.focus();
        window.Asc.plugin.sendToPlugin("onAddEditAssistant", null as never);
        return;
      }
      if (!trimmedQuery) {
        queryRef.current?.focus();
        window.Asc.plugin.sendToPlugin("onAddEditAssistant", null as never);
        return;
      }
      const data: SavedAssistant = {
        id: cur.assistantId,
        name: trimmedName,
        type: Number(cur.type),
        query: trimmedQuery,
      };
      const all = loadAssistants();
      const idx = all.findIndex((a) => a.id === data.id);
      if (idx !== -1) all[idx] = data;
      else all.push(data);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
      window.Asc.plugin.sendToPlugin("onAddEditAssistant", data);
    });

    window.Asc.plugin.sendToPlugin("onWindowReady", {});

    setTimeout(() => nameRef.current?.focus(), 0);

    return () => {
      window.Asc.plugin.detachEvent("onThemeChanged");
      window.Asc.plugin.detachEvent("onEditAssistant");
      window.Asc.plugin.detachEvent("onWarningAssistant");
      window.Asc.plugin.detachEvent("onClickAdd");
    };
  }, []);

  if (warning !== null) {
    return (
      <div className="custom_assistant_window warning">
        <div id="warning_text" className="noselect">
          {WARNING_SVG}
          <p className="i18n">{warning}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="custom_assistant_window">
      <div id="custom_assistant" className="noselect">
        <span className="i18n">
          Turn any repetitive text task into a custom button on your toolbar.
          Automate specific editing, checking, or rewriting tasks using the
          power of AI.
        </span>
      </div>

      <form
        id="input_prompt_wrapper"
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="hidden"
          id="input_prompt_id"
          value={assistantId}
          readOnly
        />
        <label htmlFor="input_prompt_name" className="noselect">
          <span className="i18n">Name</span>
          <strong>*</strong>
        </label>
        <input
          ref={nameRef}
          type="text"
          id="input_prompt_name"
          className="form-control i18n"
          maxLength={30}
          placeholder="Give your tool a short name for the toolbar"
          spellCheck={false}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor="input_prompt" className="noselect">
          <span className="i18n">Prompt</span>
          <strong>*</strong>
        </label>
        <textarea
          ref={queryRef}
          id="input_prompt"
          minLength={1}
          rows={1}
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
        <Select<AssistantType>
          id="assistantType"
          value={type}
          options={options}
          onValueChange={setType}
        />
      </form>
    </div>
  );
}

window.Asc.plugin.init = () => {
  const container = document.getElementById("custom_assistant_window_root");
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <CustomAssistantDialog />
      </StrictMode>
    );
  }
};
