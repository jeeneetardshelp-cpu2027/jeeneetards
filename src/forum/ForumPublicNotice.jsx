import { Globe2 } from "lucide-react";
import { Link } from "react-router";
import { Note } from "../ui.jsx";

export default function ForumPublicNotice({ compact = false }) {
  return (
    <Note icon={Globe2} className={compact ? "text-xs" : ""}>
      <strong>Public forum:</strong> posts and answers can be read by anyone and may be indexed by
      search engines. Stay respectful, explain your reasoning, and never share names, contact details,
      school or coaching batches, account credentials, or other personal information. See the{" "}
      <Link to="/privacy" className="inline-flex min-h-11 items-center font-semibold underline">Privacy Policy</Link>.
    </Note>
  );
}
