// PollSubmitPage.jsx — /polls/new
//
// A student writes the poll; an admin decides whether it goes live. The page
// says so before the first field, not after the submit button, because the
// worst version of this screen is one that feels like publishing and then
// silently isn't.
//
// The picture field accepts a link, not an upload. There is no storage bucket
// in this product and adding one so that 14-18 year olds can put arbitrary
// images on a public page is a much bigger decision than a poll feature.
// polls_v1.sql restricts student links to an approved host list; this page
// states that rule up front rather than letting the server reject it later.

import { ImagePlus, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Page } from "../AppShell.jsx";
import { useSession } from "../useSession.js";
import { Button, Note, Pill, SectionHead, Surface } from "../ui.jsx";
import { pollApi } from "./pollApi.js";
import { pollActionError } from "./pollErrorMessages.js";
import { PollsLoadError, PollsLoading, PollsUnavailable } from "./PollStates.jsx";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const MAX_QUESTION = 160;
const MAX_DETAIL = 600;
const MAX_LABEL = 80;

const APPROVED_HOSTS = ["i.ytimg.com", "img.youtube.com", "yt3.ggpht.com", "upload.wikimedia.org"];

const emptyOption = () => ({ label: "", image_url: "" });

/**
 * Mirrors poll_image_host_allowed() in polls_v1.sql EXACTLY, so the student is
 * told before submitting instead of getting a raw server rejection. The server
 * host rule is the regex `^https://([a-z0-9.-]+)(?:/|$)` — case-sensitive,
 * lowercase host only, and it stops at `/` so a port or userinfo ("@") never
 * counts as part of the host. Using new URL().hostname here would diverge:
 * it lowercases "HTTPS://I.YTIMG.COM" and strips the userinfo from
 * "i.ytimg.com:80@evil.com", accepting URLs the server then rejects.
 */
export function imageLinkProblem(url) {
  const value = String(url ?? "").trim();
  if (!value) return null;
  if (!/^https:\/\//.test(value)) return "Picture links must start with https://";
  const match = value.match(/^https:\/\/([a-z0-9.-]+)(?:\/|$)/);
  if (!match) {
    return "That link has an unusual host. Use a plain lowercase https:// link with no “@” or port.";
  }
  if (!APPROVED_HOSTS.includes(match[1])) {
    return `Pictures can only come from ${APPROVED_HOSTS.join(", ")}.`;
  }
  return null;
}

function OptionRow({ index, option, onChange, onRemove, canRemove }) {
  const [showImage, setShowImage] = useState(Boolean(option.image_url));
  // Track a broken preview in state, keyed by the URL, so that correcting a bad
  // link brings the preview back. The old imperative style.display='none' on
  // the <img> was never reset by React, so one failed load hid the preview for
  // that option permanently.
  const [previewBroken, setPreviewBroken] = useState(false);
  useEffect(() => { setPreviewBroken(false); }, [option.image_url]);
  const problem = imageLinkProblem(option.image_url);
  const needsLabel = Boolean(option.image_url.trim()) && !option.label.trim();

  return (
    <li className="rounded-md border border-hairline bg-surface-2/50 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-3 w-5 shrink-0 text-center text-xs font-semibold text-ink-3">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`poll-option-${index}`}>Option {index + 1}</label>
          <input
            id={`poll-option-${index}`}
            value={option.label}
            onChange={(event) => onChange({ ...option, label: event.target.value.slice(0, MAX_LABEL) })}
            placeholder={`Option ${index + 1}`}
            className="min-h-11 w-full rounded-md border border-hairline bg-surface px-3 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-ink-3 focus:border-accent-line"
          />

          {showImage && (
            <>
              <label className="sr-only" htmlFor={`poll-option-image-${index}`}>
                Picture link for option {index + 1}
              </label>
              <input
                id={`poll-option-image-${index}`}
                value={option.image_url}
                onChange={(event) => onChange({ ...option, image_url: event.target.value })}
                placeholder="https://i.ytimg.com/vi/…/hqdefault.jpg"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="mt-2 min-h-11 w-full rounded-md border border-hairline bg-surface px-3 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-ink-3 focus:border-accent-line"
              />
              {problem && <p className="mt-1.5 text-xs text-ink-2">{problem}</p>}
              {!problem && option.image_url.trim() && !previewBroken && (
                <img
                  src={option.image_url.trim()}
                  alt=""
                  className="mt-2 aspect-video w-32 rounded-md border border-hairline object-cover"
                  onError={() => setPreviewBroken(true)}
                />
              )}
              {needsLabel && (
                <p className="mt-1.5 text-xs text-ink-2">
                  Give this option a short label too — a picture alone cannot be published.
                </p>
              )}
            </>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (showImage) onChange({ ...option, image_url: "" });
                setShowImage((value) => !value);
              }}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-ink-3 transition-colors duration-200 hover:text-ink"
            >
              <ImagePlus aria-hidden="true" className="h-3.5 w-3.5" />
              {showImage ? "Remove picture" : "Add a picture"}
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-ink-3 transition-colors duration-200 hover:text-ink"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Remove option
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

const STATUS_LABEL = {
  pending: "Waiting for review",
  live: "Live",
  rejected: "Not approved",
  closed: "Closed",
  hidden: "Taken down",
};

/**
 * The other half of an approval queue. Without this a student submits into
 * silence: the poll is not on /polls (it is still pending) and get_poll()
 * deliberately returns nothing for an unpublished row, so there would be
 * nowhere at all to read the reviewer's reason.
 */
function MySubmissions({ api, signedIn, refreshKey }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!signedIn) return undefined;
    let active = true;
    api.getMySubmissions()
      .then((data) => { if (active) setRows(data); })
      .catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [api, signedIn, refreshKey]);

  if (!signedIn || !rows?.length) return null;

  return (
    <Surface as="section" className="mt-6">
      <h2 className="text-sm font-medium text-ink">Your suggestions</h2>
      <ul className="mt-4 divide-y divide-hairline">
        {rows.map((row) => (
          <li key={row.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              {row.status === "live" || row.status === "closed" ? (
                <Link to={`/polls/${row.slug}`} className="min-w-0 text-sm font-medium text-ink hover:text-accent">
                  {row.question}
                </Link>
              ) : (
                <span className="min-w-0 text-sm font-medium text-ink">{row.question}</span>
              )}
              <Pill tone={row.status === "live" ? "accent" : "quiet"}>
                {STATUS_LABEL[row.status] ?? row.status}
              </Pill>
            </div>
            {row.review_note && (
              <p className="mt-1.5 text-xs text-ink-2">Reviewer: {row.review_note}</p>
            )}
          </li>
        ))}
      </ul>
    </Surface>
  );
}

export default function PollSubmitPage({ api = pollApi, authState = null }) {
  const liveAuth = useSession();
  const { session } = authState ?? liveAuth;
  const signedIn = Boolean(session?.user);

  const [setup, setSetup] = useState({ status: "loading", topics: [], error: "" });
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [detail, setDetail] = useState("");
  const [options, setOptions] = useState([emptyOption(), emptyOption()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // Bumped on every accepted submission, purely so the "Your suggestions"
  // list re-reads and the poll the student just sent appears in it.
  const [submittedCount, setSubmittedCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const mode = await api.getMode();
        if (!active) return;
        if (mode !== "open") {
          setSetup({ status: "unavailable", topics: [], error: "" });
          return;
        }
        const topics = await api.getTopics();
        if (!active) return;
        setSetup({ status: "ready", topics, error: "" });
      } catch (caught) {
        if (active) setSetup({ status: "error", topics: [], error: caught.message });
      }
    };
    load();
    return () => { active = false; };
  }, [api]);

  const crumbs = [{ label: "Polls", to: "/polls" }, { label: "Suggest a poll" }];

  if (setup.status === "loading") {
    return <Page crumbs={crumbs} width="reading"><PollsLoading rows={1} /></Page>;
  }
  if (setup.status === "unavailable") {
    return <Page crumbs={crumbs} width="reading"><PollsUnavailable /></Page>;
  }
  if (setup.status === "error") {
    return (
      <Page crumbs={crumbs} width="reading">
        <PollsLoadError detail={setup.error} onRetry={() => window.location.reload()} />
      </Page>
    );
  }

  const labelled = options.filter((option) => option.label.trim());
  // An option a student STARTED — it has a label, a picture, or both. An option
  // with a picture but no label is not "empty" to drop silently; the server
  // requires a label on every option, so we must flag it, not discard it.
  const started = options.filter((option) => option.label.trim() || option.image_url.trim());
  const missingLabel = started.some((option) => option.image_url.trim() && !option.label.trim());
  const imageProblem = options.map((option) => imageLinkProblem(option.image_url)).find(Boolean);
  const ready = topic
    && question.trim().length >= 10
    && labelled.length >= MIN_OPTIONS
    && !missingLabel
    && !imageProblem;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!ready) {
      setError(missingLabel
        ? "Every option needs a short label, even the ones with a picture."
        : "Choose a subject, write a question of at least 10 characters, and fill in at least two options.");
      return;
    }
    setBusy(true);
    try {
      await api.submitPoll({
        topic,
        question: question.trim(),
        detail: detail.trim() || null,
        options: labelled.map((option) => ({
          label: option.label.trim(),
          image_url: option.image_url.trim() || null,
        })),
      });
      setSubmittedCount((count) => count + 1);
      setDone(true);
    } catch (caught) {
      setError(pollActionError(caught, "send your poll for review"));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Page crumbs={crumbs} width="reading">
        <Surface as="section" className="text-center">
          <h1 className="text-xl font-semibold text-ink">Sent for review</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-2">
            An admin reads every poll before it goes live, mostly to check that the
            question is clear and the pictures are what they say they are. You will
            see it on the polls page once it is approved.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button to="/polls" size="sm">Back to polls</Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDone(false);
                setQuestion("");
                setDetail("");
                setOptions([emptyOption(), emptyOption()]);
              }}
            >
              Suggest another
            </Button>
          </div>
        </Surface>
        <MySubmissions api={api} signedIn={signedIn} refreshKey={submittedCount} />
      </Page>
    );
  }

  return (
    <Page crumbs={crumbs} width="reading">
      <SectionHead
        as="h1"
        eyebrow="Student polls"
        title="Suggest a poll"
        lead="Ask the question you actually want answered. An admin checks it before it goes live, so it will not appear straight away."
      />

      {!signedIn ? (
        <Surface as="section" className="mt-8 text-sm text-ink-2">
          <Link to="/signin" className="font-semibold text-accent">Sign in</Link>{" "}
          to suggest a poll. You can read and vote on existing polls without one.
        </Surface>
      ) : (
        <>
        <MySubmissions api={api} signedIn={signedIn} refreshKey={submittedCount} />
        <form onSubmit={submit} className="mt-8 space-y-6">
          <Surface as="section">
            <label htmlFor="poll-subject" className="text-sm font-medium text-ink">Subject</label>
            <select
              id="poll-subject"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-md border border-hairline bg-surface-2 px-3 text-sm text-ink outline-none focus:border-accent-line"
            >
              <option value="">Choose a subject…</option>
              {setup.topics.map((entry) => (
                <option key={entry.slug} value={entry.slug}>{entry.name}</option>
              ))}
            </select>

            <label htmlFor="poll-question" className="mt-6 block text-sm font-medium text-ink">
              Your question
            </label>
            <input
              id="poll-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, MAX_QUESTION))}
              placeholder="Which chapter do you find hardest in Class 12 Physics?"
              className="mt-2 min-h-12 w-full rounded-md border border-hairline bg-surface-2 px-3 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-ink-3 focus:border-accent-line focus:bg-surface"
            />
            <p className="mt-1.5 text-num text-xs text-ink-3">
              {MAX_QUESTION - question.length} characters left
            </p>

            <label htmlFor="poll-detail" className="mt-6 block text-sm font-medium text-ink">
              Context (optional)
            </label>
            <textarea
              id="poll-detail"
              value={detail}
              onChange={(event) => setDetail(event.target.value.slice(0, MAX_DETAIL))}
              rows={3}
              placeholder="One or two lines explaining why you are asking."
              className="mt-2 w-full rounded-md border border-hairline bg-surface-2 p-3 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-ink-3 focus:border-accent-line focus:bg-surface"
            />
          </Surface>

          <Surface as="section">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-ink">Options</h2>
              <span className="text-xs text-ink-3">{MIN_OPTIONS}–{MAX_OPTIONS} choices</span>
            </div>

            <ul className="mt-4 space-y-3">
              {options.map((option, index) => (
                <OptionRow
                  key={index}
                  index={index}
                  option={option}
                  canRemove={options.length > MIN_OPTIONS}
                  onChange={(next) => setOptions((current) =>
                    current.map((item, position) => (position === index ? next : item)))}
                  onRemove={() => setOptions((current) =>
                    current.filter((_, position) => position !== index))}
                />
              ))}
            </ul>

            {options.length < MAX_OPTIONS && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => setOptions((current) => [...current, emptyOption()])}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add option
              </Button>
            )}

            <Note icon={ImagePlus} className="mt-5">
              Pictures are added as links, not uploads, and only from YouTube
              thumbnails or Wikimedia. That keeps a picture from being swapped for
              something else after an admin has approved your poll.
            </Note>
          </Surface>

          {error && (
            <p role="alert" className="rounded-md border border-hairline bg-surface-2 p-3 text-sm text-ink-2">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Note>An admin reviews every poll. You can send two a day.</Note>
            <Button type="submit" disabled={busy || !ready}>
              <Send aria-hidden="true" className="h-4 w-4" />
              {busy ? "Sending…" : "Send for review"}
            </Button>
          </div>
        </form>
        </>
      )}
    </Page>
  );
}
