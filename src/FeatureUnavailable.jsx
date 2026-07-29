import { Link } from "react-router";
import { Page } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";

export default function FeatureUnavailable({ title, detail }) {
  const { t } = useTheme();

  return (
    <Page crumbs={[{ label: title }]} width="reading">
      <div className={`rounded-2xl border border-dashed ${t.border} ${t.card} p-8 text-center`}>
        <h1 className={`text-xl font-semibold ${t.text}`}>{title}</h1>
        <p className={`mx-auto mt-2 max-w-xl text-sm ${t.muted}`}>{detail}</p>
        <Link
          to="/browse"
          className={`mt-5 min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover} inline-flex items-center justify-center`}
        >
          Browse available courses
        </Link>
      </div>
    </Page>
  );
}
