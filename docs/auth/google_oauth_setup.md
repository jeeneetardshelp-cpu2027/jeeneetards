# Enable "Continue with Google" (Supabase + Google Cloud)

Why: production has ~2 accounts and 0 ratings because the only way to sign up is
email + password + an email-confirmation step. Google one-tap removes that wall,
which is the real unlock behind the ratings cold-start (the end-of-lesson rating
prompt already ships — `src/RatingPrompt.jsx` — it just hits a sign-in wall for
signed-out students today).

These are dashboard/console steps only YOU can do (they involve secrets and
provider config outside this codebase). The one code change — a "Continue with
Google" button — is described in Part C; Claude can implement that on request.

Project facts (already confirmed from this repo):
- Supabase project ref: `kezelafqhgqrprpadmlf`
- **Supabase OAuth callback URL** (Google needs this, exactly):
  `https://kezelafqhgqrprpadmlf.supabase.co/auth/v1/callback`
- Production site URL: `https://www.jeeneetard.com`
- Client config (`src/supabaseClient.js`) uses the default `createClient`, so
  `detectSessionInUrl` is on — the app picks up the session automatically when
  Google redirects back. **No new /auth/callback route is needed.**

---

## Part A — Google Cloud Console (create the OAuth client)

Do this at https://console.cloud.google.com while signed in with the Google
account that should own the app registration.

1. **Pick/create a project** (top bar project picker). A dedicated project like
   "JEENEETARD Auth" keeps it tidy.

2. **Configure the OAuth consent screen** (APIs & Services → OAuth consent
   screen):
   - User type: **External**.
   - App name: `JEENEETARD` · User support email: your address.
   - App domain (optional but good): Home page `https://www.jeeneetard.com`,
     plus your Privacy Policy `https://www.jeeneetard.com/privacy` and Terms
     `https://www.jeeneetard.com/terms`.
   - **Authorized domains:** add `jeeneetard.com` and `supabase.co`.
   - Scopes: the defaults `openid`, `.../auth/userinfo.email`,
     `.../auth/userinfo.profile` are all you need. Do **not** add sensitive
     scopes.
   - Save. If the app is left in **Testing**, only accounts you add under "Test
     users" can sign in — so **Publish to Production** (same screen → "Publish
     app") before real students use it. With only these basic scopes, Google
     does **not** require its full verification review.

3. **Create the OAuth client** (APIs & Services → Credentials → Create
   credentials → **OAuth client ID**):
   - Application type: **Web application**.
   - Name: e.g. `JEENEETARD web`.
   - **Authorized JavaScript origins** (the site that starts the sign-in):
     - `https://www.jeeneetard.com`
     - `http://localhost:5173`  (local dev — optional, add if you test locally)
   - **Authorized redirect URIs** — this is the part people get wrong. It is
     the **Supabase** callback, NOT your app URL:
     - `https://kezelafqhgqrprpadmlf.supabase.co/auth/v1/callback`
   - Create, then copy the **Client ID** and **Client secret** (you'll paste
     both into Supabase next). Treat the secret like a password.

---

## Part B — Supabase Dashboard

At https://supabase.com/dashboard → your project (`kezelafqhgqrprpadmlf`):

1. **Authentication → Sign In / Providers → Google:**
   - Toggle **Enable Sign in with Google** on.
   - Paste the **Client ID** and **Client Secret** from Part A. (This screen
     also shows the exact Callback URL — confirm it matches the redirect URI you
     put in Google.)
   - Save.

2. **Authentication → URL Configuration:**
   - **Site URL:** `https://www.jeeneetard.com`
   - **Redirect URLs** (allow-list — the app can only send users back to URLs
     that match one of these). Add:
     - `https://www.jeeneetard.com/**`
     - `http://localhost:5173/**`  (only if you test OAuth locally)
     - If you use Vercel preview deployments and want OAuth to work there too:
       `https://*.vercel.app/**` (optional; skip if you don't need preview
       sign-in).

3. **(Related, separate decision) Drop the email-confirmation wall** for the
   existing email/password path — **Authentication → Sign In / Providers →
   Email → turn "Confirm email" OFF.**
   - Effect: an email/password sign-up creates a usable session immediately
     instead of the "check your email to confirm, then sign in" step
     (`StudentAuth.jsx:31-32`), which is a big part of why so few accounts exist.
   - Tradeoff: you can no longer prove the email is real, and disposable-email
     signups get through. For an account whose only power is posting a rating,
     that is a reasonable trade — but it is YOUR call, and it is independent of
     the Google work above. Google sign-in is unaffected by this toggle (Google
     already verifies the email).

---

## Part C — The one code change (Claude can do this)

OAuth is not usable until the app offers a button that starts it. It's a small,
self-contained change to `src/StudentAuth.jsx` (the inline sign-in used by the
rating prompt and the ratings panel) and, for parity, `src/SignInPage.jsx`:

```jsx
// "Continue with Google" — returns the student to the page they were on.
const signInWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + window.location.pathname + window.location.search,
    },
  });
};
```

Rendered as a button above the email/password form ("or continue with email").
The `redirectTo` above returns them to the exact page (e.g. the lesson they were
about to rate); it must match one of the Redirect URLs allow-listed in Part B —
`https://www.jeeneetard.com/**` covers every app page.

No other code changes are needed:
- **No callback route** — the default Supabase client detects the session in the
  returned URL (`src/supabaseClient.js`), and `useSession` picks it up, so the
  rating prompt swaps straight to the one-tap stars.
- **No CSP change** — the Google sign-in is a full-page navigation, not a
  `fetch`/iframe, so `connect-src`/`frame-src` don't apply; the token exchange
  goes to `*.supabase.co`, which the CSP already allows (`vercel.json`).

Privacy note: Google sign-in gives the app the student's email + basic profile —
the same email category the current email/password flow already collects, so no
new data type is disclosed. Still worth a one-line mention in the Privacy Policy
that Google may be used to sign in.

---

## Part D — Test it

After Parts A, B, and C are live (C requires a `main → release` deploy):

1. Open `https://www.jeeneetard.com/signin` (or finish a lesson to get the
   rating prompt) in a private window.
2. Click **Continue with Google** → Google account chooser → consent → you land
   back on the same page, now signed in.
3. Rate a course; confirm a row appears in `playlist_ratings`
   (Supabase → Table editor), and that the end-of-lesson prompt now shows the
   one-tap stars for the signed-in session.
4. Sign out (header) and confirm the device-local progress/notes clear
   (`AppShell.jsx` calls `clearProgress()` + `clearNotes()`).

If Google returns `redirect_uri_mismatch`: the Authorized redirect URI in Google
(Part A.3) doesn't exactly equal the Supabase callback
`https://kezelafqhgqrprpadmlf.supabase.co/auth/v1/callback` — fix the Google
entry. If it returns to the app but you're not signed in: the return URL isn't
in Supabase's Redirect URLs allow-list (Part B.2).
