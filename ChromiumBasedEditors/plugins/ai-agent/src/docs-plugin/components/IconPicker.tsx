import clsx from "clsx";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { AI_ACTION_ICONS, getIconPreviewSrc } from "../ai-actions/icons";
import { getZoomSuffix } from "../theme-utils";

interface IconPickerProps {
  id?: string;
  value: string;
  themeType: "light" | "dark";
  onChange: (iconId: string) => void;
}

export function IconPicker({
  id,
  value,
  themeType,
  onChange,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const groupName = useId();
  const [zoomSuffix, setZoomSuffix] = useState(() => getZoomSuffix());

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const onResize = () => setZoomSuffix(getZoomSuffix());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggle = () => setOpen((v) => !v);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const renderTile = (
    icon: (typeof AI_ACTION_ICONS)[number],
    keyPrefix: string
  ) => {
    const selected = icon.id === value;
    return (
      <label
        key={`${keyPrefix}-${icon.id}`}
        className={clsx("icon-combobox__tile", {
          "icon-combobox__tile--selected": selected,
        })}
        title={icon.label}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="radio"
          name={groupName}
          value={icon.id}
          checked={selected}
          onChange={() => onChange(icon.id)}
        />
        <img
          src={getIconPreviewSrc(icon.id, themeType, zoomSuffix)}
          alt={icon.label}
          draggable={false}
        />
      </label>
    );
  };

  return (
    <div ref={rootRef} className="icon-combobox">
      <div
        ref={triggerRef}
        id={id}
        className="icon-combobox__trigger"
        role="combobox"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Icon"
        data-state={open ? "open" : "closed"}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
      >
        <div className="icon-combobox__row">
          <div className="icon-combobox__tiles">
            {AI_ACTION_ICONS.map((icon) => renderTile(icon, "closed"))}
          </div>
        </div>
        <div
          className={clsx("icon-combobox__arrow", {
            "icon-combobox__arrow--open": open,
          })}
          aria-hidden="true"
        >
          <b />
        </div>
      </div>
      {open && (
        <div
          className="icon-combobox__popover"
          role="listbox"
          aria-label="Icon"
        >
          <div className="icon-combobox__grid">
            {AI_ACTION_ICONS.map((icon) => renderTile(icon, "open"))}
          </div>
        </div>
      )}
    </div>
  );
}
