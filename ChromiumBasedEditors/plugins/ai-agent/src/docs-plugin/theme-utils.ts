export function updateBodyThemeClasses(
  themeType?: string,
  themeName?: string
): void {
  const classes = document.body.className.split(" ");
  for (const className of classes) {
    if (className.includes("theme-")) {
      document.body.classList.remove(className);
    }
  }
  if (themeName) document.body.classList.add(themeName);
  if (themeType) document.body.classList.add(`theme-type-${themeType}`);
}

const COLOR_REGEX = /^(#([0-9a-f]{3}){1,2}|rgba?\([^)]+\)|hsl\([^)]+\))$/i;

export function updateThemeVariables(theme: AscTheme): void {
  const old = document.getElementById("theme-variables");
  if (old) old.remove();

  let css = ":root {\n";
  for (const key of Object.keys(theme)) {
    const value = theme[key];
    if (typeof value !== "string") continue;
    if (!COLOR_REGEX.test(value)) continue;
    const cssKey = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    css += ` ${cssKey}: ${value};\n`;
  }
  css += "}";

  const style = document.createElement("style");
  style.id = "theme-variables";
  style.textContent = css;
  document.head.appendChild(style);
}
