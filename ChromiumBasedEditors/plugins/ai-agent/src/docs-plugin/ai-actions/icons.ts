export interface ActionIcon {
  id: string;
  label: string;
  baseName: string;
}

export const AI_ACTION_ICONS: readonly ActionIcon[] = [
  { id: "default", label: "Default", baseName: "written-plugin" },
  { id: "writer", label: "Writer", baseName: "plugin-writer" },
  { id: "summary", label: "Summary", baseName: "summarization" },
  { id: "translate", label: "Translate", baseName: "translation" },
  { id: "grammar", label: "Grammar", baseName: "grammar" },
  { id: "settings", label: "Settings", baseName: "settings" },
] as const;

export const DEFAULT_ICON_ID = "default";

export function getActionIcon(id: string): ActionIcon {
  return AI_ACTION_ICONS.find((i) => i.id === id) ?? AI_ACTION_ICONS[0];
}

export function getIconToolbarPath(iconId: string): string {
  const icon = getActionIcon(iconId);
  return `resources/%theme-type%(light|dark)/big/${icon.baseName}%scale%(default).png`;
}

export function getIconPreviewSrc(
  iconId: string,
  themeType: "light" | "dark"
): string {
  const icon = getActionIcon(iconId);
  return `resources/${themeType}/big/${icon.baseName}.png`;
}
