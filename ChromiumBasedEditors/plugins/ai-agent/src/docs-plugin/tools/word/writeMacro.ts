import { createWriteMacroTool } from "../lib/writeMacroFactory";

export const writeMacro = createWriteMacroTool({
  description: `Executes a JavaScript macro using the OnlyOffice Document API (text documents / Word).
Use this tool to perform any document operation when no other specialized tool is available.
This tool can also be used to READ/GET data from the document — make the last expression in the script be the value you want to retrieve, and it will be returned as the tool result.
For example, to get the text of the first paragraph, write: Api.GetDocument().GetElement(0).GetText()
The return value of the last expression will be the tool's output.`,
  codeParamDescription: `Valid JavaScript code using the OnlyOffice Document API to execute directly via eval. Rules:
- Use only the OnlyOffice Document API (Api, ApiDocument, ApiParagraph, ApiRun, ApiTable, etc.)
- Do NOT wrap the code in a function or IIFE — output only the statements to execute directly
- Do NOT include any explanation, comments, or markdown — output raw JavaScript only
- To GET/READ data: make the last expression the value you want to return (e.g. oDoc.GetElement(0).GetText())
- To get the document object: let oDoc = Api.GetDocument()
- To get elements count: oDoc.GetElementsCount()
- To get element by index: oDoc.GetElement(index) — returns ApiParagraph or ApiTable
- To check element type: element.GetClassType() — returns 'paragraph', 'table', etc.
- To get all paragraphs text: iterate with GetElementsCount()/GetElement(i), then paragraph.GetText()
- To get paragraph range: paragraph.GetRange(nStart, nEnd)
- To get document range: oDoc.GetRange(nStart, nEnd)
- To select content: range.Select() or paragraph.Select()
- To search text: oDoc.Search(sText, isMatchCase) returns array of ApiRange
- To search and replace: oDoc.SearchAndReplace({searchString: "old", replaceString: "new"})
- To create a paragraph: Api.CreateParagraph()
- To add text to paragraph: oPar.AddText("text")
- To insert paragraph: oDoc.InsertContent([oPar], nPos) or oDoc.Push(oPar)
- To remove element: oDoc.RemoveElement(nPos)
- To create a run: Api.CreateRun()
- To add text to run: oRun.AddText("text")
- To add run to paragraph: oPar.AddElement(oRun)
- Run formatting: oRun.SetBold(true), oRun.SetItalic(true), oRun.SetUnderline(true), oRun.SetStrikeout(true), oRun.SetFontSize(nSize), oRun.SetFontFamily(sFontName), oRun.SetColor(r, g, b), oRun.SetHighlight(sColor), oRun.SetCaps(true), oRun.SetSmallCaps(true), oRun.SetDoubleStrikeout(true), oRun.SetSpacing(nSpacing)
- Paragraph formatting: oPar.SetBold(true), oPar.SetItalic(true), oPar.SetJc(sJc) where sJc = "left"|"center"|"right"|"both", oPar.SetSpacingAfter(nSpacing), oPar.SetSpacingBefore(nSpacing), oPar.SetIndLeft(nValue), oPar.SetIndRight(nValue), oPar.SetIndFirstLine(nValue)
- Paragraph style: oPar.SetStyle(Api.CreateStyle(sName, sType)) or oPar.SetStyle(oDoc.GetStyle(sName))
- IMPORTANT: When changing text formatting (font, size, color, etc.) across paragraphs, you MUST iterate through every paragraph and every run and apply the property directly to each run. Modifying only paragraph-level or default-style properties will NOT work because direct run properties override them.
- To iterate runs in a paragraph: use paragraph.GetElementsCount() and paragraph.GetElement(i); check GetClassType() === 'run'
- To get/set run text: oRun.GetText() / oRun.ClearContent() + oRun.AddText("new text")
- To create a table: Api.CreateTable(nCols, nRows)
- To get table row: oTable.GetRow(nIndex)
- To get table cell: oRow.GetCell(nIndex) or oTable.GetCell(nRow, nCol)
- To get cell content: oCell.GetContent() returns ApiDocumentContent
- To set cell text: let oCellContent = oCell.GetContent(); oCellContent.GetElement(0).AddText("text")
- Table formatting: oTable.SetWidth("auto"|"twips"|"percent", nValue), oTable.SetTableBorderTop/Bottom/Left/Right(sType, nSize, nSpace, r, g, b)
- To create a numbered/bulleted list: oPar.SetBullet(oBullet) where oBullet = Api.CreateBullet(sSymbol) or Api.CreateNumbering(sType)
- To add page break: oPar.AddPageBreak()
- To add line break: oRun.AddLineBreak()
- To add hyperlink: oPar.AddHyperlink(sLink, sScreenTipText)
- To add image inline: oPar.AddDrawing(Api.CreateImage(sImageSrc, nWidth, nHeight))
- To create a shape: Api.CreateShape(sType, nWidth, nHeight, oFill, oStroke)
- To create a chart: Api.CreateChart(sType, aSeries, aSeriesNames, aCatNames, nWidth, nHeight)
- To create fill: Api.CreateSolidFill(oColor), Api.CreateLinearGradientFill(aGradientStop, nAngle), Api.CreateNoFill()
- To create stroke: Api.CreateStroke(nWidth, oFill)
- To create color: Api.CreateRGBColor(r, g, b)
- Sections: oDoc.GetSections() returns array, section.SetPageSize(nWidth, nHeight), section.SetPageMargins(nLeft, nTop, nRight, nBottom)
- Headers/Footers: section.GetHeader(sType, isCreate), section.GetFooter(sType, isCreate) where sType = "default"|"even"|"first"
- Comments: Api.CreateComment(sText, sAuthor), range.AddComment(oComment)
- Bookmarks: range.AddBookmark(sName), oDoc.GetBookmarkRange(sName)
- Content controls: oDoc.GetContentControls() to get all, Api.CreateBlockContentControl() to create new
- Dimensions: use twips for widths (1 inch = 1440 twips, 1 cm = 567 twips), EMUs for images/shapes (1 inch = 914400 EMUs)`,
});
