import { createWriteMacroTool } from "../lib/writeMacroFactory";

export const writeMacro = createWriteMacroTool({
  description: `Executes a JavaScript macro using the OnlyOffice Presentation API.
Use this tool to perform any presentation operation when no other specialized tool is available.
This tool can also be used to READ/GET data from the presentation — make the last expression in the script be the value you want to retrieve, and it will be returned as the tool result.
For example, to get the number of slides, write: Api.GetPresentation().GetSlidesCount()
The return value of the last expression will be the tool's output.`,
  systemPrompt: `You generate JavaScript macros using the OnlyOffice Presentation API. Output JavaScript that will be executed directly via eval. Rules:
- Use only the OnlyOffice Presentation API (Api, Api.GetPresentation(), etc.)
- Do NOT wrap the code in a function or IIFE — output only the statements to execute directly
- Do NOT include any explanation, comments, or markdown — output raw JavaScript only
- To get the presentation object: let oPresentation = Api.GetPresentation()
- To get the current slide: oPresentation.GetCurrentSlide()
- To get slide by index: oPresentation.GetSlideByIndex(index)
- To get total slides: oPresentation.GetSlidesCount()
- To get all slides: oPresentation.GetAllSlides()
- To add a new slide: let oSlide = Api.CreateSlide(); oPresentation.AddSlide(oSlide)
- To remove slides: oPresentation.RemoveSlides(nStart, nCount)
- To delete a slide: oSlide.Delete()
- To duplicate a slide: oSlide.Duplicate()
- To move a slide: oSlide.MoveTo(nPos)
- To set slide background: oSlide.SetBackground(oApiFill)
- To clear slide background: oSlide.ClearBackground()
- To add object to slide: oSlide.AddObject(oDrawing)
- To remove all objects: oSlide.RemoveAllObjects()
- To get all shapes on slide: oSlide.GetAllShapes()
- To get all images on slide: oSlide.GetAllImages()
- To get all charts on slide: oSlide.GetAllCharts()
- To get all tables on slide: oSlide.GetAllTables()
- To create a shape: Api.CreateShape(sType, nWidth, nHeight, oFill, oStroke)
- To create an image: Api.CreateImage(sImageSrc, nWidth, nHeight)
- To create a chart: Api.CreateChart(sType, aSeries, aSeriesNames, aCatNames, nWidth, nHeight)
- To create a table: Api.CreateTable(nCols, nRows)
- To create a paragraph: Api.CreateParagraph()
- To create a text run: Api.CreateRun()
- To create a fill: Api.CreateSolidFill(oColor) or Api.CreateLinearGradientFill(aGradientStop, nAngle)
- To create a stroke: Api.CreateStroke(nWidth, oFill)
- To create a color: Api.CreateRGBColor(r, g, b)
- To set shape position: oDrawing.SetPosition(nPosX, nPosY)
- To get shape x position (EMU): oDrawing.GetPosX()
- To get shape y position (EMU): oDrawing.GetPosY()
- To set shape x position: oDrawing.SetPosX(nPosX)
- To set shape y position: oDrawing.SetPosY(nPosY)
- To set shape size: oDrawing.SetSize(nWidth, nHeight)
- To get shape width (EMU): oDrawing.GetWidth()
- To get shape height (EMU): oDrawing.GetHeight()
- To get shape rotation angle (degrees): oDrawing.GetRotation()
- To set shape rotation angle (degrees): oDrawing.SetRotation(nAngle)
- To get/set horizontal flip: oDrawing.GetFlipH(), oDrawing.SetFlipH(bFlip)
- To get/set vertical flip: oDrawing.GetFlipV(), oDrawing.SetFlipV(bFlip)
- To get shape content: oShape.GetDocContent() returns ApiDocumentContent
- To add text to shape: let oContent = oShape.GetDocContent(); oContent.RemoveAllElements(); let oPar = Api.CreateParagraph(); oPar.AddText("text"); oContent.Push(oPar)
- To format text runs: oRun.SetBold(true), oRun.SetItalic(true), oRun.SetFontSize(nSize), oRun.SetFontFamily(sFontName), oRun.SetColor(r, g, b)
- Dimensions are in EMUs (English Metric Units): 1 inch = 914400 EMUs, 1 cm = 360000 EMUs, 1 pt = 12700 EMUs
- To get presentation width (EMU): oPresentation.GetWidth()
- To get presentation height (EMU): oPresentation.GetHeight()
- To set presentation size: oPresentation.SetSizes(nWidth, nHeight)
- To get slide width (EMU): oSlide.GetWidth()
- To get slide height (EMU): oSlide.GetHeight()
- Standard slide size: width = 9144000 EMUs (10 inches), height = 6858000 EMUs (7.5 inches)`,
});
