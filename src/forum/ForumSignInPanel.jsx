import { LogIn } from "lucide-react";
import { useId } from "react";
import StudentAuth from "../StudentAuth.jsx";
import { IconTile, Surface } from "../ui.jsx";

export default function ForumSignInPanel({
  action = "publish this contribution",
  detail = "Your draft stays on this device while you sign in or create an account.",
}) {
  const titleId = useId();
  return (
    <Surface as="section" className="flex flex-col gap-5 sm:flex-row" aria-labelledby={titleId}>
      <IconTile icon={LogIn} tint="var(--accent)" />
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-lg font-semibold text-ink">Sign in to {action}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{detail}</p>
        <StudentAuth />
      </div>
    </Surface>
  );
}
