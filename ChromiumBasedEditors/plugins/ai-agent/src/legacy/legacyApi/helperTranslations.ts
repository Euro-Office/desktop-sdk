// Port of <old>/scripts/engine/storage.js helper-translations loader.
// Used by EditorHelperImpl.getHumanName to localize tool names in chat UI.

export type HelperTranslations = Record<string, string>;

async function loadResourceAsText(url: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onload = () => {
        const status = xhr.status;
        if (status === 200 || location.href.indexOf("file:") === 0) {
          resolve(xhr.responseText);
        } else {
          resolve("");
        }
      };
      xhr.onerror = () => resolve("");
      xhr.send("");
    } catch {
      resolve("");
    }
  });
}

export async function loadHelperTranslations(): Promise<HelperTranslations> {
  const plugin = window.Asc?.plugin as { info?: { lang?: string } } | undefined;
  let lang = plugin?.info?.lang || "en";
  if (lang.startsWith("en")) return {};

  if (lang.length === 2) {
    lang = `${lang.toLowerCase()}-${lang.toUpperCase()}`;
  }

  const text = await loadResourceAsText(`./translations/helpers/${lang}.json`);
  if (!text) return {};
  try {
    return JSON.parse(text) as HelperTranslations;
  } catch {
    return {};
  }
}
