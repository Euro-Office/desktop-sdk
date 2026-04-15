import { createRoot } from "react-dom/client";

const isPanel =
  new URLSearchParams(window.location.search).get("page") === "panel";

window.Asc.plugin.init = () => {
  if (isPanel) {
    const container = document.getElementById("root");
    if (!container) return;

    createRoot(container).render(
      <div style={{ padding: "16px", fontFamily: "sans-serif" }}>
        <h1>Hello World</h1>
        <p>AI Agent docs plugin panel is working.</p>
      </div>
    );
  } else {
    const tab = new window.Asc.ButtonToolbar();
    tab.text = "AI Actions";

    const btnSettings = new window.Asc.ButtonToolbar(tab);
    btnSettings.text = "AI Settings";
    btnSettings.icons =
      "resources/%theme-type%(light|dark)/big/settings%scale%(default).png";
    btnSettings.attachOnClick(() => {
      // TODO: open settings window
    });

    window.Asc.Buttons.registerToolbarMenu();

    window.Asc.plugin.executeMethod("AddToolbarMenuItem", [
      {
        guid: "asc.{8D67F3C0-7654-4BBC-98A2-71342BD73A4E}",
        tabs: [
          {
            id: "home",
            items: [
              {
                id: "ai-open-chat",
                type: "big-button",
                text: "AI Chat",
                icons:
                  "resources/%theme-type%(light|dark)/general-ai%scale%(default).png",
                separator: true,
              },
            ],
          },
        ],
      },
    ]);

    window.Asc.plugin.attachToolbarMenuClickEvent("ai-open-chat", () => {
      // TODO: open chat panel
    });
  }
};
