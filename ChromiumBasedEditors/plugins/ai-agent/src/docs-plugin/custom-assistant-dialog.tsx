import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_ICON_ID } from "./ai-actions/icons";
import { findAction, upsertAction } from "./ai-actions/storage";
import type { CustomAiAction, CustomAiActionType } from "./ai-actions/types";
import { IconPicker } from "./components/IconPicker";
import { Select, type SelectOption } from "./components/Select";
import { updateBodyThemeClasses, updateThemeVariables } from "./theme-utils";
import "./custom-assistant-dialog.css";

interface ProfileOption {
  id: string;
  name: string;
}

const DEFAULT_PROFILE_VALUE = "__default__";

const ACTION_OPTIONS: SelectOption<string>[] = [
  { value: "0", label: "Hint" },
  { value: "2", label: "Replace" },
  { value: "1", label: "Replace + Hint" },
];

function generateActionId(): string {
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

function CustomActionDialog() {
  const [actionId, setActionId] = useState<string>(() => generateActionId());
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("0");
  const [additionalAction, setAdditionalAction] = useState("");
  const [iconId, setIconId] = useState<string>(DEFAULT_ICON_ID);
  const [profileValue, setProfileValue] = useState<string>(
    DEFAULT_PROFILE_VALUE
  );
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [themeType, setThemeType] = useState<"light" | "dark">("light");
  const [warning, setWarning] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingProfileIdRef = useRef<string | null>(null);

  const stateRef = useRef({
    actionId,
    name,
    query,
    type,
    additionalAction,
    iconId,
    profileValue,
  });

  useEffect(() => {
    stateRef.current = {
      actionId,
      name,
      query,
      type,
      additionalAction,
      iconId,
      profileValue,
    };
  }, [actionId, name, query, type, additionalAction, iconId, profileValue]);

  const profileOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: DEFAULT_PROFILE_VALUE, label: "Default scheme" },
      ...profiles.map((p) => ({ value: p.id, label: p.name })),
    ],
    [profiles]
  );

  useEffect(() => {
    if (!profilesLoaded) return;
    const pending = pendingProfileIdRef.current;
    if (pending === null) return;
    const exists = profiles.some((p) => p.id === pending);
    setProfileValue(exists ? pending : DEFAULT_PROFILE_VALUE);
    pendingProfileIdRef.current = null;
  }, [profilesLoaded, profiles]);

  useEffect(() => {
    const theme = window.Asc.plugin.info?.theme;
    if (theme) {
      updateBodyThemeClasses(theme.type, theme.name);
      updateThemeVariables(theme);
      if (theme.type === "dark" || theme.type === "light")
        setThemeType(theme.type);
    }

    window.Asc.plugin.attachEvent("onThemeChanged", (rawTheme: unknown) => {
      const next = rawTheme as AscTheme;
      window.Asc.plugin.onThemeChangedBase?.(next);
      updateBodyThemeClasses(next.type, next.name);
      updateThemeVariables(next);
      if (next.type === "dark" || next.type === "light")
        setThemeType(next.type);
    });

    window.Asc.plugin.attachEvent("onEditAction", (raw: unknown) => {
      const id = typeof raw === "string" ? raw : "";
      if (!id) return;
      const found = findAction(id);
      if (!found) return;
      setActionId(found.id);
      setName(found.name);
      setQuery(found.query);
      setType(String(found.type));
      setAdditionalAction(found.additionalAction);
      setIconId(found.iconId);
      pendingProfileIdRef.current = found.profileId;
      // Apply immediately if profiles already loaded; otherwise the effect
      // above re-applies when profiles arrive.
      setProfileValue(found.profileId ?? DEFAULT_PROFILE_VALUE);
      setTimeout(() => promptInputRef.current?.focus(), 0);
    });

    window.Asc.plugin.attachEvent("onWarningAction", (raw: unknown) => {
      setWarning(typeof raw === "string" ? raw : "");
    });

    window.Asc.plugin.attachEvent("onProfilesList", (raw: unknown) => {
      try {
        const list =
          typeof raw === "string"
            ? (JSON.parse(raw) as ProfileOption[])
            : (raw as ProfileOption[]);
        if (Array.isArray(list)) setProfiles(list);
      } catch {
        setProfiles([]);
      }
      setProfilesLoaded(true);
    });

    window.Asc.plugin.attachEvent("onClickAdd", () => {
      const cur = stateRef.current;
      const trimmedName = cur.name.trim();
      const trimmedQuery = cur.query.trim();
      if (!trimmedName) {
        nameInputRef.current?.focus();
        window.Asc.plugin.sendToPlugin("onAddEditAction", null as never);
        return;
      }
      if (!trimmedQuery) {
        promptInputRef.current?.focus();
        window.Asc.plugin.sendToPlugin("onAddEditAction", null as never);
        return;
      }
      const data: CustomAiAction = {
        id: cur.actionId,
        name: trimmedName,
        query: trimmedQuery,
        type: Number(cur.type) as CustomAiActionType,
        additionalAction: cur.additionalAction.trim(),
        iconId: cur.iconId,
        profileId:
          cur.profileValue === DEFAULT_PROFILE_VALUE ? null : cur.profileValue,
      };
      upsertAction(data);
      window.Asc.plugin.sendToPlugin("onAddEditAction", data);
    });

    window.Asc.plugin.sendToPlugin("onWindowReady", {});

    setTimeout(() => nameInputRef.current?.focus(), 0);

    return () => {
      window.Asc.plugin.detachEvent("onThemeChanged");
      window.Asc.plugin.detachEvent("onEditAction");
      window.Asc.plugin.detachEvent("onWarningAction");
      window.Asc.plugin.detachEvent("onProfilesList");
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
      <form
        id="input_prompt_wrapper"
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
      >
        <input type="hidden" id="input_prompt_id" value={actionId} readOnly />
        <label htmlFor="input_prompt_name" className="noselect">
          <span className="i18n">Name</span>
          <strong>*</strong>
        </label>
        <input
          ref={nameInputRef}
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
          ref={promptInputRef}
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
        <Select<string>
          id="assistantType"
          value={type}
          options={ACTION_OPTIONS}
          onValueChange={setType}
        />

        <label htmlFor="input_additional_action" className="noselect">
          <span className="i18n">Additional action</span>
        </label>
        <textarea
          id="input_additional_action"
          rows={2}
          className="form-control i18n"
          placeholder="Describe an additional action (optional)"
          spellCheck={false}
          value={additionalAction}
          onChange={(e) => setAdditionalAction(e.target.value)}
        />

        <label htmlFor="action_icon" className="noselect">
          <span className="i18n">Icon</span>
        </label>
        <IconPicker
          id="action_icon"
          value={iconId}
          themeType={themeType}
          onChange={setIconId}
        />

        <label htmlFor="action_profile" className="noselect">
          <span className="i18n">AI Model</span>
        </label>
        <Select<string>
          id="action_profile"
          value={profileValue}
          options={profileOptions}
          onValueChange={setProfileValue}
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
        <CustomActionDialog />
      </StrictMode>
    );
  }
};
