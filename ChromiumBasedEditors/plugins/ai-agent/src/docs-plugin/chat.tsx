import { createRoot } from "react-dom/client";

const container = document.getElementById("chat_panel");

if (container) {
  createRoot(container).render(
    <div style={{ padding: "16px", fontFamily: "sans-serif" }}>
      <h1>AI Chat</h1>
    </div>
  );
}
