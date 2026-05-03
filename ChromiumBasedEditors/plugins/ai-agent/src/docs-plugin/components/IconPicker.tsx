import { AI_ACTION_ICONS, getIconPreviewSrc } from "../ai-actions/icons";

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
  return (
    <div id={id} className="icon-picker" role="radiogroup" aria-label="Icon">
      {AI_ACTION_ICONS.map((icon) => {
        const selected = icon.id === value;
        return (
          <label
            key={icon.id}
            className={`icon-picker__item${selected ? " icon-picker__item--selected" : ""}`}
            title={icon.label}
          >
            <input
              type="radio"
              name="action-icon-picker"
              value={icon.id}
              checked={selected}
              onChange={() => onChange(icon.id)}
            />
            <img
              src={getIconPreviewSrc(icon.id, themeType)}
              alt={icon.label}
              draggable={false}
            />
          </label>
        );
      })}
    </div>
  );
}
