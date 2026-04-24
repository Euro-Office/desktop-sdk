import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";
import { ToolError } from "../lib/ToolError";
import { optionalString } from "../lib/validation";

export const getSheetObjects = defineTool({
  name: "getSheetObjects",
  description:
    "READ. Returns charts, pivot tables, formatted tables (ApiListObject), drawings (images, shapes), named ranges, and comments. Use to audit the workbook or locate commented cells before writeMacro.",
  inputSchema: {
    type: "object",
    properties: {
      sheet: {
        type: "string",
        description:
          "Sheet name to scan. If omitted, scans the entire workbook.",
      },
    },
    required: [],
  },
  handler: async (params) => {
    const sheet = optionalString(params, "sheet");
    Asc.scope.sheet = sheet ?? null;

    const result = await editor.callCommand<
      Record<string, unknown> | { error: string }
    >(() => {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
      let sheets: any[] = [];
      if (Asc.scope.sheet) {
        const ws = Api.GetSheet(Asc.scope.sheet);
        if (!ws) {
          // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
          const names = Api.GetSheets().map((s: any) => s.GetName());
          return {
            error: `Sheet "${Asc.scope.sheet}" not found. Available: ${names.join(", ")}`,
          };
        }
        sheets = [ws];
      } else {
        sheets = Api.GetSheets();
      }

      const seenNamedRanges: Record<string, boolean> = {};
      const out: Record<string, unknown> = {
        _apiHints: {
          ApiChart:
            "GetChartType(), GetTitle()→string|null, GetAllSeries()→ApiChartSeries[], GetSeries(nIdx), GetWidth()/GetHeight(). SetTitle(text,size,bold), SetHorAxisTitle/SetVerAxisTitle(text,size,bold), SetShowDataLabels(serName,catName,val,pct), SetLegendPos('bottom'|'top'|'right'|'left'|'none'), SetLegendFontSize(pt), ApplyChartStyle(1..12), SetSeriesFill(oFill,nSeries,bAll), SetSeriesOutLine(oStroke,nSeries,bAll), SetAxieNumFormat(fmt,'bottom'|'left'|'right'|'top'), RemoveSeria(nIdx), AddSeria(nameRange,valRange,xValRange), SetSeriaValues(range,nSeria), SetSeriaName(nameRange,nSeria), SetCatFormula(range), SetSize(wEMU,hEMU), SetPosition(fromCol,0,fromRow,0), Delete(). ws.GetAllCharts(). NOTE: data range is not readable via API — omit it from responses.",
          ApiPivotTable:
            'Pure JavaScript — NOT xl* constants. Create: Api.InsertPivotNewWorksheet(dataRange,"SheetName"). Find: ws.GetPivotByName(name) or GetAllPivotTables()[0]. Field names: see allFields. Add/move: pivot.GetPivotFields("Field").SetOrientation("Rows"|"Columns"|"Filters"|"Values"|"Hidden") or pivot.MoveField(name,"Columns",index). Multiple: pivot.AddFields({rows:[...],columns:[...],pages:[...],addToTable:true}) — WARNING: addToTable defaults to false, REPLACING fields. Data: pivot.GetDataFields()[n] or pivot.AddDataField("Field") → ApiPivotDataField; SetFunction("Sum"|"Count"|"Average"...), SetCaption(...), SetNumberFormat(...), Remove() [NOT Delete()]. NOT .GetPivotDataField(). Filter: GetPivotFields("F").GetPivotItems() lists names; .GetPivotItems("Value").SetVisible(bool) — throws if name wrong. Location: range/rangeWithFilters in result. After changes: pivot.Update(). Source changed: pivot.RefreshTable().',
          ApiDrawing:
            "ApiImage/ApiShape inherit this. SetSize(wEMU,hEMU), SetPosition(fromCol,colOffEMU,fromRow,rowOffEMU), SetRotation(degrees), Delete(). GetWidth()/GetHeight() for current size. ws.GetAllDrawings()",
          ApiName:
            "SetName(name),SetRefersTo(ref) . Create/update: Api.AddDefName(name,'Sheet1!$A$1:$B$10'). ws.GetDefNames()",
          ApiComment:
            "GetText(), SetText(text), IsSolved(), SetSolved(bool), GetAuthorName(), SetAuthorName(name), Delete(). Create: range.AddComment(text,author). All on sheet: ws.GetComments(). Cell addr in getSheetObjects result: comment.addr field.",
          ApiListObject:
            "GetName()/SetName(s), GetRange(), GetHeaderRowRange()/GetDataBodyRange()/GetTotalsRowRange(), GetShowHeaders()/SetShowHeaders(bool), GetShowTotals()/SetShowTotals(bool), GetTableStyle()/SetTableStyle(s), GetShowAutoFilter()/SetShowAutoFilter(bool), GetShowAutoFilterDropDown()/SetShowAutoFilterDropDown(bool), Resize(range), Delete(), Unlist(). ApiListColumn (from GetListColumns()): GetName()/SetName(s), GetIndex(), GetRange(), GetDataBodyRange(), GetTotalsCalculation()/SetTotalsCalculation('xlTotalsCalculationNone'|'xlTotalsCalculationSum'|'xlTotalsCalculationAverage'|'xlTotalsCalculationCount'|'xlTotalsCalculationCountNums'|'xlTotalsCalculationMax'|'xlTotalsCalculationMin'|'xlTotalsCalculationStdDev'|'xlTotalsCalculationVar'|'xlTotalsCalculationCustom'), Delete(). ApiListRow (from GetListRows()): GetIndex(), GetRange(), Delete(). AddListColumn(nPos), AddListRow(nPos). Create: ws.AddListObject('xlSrcRange','A1:D10',false,'xlYes',undefined,'TableStyleLight9'). ws.GetListObjects()",
        },
        sheets: [],
      };

      const sheetList = out.sheets as Record<string, unknown>[];

      for (const ws of sheets) {
        if (!ws) continue;
        const sheetName = ws.GetName();
        const seenDrawings: Record<string, boolean> = {};
        const sheetData: Record<string, unknown> = {
          sheet: sheetName,
          charts: [],
          pivotTables: [],
          formattedTables: [],
          drawings: [],
          namedRanges: [],
          comments: [],
        };

        // Charts
        const ch = ws.GetAllCharts();
        if (ch) {
          for (const c of ch) {
            try {
              const name = c.GetName() || "";
              seenDrawings[name] = true;
              const obj: Record<string, unknown> = {
                type: "ApiChart",
                name,
              };
              try {
                obj.chartType = c.GetChartType();
              } catch {
                /* ignore */
              }
              try {
                obj.title = c.GetTitle();
              } catch {
                /* ignore */
              }
              try {
                obj.seriesCount = c.GetAllSeries().length;
              } catch {
                /* ignore */
              }
              (sheetData.charts as unknown[]).push(obj);
            } catch {
              /* ignore */
            }
          }
        }

        // Pivot tables
        const pt = ws.GetAllPivotTables();
        if (pt) {
          for (const p of pt) {
            try {
              let pName = "";
              try {
                pName = p.GetName() || "";
              } catch {
                /* ignore */
              }
              const obj: Record<string, unknown> = {
                type: "ApiPivotTable",
                name: pName,
              };
              try {
                const allPF = p.GetPivotFields();
                if (allPF?.length) {
                  const list: string[] = [];
                  for (const f of allPF) list.push(f.GetName());
                  obj.allFields = list;
                }
              } catch {
                /* ignore */
              }
              try {
                const src = p.GetSource();
                if (src) {
                  obj.sourceData = src.GetAddress
                    ? src.GetAddress(true, true, "xlA1", true)
                    : String(src);
                }
              } catch {
                /* ignore */
              }
              try {
                const rowF = p.GetRowFields();
                if (rowF?.length) {
                  const list: string[] = [];
                  for (const f of rowF) list.push(f.GetName());
                  obj.rows = list;
                }
              } catch {
                /* ignore */
              }
              try {
                const colF = p.GetColumnFields();
                if (colF?.length) {
                  const list: string[] = [];
                  for (const f of colF) list.push(f.GetName());
                  obj.columns = list;
                }
              } catch {
                /* ignore */
              }
              try {
                const pageF = p.GetPageFields();
                if (pageF?.length) {
                  const list: string[] = [];
                  for (const f of pageF) list.push(f.GetName());
                  obj.pages = list;
                }
              } catch {
                /* ignore */
              }
              try {
                const dataF = p.GetDataFields();
                if (dataF?.length) {
                  const values: Record<string, unknown>[] = [];
                  for (const df of dataF) {
                    const v: Record<string, unknown> = {};
                    try {
                      v.field = df.GetPivotField().GetName();
                    } catch {
                      /* ignore */
                    }
                    try {
                      v.caption = df.GetCaption() || df.GetName();
                    } catch {
                      /* ignore */
                    }
                    try {
                      v.function = df.GetFunction();
                    } catch {
                      /* ignore */
                    }
                    values.push(v);
                  }
                  obj.values = values;
                }
              } catch {
                /* ignore */
              }
              try {
                const r = p.GetTableRange1();
                if (r) obj.range = r.GetAddress(true, true, "xlA1", true);
              } catch {
                /* ignore */
              }
              try {
                const r = p.GetTableRange2();
                if (r)
                  obj.rangeWithFilters = r.GetAddress(true, true, "xlA1", true);
              } catch {
                /* ignore */
              }
              (sheetData.pivotTables as unknown[]).push(obj);
            } catch {
              /* ignore */
            }
          }
        }

        // Formatted tables (ListObjects)
        const lt = ws.GetListObjects();
        if (lt) {
          for (const t of lt) {
            try {
              const obj: Record<string, unknown> = {
                type: "ApiListObject",
                name: t.GetName() || "",
              };
              try {
                obj.range = t.GetRange().GetAddress(true, true, "xlA1", true);
              } catch {
                /* ignore */
              }
              try {
                const hr = t.GetHeaderRowRange();
                if (hr)
                  obj.headerRange = hr.GetAddress(true, true, "xlA1", true);
              } catch {
                /* ignore */
              }
              try {
                const dr = t.GetDataBodyRange();
                if (dr) obj.dataRange = dr.GetAddress(true, true, "xlA1", true);
              } catch {
                /* ignore */
              }
              try {
                const tr = t.GetTotalsRowRange();
                if (tr)
                  obj.totalsRange = tr.GetAddress(true, true, "xlA1", true);
              } catch {
                /* ignore */
              }
              try {
                obj.showHeaders = t.GetShowHeaders();
              } catch {
                /* ignore */
              }
              try {
                obj.showTotals = t.GetShowTotals();
              } catch {
                /* ignore */
              }
              try {
                obj.tableStyle = t.GetTableStyle();
              } catch {
                /* ignore */
              }
              try {
                const cols = t.GetListColumns();
                if (cols?.length) {
                  const colList: Record<string, unknown>[] = [];
                  for (const col of cols) {
                    try {
                      const colObj: Record<string, unknown> = {};
                      try {
                        colObj.index = col.GetIndex();
                      } catch {
                        /* ignore */
                      }
                      try {
                        colObj.name = col.GetName();
                      } catch {
                        /* ignore */
                      }
                      try {
                        colObj.totalsCalc = col.GetTotalsCalculation();
                      } catch {
                        /* ignore */
                      }
                      colList.push(colObj);
                    } catch {
                      /* ignore */
                    }
                  }
                  obj.columns = colList;
                }
              } catch {
                /* ignore */
              }
              (sheetData.formattedTables as unknown[]).push(obj);
            } catch {
              /* ignore */
            }
          }
        }

        // Drawings (skip charts already collected)
        const allDrawings = ws.GetAllDrawings();
        if (allDrawings) {
          for (const d of allDrawings) {
            try {
              const name = d.GetName() || "";
              if (seenDrawings[name]) continue;
              let classType = "";
              try {
                classType = d.GetClassType();
              } catch {
                /* ignore */
              }
              const obj: Record<string, unknown> = { name };
              obj.type =
                classType === "image"
                  ? "ApiImage"
                  : classType === "shape"
                    ? "ApiShape"
                    : "ApiDrawing";
              try {
                obj.widthEMU = d.GetWidth();
              } catch {
                /* ignore */
              }
              try {
                obj.heightEMU = d.GetHeight();
              } catch {
                /* ignore */
              }
              (sheetData.drawings as unknown[]).push(obj);
            } catch {
              /* ignore */
            }
          }
        }

        // Named ranges (deduplicate across sheets)
        try {
          const dns = ws.GetDefNames();
          if (dns) {
            for (const dn of dns) {
              try {
                const n = dn.GetName();
                if (!n || seenNamedRanges[n]) continue;
                seenNamedRanges[n] = true;
                const obj: Record<string, unknown> = {
                  type: "ApiName",
                  name: n,
                };
                try {
                  obj.refersTo = dn.GetRefersTo();
                } catch {
                  /* ignore */
                }
                (sheetData.namedRanges as unknown[]).push(obj);
              } catch {
                /* ignore */
              }
            }
          }
        } catch {
          /* ignore */
        }

        // Comments
        try {
          const usedRange = ws.GetUsedRange();
          if (usedRange) {
            // biome-ignore lint/suspicious/noExplicitAny: dynamic editor API
            usedRange.ForEach((cell: any) => {
              try {
                const c = cell.GetComment();
                if (!c) return;
                const obj: Record<string, unknown> = { type: "ApiComment" };
                try {
                  obj.addr = cell.GetAddress(false, false, "xlA1", false);
                } catch {
                  /* ignore */
                }
                try {
                  obj.id = c.GetId();
                } catch {
                  /* ignore */
                }
                try {
                  obj.text = c.GetText();
                } catch {
                  /* ignore */
                }
                try {
                  obj.author = c.GetAuthorName();
                } catch {
                  /* ignore */
                }
                try {
                  obj.solved = c.IsSolved();
                } catch {
                  /* ignore */
                }
                try {
                  obj.repliesCount = c.GetRepliesCount();
                } catch {
                  /* ignore */
                }
                (sheetData.comments as unknown[]).push(obj);
              } catch {
                /* ignore */
              }
            });
          }
        } catch {
          /* ignore */
        }

        sheetList.push(sheetData);
      }
      return out;
    });

    if (result && "error" in result && (result as { error?: string }).error) {
      throw new ToolError((result as { error: string }).error);
    }
    return result;
  },
});
