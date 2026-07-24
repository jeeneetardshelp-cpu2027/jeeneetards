import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, RefreshCw, Users, X } from "lucide-react";
import TeacherPicker from "./TeacherPicker.jsx";
import { useTheme } from "./theme.jsx";
import { runFacultyReviewAction, useFacultyReview } from "./useFacultyReview.js";

function variantsText(variants = []) {
  return variants.map((v) => `${v.raw_teacher} (${v.occurrences})`).join(" · ");
}

export default function FacultyReviewPanel() {
  const { t } = useTheme();
  const { groups, loading, error, unavailable, reload } = useFacultyReview();
  const [active, setActive] = useState(null);
  const [selected, setSelected] = useState([]);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const act = async (fn, args, success) => {
    setBusy(true); setMessage(null);
    try {
      await runFacultyReviewAction(fn, args);
      setMessage({ ok: true, text: success });
      setActive(null); setSelected([]); setDisplayName("");
      await reload();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const scan = () => act(
    "scan_free_text_teachers", {},
    "Legacy teacher names were scanned into proposals. No identity was created automatically.",
  );

  if (unavailable) {
    return (
      <div className={`rounded-xl border border-dashed ${t.border} p-6`}>
        <p className={`font-medium ${t.text}`}>Faculty review is not installed yet.</p>
        <p className={`mt-1 text-sm ${t.muted}`}>Apply it only after the disposable-staging release gate passes.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-base font-semibold ${t.text}`}>Faculty identity review</h2>
          <p className={`mt-1 max-w-2xl text-sm ${t.muted}`}>
            Resolve legacy names into reviewed people. Matching text suggests candidates; only your explicit decision creates links.
          </p>
        </div>
        <button
          type="button" onClick={scan} disabled={busy}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium ${t.border} ${t.text} ${t.hover}`}
        >
          <RefreshCw className="h-4 w-4" /> Scan legacy names
        </button>
      </div>

      {message && (
        <p className={`mt-4 rounded-xl border p-3 text-sm ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {message.text}
        </p>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mr-2 inline h-4 w-4" />{error}
          <button type="button" onClick={reload} className="ml-3 min-h-11 font-medium underline">Try again</button>
        </div>
      )}
      {loading ? (
        <div className="mt-5 space-y-3" aria-busy="true">
          {[1, 2, 3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : !error && groups.length === 0 ? (
        <div className={`mt-5 rounded-xl border border-dashed ${t.border} p-8 text-center`}>
          <Check className="mx-auto h-5 w-5 text-emerald-600" />
          <p className={`mt-2 text-sm font-medium ${t.text}`}>No pending faculty proposals.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {groups.map((group) => {
            const open = active === group.normalized;
            const candidates = group.candidates ?? [];
            const requiresSplit = ["multi-person", "organization-or-team"].includes(group.kind);
            return (
              <article key={group.normalized} className={`rounded-xl border ${t.border} ${t.card}`}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(open ? null : group.normalized);
                    setSelected([]);
                    setDisplayName(group.variants?.[0]?.raw_teacher ?? "");
                  }}
                  aria-expanded={open}
                  className="flex min-h-14 w-full items-center justify-between gap-4 px-4 text-left"
                >
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium ${t.text}`}>{variantsText(group.variants)}</span>
                    <span className={`block text-xs ${t.faint}`}>
                      {group.kind} · {group.total_occurrences} playlist occurrence{Number(group.total_occurrences) === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                  <div className={`border-t ${t.divider} p-4`}>
                    {requiresSplit && (
                      <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                        This value is not one proven person. Select at least two existing faculty records, or reject it as a team/department.
                      </p>
                    )}

                    {!requiresSplit && candidates.length > 0 && (
                      <div className="mb-4">
                        <p className={`mb-2 text-xs font-medium ${t.muted}`}>Possible existing faculty</p>
                        <div className="space-y-2">
                          {candidates.map((candidate) => (
                            <button
                              key={candidate.teacher_id}
                              type="button" disabled={busy}
                              onClick={() => act(
                                "approve_group_as_existing",
                                { p_normalized: group.normalized, p_teacher_id: candidate.teacher_id, p_add_alias: true },
                                `Linked every variant to ${candidate.display_name}.`,
                              )}
                              className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left ${t.border} ${t.hover}`}
                            >
                              <span>
                                <span className={`block text-sm font-medium ${t.text}`}>{candidate.display_name}</span>
                                <span className={`block text-xs ${t.faint}`}>
                                  {[candidate.institutes, candidate.subjects].filter(Boolean).join(" · ") || "No context recorded"}
                                </span>
                              </span>
                              <span className={`text-xs ${t.faint}`}>{candidate.course_count ?? 0} courses</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {requiresSplit ? (
                      <>
                        <TeacherPicker value={selected} onChange={setSelected} label="People named in this value" />
                        <button
                          type="button" disabled={busy || selected.length < 2}
                          onClick={() => act(
                            "split_faculty_review_group",
                            { p_normalized: group.normalized, p_teacher_ids: selected.map((s) => s.teacher_id), p_override_kind: false },
                            "Linked the selected faculty without merging their identities.",
                          )}
                          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40"
                        >
                          <Users className="h-4 w-4" /> Split into selected faculty
                        </button>
                      </>
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-3">
                        <label className="text-xs font-medium text-slate-600" htmlFor={`new-faculty-${group.normalized}`}>Create as a new person</label>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input
                            id={`new-faculty-${group.normalized}`}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          />
                          <button
                            type="button" disabled={busy || !displayName.trim()}
                            onClick={() => act(
                              "approve_faculty_review_group_as_new",
                              { p_normalized: group.normalized, p_display_name: displayName.trim(), p_verified: false },
                              `Created ${displayName.trim()} as a separate, unverified faculty record.`,
                            )}
                            className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40"
                          >
                            Create separately
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button" disabled={busy}
                        onClick={() => act(
                          "defer_faculty_review_group", { p_normalized: group.normalized, p_note: "Deferred in admin review" },
                          "Deferred this proposal group.",
                        )}
                        className={`min-h-11 rounded-xl border px-4 text-sm ${t.border} ${t.text}`}
                      >
                        Decide later
                      </button>
                      <button
                        type="button" disabled={busy}
                        onClick={() => act(
                          "reject_faculty_review_group", { p_normalized: group.normalized, p_note: "Rejected in admin review" },
                          "Rejected this value as a faculty identity.",
                        )}
                        className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-rose-200 px-4 text-sm text-rose-700"
                      >
                        <X className="h-4 w-4" /> Reject identity
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
