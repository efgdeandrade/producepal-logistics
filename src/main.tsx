import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[BOOT] main.tsx loaded");

// Show errors visually on the page
function showErrorBanner(message: string) {
  const existing = document.getElementById("error-banner");
  if (existing) existing.remove();
  
  const banner = document.createElement("div");
  banner.id = "error-banner";
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #dc2626; color: white; padding: 16px; font-family: monospace;
    font-size: 14px; white-space: pre-wrap; max-height: 50vh; overflow: auto;
  `;
  banner.textContent = message;
  document.body.prepend(banner);
}

// Global error handlers
window.addEventListener("error", (event) => {
  const msg = `[Global Error] ${event.error?.stack || event.message}`;
  console.error(msg);
  showErrorBanner(msg);
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = `[Unhandled Promise Rejection] ${event.reason?.stack || event.reason}`;
  console.error(msg);
  showErrorBanner(msg);
});

try {
  console.log("[BOOT] Mounting React app...");
  createRoot(document.getElementById("root")!).render(<App />);
  console.log("[BOOT] React app mounted successfully");
} catch (err) {
  const msg = `[BOOT CRASH] ${err instanceof Error ? err.stack : err}`;
  console.error(msg);
  showErrorBanner(msg);
}
