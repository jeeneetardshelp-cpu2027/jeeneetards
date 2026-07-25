import { useState } from "react";
import { supabase } from "./supabaseClient";
import { useTheme } from "./theme.jsx";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";
import { BRAND_TEAL } from "./brandColors.js";

const ACCENT = { teal: BRAND_TEAL, red: "#dc2626" };

// Shared by student-owned actions such as ratings and reports. A successful
// auth change is observed by useSession in the parent, which replaces this
// form with the action the student originally opened.
function StudentAuthForm() {
  const { t } = useTheme();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const credentials = { email: email.trim(), password };
    const { data, error } = mode === "signup"
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials);
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
    } else if (mode === "signup" && !data.session) {
      setMessage({ ok: true, text: "Check your email to confirm, then sign in." });
    }
  };

  const input = `mt-1 min-h-11 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500`;
  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        aria-label="Email"
        autoComplete="username"
        required
        className={input}
      />
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        aria-label="Password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        required
        className={input}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: ACCENT.teal }}
        >
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode((current) => current === "signup" ? "signin" : "signup");
            setMessage(null);
          }}
          className={`min-h-11 rounded-lg px-1 text-xs ${t.muted} hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500`}
        >
          {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
        </button>
        {mode === "signin" && (
          <a
            href="/reset"
            className={`inline-flex min-h-11 items-center rounded-lg px-1 text-xs ${t.muted} hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500`}
          >
            Forgot password?
          </a>
        )}
      </div>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className="text-xs"
          style={{ color: message.ok ? ACCENT.teal : ACCENT.red }}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

// Public account creation is an explicit release decision. Keeping the guard
// here as well as at each contribution surface prevents an accidental mount
// from exposing sign-up in the browse-only release.
export default function StudentAuth({ enabled = RELEASE_FEATURES.studentAccounts }) {
  return enabled ? <StudentAuthForm /> : null;
}
