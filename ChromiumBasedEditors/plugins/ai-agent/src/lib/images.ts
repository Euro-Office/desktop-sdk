import { useState } from "react";

const VECTOR_IMAGE_SCALE = 2.5;
const IMAGE_NAME_REGEX = /\/([^/@]+?)(?:@([\d.]+)x)?\.(png|svg)(?:\?url)?$/;

type ImageMap = Record<string, string>;

type ImageCollectionEntry = {
  scale: number;
  src: string;
  path: string;
};

export type ImageCollections = Record<string, ImageCollectionEntry[]>;

const parseImageMeta = (path: string) => {
  const match = path.match(IMAGE_NAME_REGEX);

  if (!match) {
    return { name: path, scale: 1 };
  }

  const [, name, scale, extension] = match;

  const parsedScale = scale ? Number(scale) : 1;

  return {
    name,
    scale: extension === "svg" ? VECTOR_IMAGE_SCALE : parsedScale,
  };
};

const buildCollectionsByScale = (images: ImageMap): ImageCollections => {
  const collections: ImageCollections = {};

  Object.entries(images).forEach(([path, src]) => {
    const { name, scale } = parseImageMeta(path);
    const entry: ImageCollectionEntry = { scale, src, path };

    if (!collections[name]) {
      collections[name] = [];
    }

    collections[name].push(entry);
  });

  Object.values(collections).forEach((entries) => {
    entries.sort((a, b) => a.scale - b.scale);
  });

  return collections;
};

const mergeCollections = (
  base: ImageCollections,
  extra: ImageCollections
): ImageCollections => {
  const result: ImageCollections = Object.fromEntries(
    Object.entries(base).map(([name, entries]) => [
      name,
      entries.map((entry) => ({ ...entry })),
    ])
  );

  Object.entries(extra).forEach(([name, entries]) => {
    if (!result[name]) {
      result[name] = [];
    }

    result[name].push(...entries.map((entry) => ({ ...entry })));
    result[name].sort((a, b) => a.scale - b.scale);
  });

  return result;
};

const lightImageMap = import.meta.glob<string>("../assets/light/*.png", {
  eager: true,
  import: "default",
}) as ImageMap;
const darkImageMap = import.meta.glob<string>("../assets/dark/*.png", {
  eager: true,
  import: "default",
}) as ImageMap;
const svgImageMap = import.meta.glob<string>("../assets/**/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
}) as ImageMap;

const svgImages = buildCollectionsByScale(svgImageMap);

export const lightImages = mergeCollections(
  buildCollectionsByScale(lightImageMap),
  svgImages
);
export const darkImages = mergeCollections(
  buildCollectionsByScale(darkImageMap),
  svgImages
);

export const useImages = () => {
  const [_theme, _setTheme] = useState<"light" | "dark">("light");
  const [_scale, _setScale] = useState(1);

  return {
    light: lightImages,
    dark: darkImages,
  };
};
