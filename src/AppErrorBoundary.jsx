import { Component } from "react";
import { useTheme } from "./theme.jsx";

function ErrorFallback() {
  const { t } = useTheme();
  return (
    <main className={`flex min-h-screen items-center justify-center ${t.page} p-6`}>
      <div role="alert" className={`w-full max-w-lg rounded-2xl border ${t.card} ${t.border} p-6`}>
        <h1 className={`text-xl font-semibold ${t.text}`}>This page could not be displayed</h1>
        <p className={`mt-2 text-sm leading-relaxed ${t.muted}`}>
          Your saved progress is still on this device. Reload the page, or return to the course catalogue.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Reload page
          </button>
          <a
            href="/browse"
            className={`inline-flex min-h-11 items-center rounded-lg border ${t.border} px-4 py-2 text-sm font-semibold ${t.text}`}
          >
            Browse courses
          </a>
        </div>
      </div>
    </main>
  );
}

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Keep a local diagnostic until privacy-approved monitoring is selected.
    console.error("Uncaught application render error", error, info);
  }

  render() {
    return this.state.failed ? <ErrorFallback /> : this.props.children;
  }
}
