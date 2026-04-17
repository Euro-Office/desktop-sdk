let chatWindow: AscPluginWindow | null = null;
let settingsWindow: AscPluginWindow | null = null;

function onSettignsClick() {
  if (!settingsWindow) {
    settingsWindow = new window.Asc.PluginWindow();
    settingsWindow.show({
      url: "settings.html",
      description: "AI Settings",
      type: "window",
      EditorsSupport: ["word", "slide", "cell", "pdf"],
      isVisual: true,
      icons:
        "resources/%theme-type%(light|dark)/big/settings%scale%(default).png",
      size: [470, 510],
    });
  } else {
    settingsWindow.activate();
  }
}

window.Asc.plugin.init = () => {
  // Register AI Chat button in the Home tab and Settings button in the plugin tab
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
        {
          id: "ai-actions",
          text: "AI Actions",
          items: [
            {
              id: "ai-settings",
              type: "big-button",
              text: "AI Settings",
              icons:
                "resources/%theme-type%(light|dark)/big/settings%scale%(default).png",
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
        chatWindow.show({
          url: "chat.html",
          description: "AI Chat",
          type: "panelRight",
          EditorsSupport: ["word", "slide", "cell", "pdf"],
          isVisual: true,
          icons:
            "resources/%theme-type%(light|dark)/general-ai%scale%(default).png",
        });
      } else {
        chatWindow.activate();
      }
    } else if (id === "ai-settings") {
      onSettignsClick();
    }
  };

  window.Asc.Buttons.registerToolbarMenu();

  window.Asc.plugin.button = (_buttonId, windowId) => {
    if (_buttonId === -1) {
      window.Asc.plugin.executeMethod("CloseWindow", [windowId]);

      if (chatWindow && chatWindow.id === windowId) {
        chatWindow = null;
      } else if (settingsWindow && settingsWindow.id === windowId) {
        settingsWindow = null;
      }
    }
  };
};
