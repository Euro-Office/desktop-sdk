const VECTOR_IMAGE_SCALE = 2.5;
const IMAGE_NAME_REGEX = /\/([^/@]+?)(?:@([\d.]+)x)?\.(png|svg)(?:\?url)?$/;

type ImageMap = Record<string, string>;

type ImageCollectionEntry = {
  scale: number;
  src: string;
};

export type ImageCollections = Record<string, ImageCollectionEntry[]>;

const parseImageMeta = (path: string) => {
  const match = path.match(IMAGE_NAME_REGEX);
  if (!match) return null;

  const [, name, scale, ext] = match;
  return {
    name,
    scale: ext === "svg" ? VECTOR_IMAGE_SCALE : scale ? Number(scale) : 1,
  };
};

const buildCollections = (images: ImageMap): ImageCollections => {
  const collections: ImageCollections = {};

  for (const [path, src] of Object.entries(images)) {
    const meta = parseImageMeta(path);
    if (!meta) continue;

    if (!collections[meta.name]) {
      collections[meta.name] = [];
    }
    collections[meta.name].push({ scale: meta.scale, src });
  }

  for (const entries of Object.values(collections)) {
    entries.sort((a, b) => a.scale - b.scale);
  }

  return collections;
};

const lightImageMap = import.meta.glob<string>("../assets/light/*.png", {
  eager: true,
  import: "default",
}) as ImageMap;

const darkImageMap = import.meta.glob<string>("../assets/dark/*.png", {
  eager: true,
  import: "default",
}) as ImageMap;

const svgImageMap = import.meta.glob<string>("../assets/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
}) as ImageMap;

const formatsPngMap = import.meta.glob<string>("../assets/formats/*.png", {
  eager: true,
  import: "default",
}) as ImageMap;

const formatsSvgMap = import.meta.glob<string>("../assets/formats/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
}) as ImageMap;

export const lightImages = buildCollections({
  ...lightImageMap,
  ...svgImageMap,
  ...formatsPngMap,
  ...formatsSvgMap,
});
export const darkImages = buildCollections({
  ...darkImageMap,
  ...svgImageMap,
  ...formatsPngMap,
  ...formatsSvgMap,
});

type ThemeType = "light" | "dark";

type ImageResult = {
  src: string;
  isSvg: boolean;
};

export const getImageSrc = (
  name: string,
  theme: ThemeType,
  scale: number
): ImageResult | null => {
  const collections = theme === "dark" ? darkImages : lightImages;
  const entries = collections[name];

  if (!entries || entries.length === 0) {
    return null;
  }

  // Find best match: first entry with scale >= requested, or highest available
  const match =
    entries.find((e) => e.scale >= scale) || entries[entries.length - 1];

  return {
    src: match.src,
    isSvg: match.scale === VECTOR_IMAGE_SCALE,
  };
};
