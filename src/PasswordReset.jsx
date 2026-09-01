import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Container, GlobalHeader, MAIN_CONTENT_ID } from "./AppShell.jsx";
import { BRAND_TEAL } from "./brandColors.js";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import { useTheme } from "./theme.jsx";
import { useSession } from "./useSession.js";

const MIN_PASSWORD_LENGTH = 8;

function recoveryLinkPresent(location) {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  return Boolean(
    query.get("code") ||
    query.get("token_hash") ||
    hash.get("access_token") ||
    hash.get("type") === "recovery",
  );
}

export default function PasswordReset() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const canChoosePassword = Boolean(session?.user) || recoveryLinkPresent(location);

  const requestReset = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    });
    setBusy(false);
    setMessage(error
      ? { ok: false, text: error.message }
      : {
          ok: true,
          text: "If an account exists for that address, a password-reset email has been sent.",
        });
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage({
        ok: false,
        text: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
      return;
    }
    if (password !== confirmation) {
      setMessage({ ok: false, text: "The passwords do not match." });
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setMessage({ ok: false, text: error.message });
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    setBusy(false);
    setPassword("");
    setConfirmation("");
    setMessage(signOutError
      ? {
          ok: false,
          text: "Password updated, but automatic sign-out failed. Please use Sign out before leaving this device.",
        }
      : {
          ok: true,
          text: "Password updated. You have been signed out and can now sign in with the new password.",
        });
  };

  const input = `mt-1 min-h-11 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500`;

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={[{ label: "Password reset" }]} width="reading" />
      <main id={MAIN_CONTENT_ID} className="py-10">
        <Container width="reading">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          {!isSupabaseConfigured ? (
            <p role="alert" className={`mt-4 text-sm ${t.muted}`}>
              Account recovery is unavailable because authentication is not configured.
            </p>
          ) : loading ? (
            <p role="status" className={`mt-4 text-sm ${t.muted}`}>
              Checking the recovery link...
            </p>
          ) : canChoosePassword ? (
            <form onSubmit={updatePassword} className="mt-6 max-w-md space-y-4">
              <label className="block text-sm font-medium">
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                Confirm new password
                <input
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  className={input}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: BRAND_TEAL }}
              >
                {busy ? "Updating..." : "Update password"}
              </button>
            </form>
          ) : (
            <form onSubmit={requestReset} className="mt-6 max-w-md space-y-4">
              <p className={`text-sm ${t.muted}`}>
                Enter the email address used for the account. The reset link will
                return to this page.
              </p>
              <label className="block text-sm font-medium">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className={input}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: BRAND_TEAL }}
                >
                  {busy ? "Sending..." : "Send reset link"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className={`min-h-11 rounded-lg px-3 py-2 text-sm ${t.muted} ${t.hover}`}
                >
                  Back
                </button>
              </div>
            </form>
          )}
          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className="mt-4 max-w-md text-sm"
              style={{ color: message.ok ? BRAND_TEAL : "#dc2626" }}
            >
              {message.text}
            </p>
          )}
        </Container>
      </main>
    </div>
  );
}
