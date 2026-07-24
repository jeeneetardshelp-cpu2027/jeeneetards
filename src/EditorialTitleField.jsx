import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Input, Labeled } from "./adminUI.jsx";
import { suggestEditorialTitle, titleQualityIssues } from "./titleQuality.js";
import { useTheme } from "./theme.jsx";

export default function EditorialTitleField({
  sourceTitle = "", value, onChange, reviewed, onReviewedChange,
  label = "Display title",
}) {
  const { t } = useTheme();
  const suggestion = suggestEditorialTitle(sourceTitle || value);
  const issues = titleQualityIssues(value);
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const blocking = issues.some((issue) => issue.severity === "blocking");

  return (
    <div className="space-y-3">
      {sourceTitle && (
        <div className={`rounded-lg border ${t.border} p-3`}>
          <p className={`text-xs font-medium ${t.faint}`}>Original YouTube title — editorial reference</p>
          <p className={`mt-1 text-sm ${t.muted}`}>{sourceTitle}</p>
        </div>
      )}

      <Labeled label={label} hint="A concise student-facing name. Exam, class, subject and faculty belong in structured filters.">
        <Input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onReviewedChange(false);
          }}
          placeholder="Complete Kinematics"
          required
        />
      </Labeled>

      {suggestion && suggestion !== value && (
        <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border ${t.border} p-3`}>
          <span className={`min-w-0 text-sm ${t.muted}`}>Suggestion: <strong className={t.text}>{suggestion}</strong></span>
          <button
            type="button"
            onClick={() => { onChange(suggestion); onReviewedChange(false); }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${t.border} ${t.hover}`}
          >
            <Sparkles className="h-4 w-4" /> Use suggestion
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {warnings.map((issue) => <li key={issue.code}><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{issue.message}</li>)}
        </ul>
      )}

      <label className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm ${blocking ? "border-rose-200 bg-rose-50 text-rose-800" : `${t.border} ${t.text}`}`}>
        <input
          type="checkbox"
          checked={reviewed}
          disabled={blocking}
          onChange={(event) => onReviewedChange(event.target.checked)}
          className="h-4 w-4"
        />
        {blocking ? issues.find((issue) => issue.severity === "blocking")?.message : (
          <span><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />I reviewed this student-facing title</span>
        )}
      </label>
    </div>
  );
}
