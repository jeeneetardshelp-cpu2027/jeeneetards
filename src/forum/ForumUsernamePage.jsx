import { CheckCircle2, RefreshCw } from "lucide-react";
import { Page } from "../AppShell.jsx";
import { useSession } from "../useSession.js";
import { Button, IconTile, SectionHead, Surface } from "../ui.jsx";
import { forumApi } from "./forumApi.js";
import ForumSignInPanel from "./ForumSignInPanel.jsx";
import ForumUsernameClaim from "./ForumUsernameClaim.jsx";
import { useForumIdentity } from "./useForumIdentity.js";

export default function ForumUsernamePage({ api = forumApi, authState = null }) {
  const liveAuth = useSession();
  const { session, loading: authLoading } = authState ?? liveAuth;
  const userId = session?.user?.id ?? null;
  const identity = useForumIdentity(userId, api);

  return (
    <Page crumbs={[{ label: "Forum username" }]} width="reading">
      <SectionHead
        as="h1"
        eyebrow="Student forum"
        title="Choose your public username"
        lead="Set up the pseudonym that will appear beside your forum posts and answers. Your email and real name are not shown."
      />

      <div className="mt-8">
        {authLoading ? (
          <p role="status" className="text-sm text-ink-2">Checking sign-in…</p>
        ) : !userId ? (
          <ForumSignInPanel
            action="choose your forum username"
            detail="Sign in or create an account here. After sign-in, this page will show the username form automatically."
          />
        ) : identity.status === "loading" ? (
          <p role="status" className="text-sm text-ink-2">Checking your forum username…</p>
        ) : identity.status === "needs_username" ? (
          <ForumUsernameClaim api={api} onClaimed={identity.claimed} />
        ) : identity.status === "error" ? (
          <Surface as="section" className="flex flex-col items-start gap-5 sm:flex-row">
            <IconTile icon={RefreshCw} tint="var(--accent)" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink">Could not check your forum username</h2>
              <p role="alert" className="mt-2 text-sm leading-relaxed text-ink-2">
                {identity.error || "The forum identity service did not respond."}
              </p>
              <Button type="button" variant="secondary" size="sm" className="mt-5" onClick={identity.retry}>
                Try again
              </Button>
            </div>
          </Surface>
        ) : (
          <Surface as="section" className="flex flex-col items-start gap-5 sm:flex-row">
            <IconTile icon={CheckCircle2} tint="var(--accent)" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink">Your forum username is ready</h2>
              <p className="mt-2 break-words text-base font-semibold text-accent">@{identity.username}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                This public username cannot be changed. The student forum remains closed until its separately reviewed release is activated.
              </p>
              <Button to="/browse" variant="secondary" size="sm" className="mt-5">
                Browse courses
              </Button>
            </div>
          </Surface>
        )}
      </div>
    </Page>
  );
}
