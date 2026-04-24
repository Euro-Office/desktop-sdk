import { editor } from "../../library/editor";
import { defineTool } from "../lib/defineTool";

export const addNewSlide = defineTool({
  name: "addNewSlide",
  description:
    "Adds a new slide at the end of presentation using default layout from current slide's master",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async () => {
    await editor.callCommand(() => {
      const presentation = Api.GetPresentation();
      let currentSlide = presentation.GetCurrentSlide();
      let master = null;
      if (currentSlide) {
        currentSlide = presentation.GetSlideByIndex(0);
        const curLayout = currentSlide.GetLayout();
        master = curLayout.GetMaster();
      } else {
        master = presentation.GetMasterByIndex(0);
      }
      if (!master) return;

      let layout = master.GetLayoutByType("obj");
      if (!layout) {
        const layoutsCount = master.GetLayoutsCount();
        if (layoutsCount > 0) layout = master.GetLayout(0);
      }
      if (!layout) return;

      const newSlide = Api.CreateSlide();
      newSlide.ApplyLayout(layout);
      presentation.AddSlide(newSlide);
    });

    return { isApply: true };
  },
});
