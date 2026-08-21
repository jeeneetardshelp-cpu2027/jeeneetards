import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App.jsx";
import { initErrorReporter } from "./lib/errorReporter.js";

// Installs window.onerror / unhandledrejection handlers, but ONLY when
// VITE_SENTRY_DSN is set. With no DSN this is a no-op that sends nothing, so a
// build without the env var behaves exactly as before.
initErrorReporter();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
