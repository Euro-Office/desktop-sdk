export interface PlaceholderSpec {
  ph_type: string;
  ph_idx: number;
}

function ph(type: string, idx: number): PlaceholderSpec {
  return { ph_type: type, ph_idx: idx };
}

export const LAYOUT_SPECS: Record<string, PlaceholderSpec[]> = {
  title: [
    ph("ctrTitle", 0),
    ph("subTitle", 1),
    ph("dt", 10),
    ph("ftr", 11),
    ph("sldNum", 12),
  ],
  obj: [
    ph("title", 0),
    ph("body", 1),
    ph("dt", 10),
    ph("ftr", 11),
    ph("sldNum", 12),
  ],
  secHead: [
    ph("title", 0),
    ph("body", 1),
    ph("dt", 10),
    ph("ftr", 11),
    ph("sldNum", 12),
  ],
  twoObj: [
    ph("title", 0),
    ph("body", 1),
    ph("body", 2),
    ph("dt", 10),
    ph("ftr", 11),
    ph("sldNum", 12),
  ],
  twoTxTwoObj: [
    ph("title", 0),
    ph("body", 1),
    ph("body", 2),
    ph("body", 3),
    ph("body", 4),
    ph("dt", 10),
    ph("ftr", 11),
    ph("sldNum", 12),
  ],
  titleOnly: [ph("title", 0), ph("dt", 10), ph("ftr", 11), ph("sldNum", 12)],
  blank: [ph("dt", 10), ph("ftr", 11), ph("sldNum", 12)],
  objTx: [
    ph("title", 0),
    ph("body", 1),
    ph("body", 2),
    ph("dt", 10),
    ph("ftr", 11),
    ph("sldNum", 12),
  ],
  picTx: [
    ph("title", 0),
    ph("picture", 1),
    ph("body", 2),
    ph("dt", 10),
    ph("ftr", 11),
    ph("sldNum", 12),
  ],
  vertTx: [
    ph("title", 0),
    ph("body", 1),
    ph("dt", 10),
    ph("ftr", 11),
    ph("sldNum", 12),
  ],
  vertTitleAndTx: [
    ph("title", 0),
    ph("body", 1),
    ph("dt", 10),
    ph("ftr", 11),
    ph("sldNum", 12),
  ],
};

function getFromMapByKey<T>(
  map: Record<string, T> | null | undefined,
  key: string | null | undefined
): T | null {
  if (!map || typeof map !== "object") return null;
  if (typeof key !== "string") return null;
  const k = key.toLowerCase();
  for (const mapKey in map) {
    if (Object.hasOwn(map, mapKey)) {
      if (mapKey.toLowerCase() === k) return map[mapKey];
    }
  }
  return null;
}

export function normalizeName(
  name: string | null | undefined,
  mapAllowedNames?: Record<string, string>
): string {
  const n = String(name || "").trim();
  const lower = n.replace(/[\s_-]/g, "").toLowerCase();
  if (mapAllowedNames?.[lower]) return mapAllowedNames[lower];
  return lower;
}

export function normalizePhType(type: string | null | undefined): string {
  if (!type) return "body";
  return normalizeName(type, {
    picture: "picture",
    ctrtitle: "ctrTitle",
    subtitle: "subTitle",
  });
}

export function normalizeLayoutName(name: string | null | undefined): string {
  return normalizeName(name, {
    title: "title",
    obj: "obj",
    twoobj: "twoObj",
    twotxtwoobj: "twoTxTwoObj",
    sechead: "secHead",
    titleonly: "titleOnly",
    blank: "blank",
    objtx: "objTx",
    pictx: "picTx",
    verttx: "vertTx",
    verttitleandtx: "vertTitleAndTx",
  });
}

export function getLayoutSpec(ltType: string): PlaceholderSpec[] | null {
  return getFromMapByKey(LAYOUT_SPECS, ltType);
}
