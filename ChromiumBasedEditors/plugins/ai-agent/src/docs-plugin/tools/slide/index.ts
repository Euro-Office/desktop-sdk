import type { HostTool } from "@onlyoffice/ai-chat";
import { addChartToSlide } from "./addChartToSlide";
import { addImageByDescription } from "./addImageByDescription";
import { addNewSlide } from "./addNewSlide";
import { addShapeToSlide } from "./addShapeToSlide";
import { addTableToSlide } from "./addTableToSlide";
import { addTextToPlaceholder } from "./addTextToPlaceholder";
import { changeSlideBackground } from "./changeSlideBackground";
import { deleteSlide } from "./deleteSlide";
import { duplicateSlide } from "./duplicateSlide";
import { generatePresentationWithTheme } from "./generatePresentationWithTheme";
import { writeMacro } from "./writeMacro";

export const slideTools: HostTool[] = [
  addNewSlide,
  deleteSlide,
  duplicateSlide,
  changeSlideBackground,
  addShapeToSlide,
  addTableToSlide,
  addChartToSlide,
  addTextToPlaceholder,
  addImageByDescription,
  generatePresentationWithTheme,
  writeMacro,
];
