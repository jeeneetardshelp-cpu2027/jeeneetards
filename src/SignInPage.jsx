// SignInPage — the standalone /signin route.
//
// Audit finding (2026-08-10): there was no "Sign in" anywhere in the header,
// homepage or footer — only "Sign out", shown once a session already existed.
// The form itself (StudentAuth) was mounted only inside the rating and report
// panels, so the sole path to an account ran through a control buried below a
// 50-row lesson list. A student could not deliberately sign in to carry their
// watch progress from phone to laptop.
//
// This page gives Sign in / Create account a front door. It reuses the same
// StudentAuth form the contribution panels use, so there is one auth surface,
// and honours ?next= so the header link returns the student to where they were.
import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Container, GlobalHeader, MAIN_CONTENT_ID } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { useSession } from "./useSession.js";
import { isSupabaseConfigured } from "./supabaseClient.js";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";
import StudentAuth from "./StudentAuth.jsx";

// Only ever redirect to an in-app path. An open redirect that honoured an
// absolute URL in ?next= would let a crafted link bounce a just-signed-in
// student to another site, so anything not starting with a single "/" is
// dropped in favour of the homepage.
export function safeNext(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function SignInPage() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, loading } = useSession();
  const next = safeNext(params.get("next"));
  const accountsOn = RELEASE_FEATURES.studentAccounts && isSupabaseConfigured;

  // Once a session exists — either the student just signed in on this page, or
  // they arrived already signed in — there is nothing to do here. Leave for
  // where they were headed, replacing history so Back does not return to a
  // now-pointless sign-in screen.
  useEffect(() => {
    if (session?.user) navigate(next, { replace: true });
  }, [session, next, navigate]);

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={[{ label: "Sign in" }]} width="reading" />
      <main id={MAIN_CONTENT_ID} className="py-10">
        <Container width="reading">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold">Sign in</h1>

            {!accountsOn ? (
              <p role="status" className={`mt-4 text-sm ${t.muted}`}>
                Accounts are not available in this release. You can still browse,
                search, compare and watch without one — your progress is saved on
                this device.
              </p>
            ) : loading || session?.user ? (
              // Brief: the effect above is redirecting.
              <p role="status" className={`mt-4 text-sm ${t.muted}`}>
                Taking you back…
              </p>
            ) : (
              <>
                <p className={`mt-3 text-sm ${t.muted}`}>
                  An account is optional. It does two things: it carries your
                  watch progress across your phone and laptop, and it lets you
                  rate a course. Browsing never needs one.
                </p>
                <StudentAuth enabled />
                <p className={`mt-6 text-xs ${t.muted}`}>
                  Prefer to keep going without an account?{" "}
                  <Link to={next} className="underline hover:no-underline">
                    Back to browsing
                  </Link>
                </p>
              </>
            )}
          </div>
        </Container>
      </main>
    </div>
  );
}
