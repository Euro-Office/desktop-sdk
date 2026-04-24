import { ToolError } from "./ToolError";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function isValidChannel(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 255;
}

export function optionalRgbColor(
  params: Record<string, unknown>,
  key: string,
  exampleHint = ""
): RgbColor | undefined {
  const value = params[key];
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== "object" ||
    !isValidChannel((value as RgbColor).r) ||
    !isValidChannel((value as RgbColor).g) ||
    !isValidChannel((value as RgbColor).b)
  ) {
    throw new ToolError(
      `Invalid ${key}: r, g, b must each be integers between 0 and 255.${
        exampleHint ? ` Example: ${exampleHint}.` : ""
      } Not a hex string.`
    );
  }
  return value as RgbColor;
}
