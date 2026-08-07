import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../theme.jsx";
import ForumMathContent from "./ForumMathContent.jsx";
import "../index.css";

const MALICIOUS = '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">';
const LONG_FORMULA = `$$\\underbrace{${"a+".repeat(90)}a}_{\\text{intentionally long formula}}$$`;

window.__forumRendererSecurity = { alerts: [], ready: false };
window.alert = (message) => window.__forumRendererSecurity.alerts.push(String(message));

function Fixture() {
  useEffect(() => {
    window.__forumRendererSecurity.ready = true;
    document.documentElement.dataset.forumRendererReady = "true";
  }, []);

  return (
    <ThemeProvider>
      <main className="min-h-screen min-w-0 bg-canvas p-4 text-ink">
        <section id="malicious-content" className="mx-auto max-w-xl">
          <ForumMathContent>{MALICIOUS}</ForumMathContent>
        </section>
        <section id="long-formula" className="mx-auto mt-8 min-w-0 max-w-xl border border-hairline p-3">
          <ForumMathContent>{LONG_FORMULA}</ForumMathContent>
        </section>
      </main>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
