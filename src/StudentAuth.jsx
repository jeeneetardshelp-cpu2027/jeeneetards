import { useState } from "react";
import { supabase } from "./supabaseClient";
import { useTheme } from "./theme.jsx";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";
import { BRAND_TEAL } from "./brandColors.js";

const ACCENT = { teal: BRAND_TEAL, red: "#dc2626" };

// The official multi-colour Google "G". Decorative — the button text carries
// the accessible name.
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

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

  // On success this navigates the whole page to Google, so control only returns
  // here on a failure to even start the flow (e.g. the provider isn't enabled
  // yet). redirectTo brings the student back to the exact page they were on —
  // the lesson they were about to rate — which /signin then forwards via ?next.
  const signInWithGoogle = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname + window.location.search,
      },
    });
    if (error) {
      setBusy(false);
      setMessage({ ok: false, text: "Google sign-in isn't available right now — please use email." });
    }
  };

  const input = `mt-1 min-h-11 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500`;
  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      {RELEASE_FEATURES.googleAuth && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className={`flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg border ${t.border} ${t.text} text-sm font-semibold transition hover:opacity-90 disabled:opacity-50`}
          >
            <GoogleG /> Continue with Google
          </button>
          <div className={`flex items-center gap-3 text-xs ${t.faint}`}>
            <span className="h-px flex-1 bg-current opacity-20" aria-hidden="true" />
            or continue with email
            <span className="h-px flex-1 bg-current opacity-20" aria-hidden="true" />
          </div>
        </div>
      )}
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
