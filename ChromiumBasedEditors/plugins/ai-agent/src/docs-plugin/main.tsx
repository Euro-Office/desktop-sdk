import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

window.Asc.plugin.init = () => {
  const container = document.getElementById("root");
  if (!container) return;

  createRoot(container).render(
    <StrictMode>
      <div style={{ padding: "16px", fontFamily: "sans-serif" }}>
        <h1>Hello World</h1>
        <p>AI Agent docs plugin panel is working.</p>
      </div>
    </StrictMode>
  );
};
