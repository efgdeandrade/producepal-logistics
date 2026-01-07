import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handlers for pre-React errors
window.addEventListener("error", (event) => {
  console.error("[Global Error]", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
