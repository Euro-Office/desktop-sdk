const CHAT_PANEL_VARIATION: AscPluginWindowVariation = {
  url: "chat.html",
  description: "AI Chat",
  type: "panelRight",
  EditorsSupport: ["word", "slide", "cell", "pdf"],
  isModal: false,
  isVisual: true,
  icons: "resources/%theme-type%(light|dark)/general-ai%scale%(default).png",
};

let chatWindow: AscPluginWindow | null = null;

function onSettignsClick() {
  console.log("Settings clicked");
}

window.Asc.plugin.init = () => {
  // Register toolbar menu group
  const tab = new window.Asc.ButtonToolbar();
  tab.text = "AI Actions";

  const btnSettings = new window.Asc.ButtonToolbar(tab);
  btnSettings.text = "AI Settings";
  btnSettings.icons =
    "resources/%theme-type%(light|dark)/big/settings%scale%(default).png";
  btnSettings.attachOnClick(onSettignsClick);

  // Register AI Chat button in the Home tab toolbar
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

  window.Asc.plugin.event_onToolbarMenuClick = (id) => {
    if (id === "ai-open-chat") {
      console.log({ chatWindow });
      if (!chatWindow) {
        chatWindow = new window.Asc.PluginWindow();
        chatWindow.show(CHAT_PANEL_VARIATION);
      } else {
        chatWindow.activate();
      }
    }
  };

  window.Asc.Buttons.registerToolbarMenu();
};
