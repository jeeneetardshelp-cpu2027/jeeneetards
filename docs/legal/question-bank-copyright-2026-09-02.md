# Copyright memo: on-site question bank from previous-year papers

Date: 2026-09-02 · Status: research input, gates the Phase-3 question bank
Scope: chapter-wise MCQ practice built from official JEE Main / NEET (NTA) and
JEE Advanced (IIT) papers, and possibly from Competishun-authored solutions.

> **This is research by an AI assistant, not legal advice.** Nobody who wrote
> this is a lawyer. It was compiled from public sources on 2026-09-02, each
> listed at the end with a note on what could and could not be verified. A
> qualified Indian IP lawyer should review this position — and the specific
> build the owner picks — **before the question bank ships**. That matches the
> standing note in `docs/legal_release_inputs.md` that legal review is still
> outstanding.

## TL;DR

- Exam question papers are copyright-protected literary works in India. The
  default position is that NTA and the IITs own their papers for 60 years.
- The statutory fair-dealing exceptions (s.52) are real but narrow, and a
  systematic republished question bank does not fit comfortably inside any of
  them. "We are free and non-commercial" helps the equities, not the statute.
- In practice, exam bodies publish these papers themselves and a very large
  industry republishes them; we found no record of NTA enforcing copyright
  against previous-year-paper sites. Realistic first-contact risk for a free,
  attributed site is a takedown demand, not damages.
- Questions and solutions are different works with different owners.
  Competishun's permission covers hosting their PDFs. Extracting their
  solution text into a database is a new use and needs fresh permission.
- Recommended path: build the bank around official PDFs plus our own metadata
  and answer-key UI (no reproduced question text), ask NTA for permission in
  parallel, and get lawyer sign-off before any extracted-text version.

## 1. Default position under the Copyright Act, 1957

**Question papers are literary works.** Indian courts settled this long ago.
In *Agarwala Publishing House v. Board of High School and Intermediate
Education* (AIR 1967 All 91), the Allahabad High Court held that examination
question papers are "original literary works" — originality needs labour,
skill and judgment, not literary merit. In *Rupendra Kashyap v. Jiwan
Publishing House* (Delhi HC, 1996), the Delhi High Court granted an injunction
against publishers reprinting past CBSE papers, rejecting fair-dealing and
public-interest defences. That case is the closest precedent to what a
question bank does, and it went against the republisher.

**Who owns them.** Three routes matter:

- *"Government work"* (s.2(k)) means a work made or published by or under the
  direction or control of the Government, a department, a legislature or a
  court. Neither NTA nor an IIT is straightforwardly "the Government".
- *Public undertakings* (s.17 proviso (dd)): a work made or first published by
  or under the direction or control of a public undertaking belongs to that
  undertaking. The Explanation covers bodies owned or controlled by
  Government and bodies corporate established by or under a Central Act.
  *Rupendra Kashyap* applied exactly this clause to CBSE's papers. NTA is a
  society registered under the Societies Registration Act, 1860, functioning
  under the Department of Higher Education (secondary sources report
  registration S/ND/914/2018; the Ministry's own PDF blocked our automated
  access, so this detail is verified only second-hand). IITs are bodies
  corporate under s.4 of the Institutes of Technology Act, 1961 — squarely
  inside the Explanation.
- *Term*: s.28 (Government works) and s.28A (public-undertaking works) both
  give 60 years from first publication. Either way, every paper we care about
  (2013 onwards) is in copyright until roughly the 2070s. Nothing here is
  public domain.

*Agarwala* has a twist — where the board exercised no real direction or
control, copyright stayed with the individual paper-setters, and the board's
bye-law claiming it was struck down. Modern bodies almost certainly contract
this away with their paper-setters; we should not build on that gap.

**The practical reality.** NTA and the JEE Advanced office publish their
papers, answer keys and candidate responses on their own sites after each
exam (verified for jeeadv.ac.in, which links Paper 1/2 PDFs and keys
publicly). A whole industry republishes them: for example, Physics Wallah's
JEE Main pages offer the official NTA paper PDFs for download, crediting NTA.
Careers360, ntaexampapers.com and most Kota coaching sites do the same. We
searched for enforcement history and found none: NTA's public legal activity
concerns fake "leaked" papers and scams, not copyright claims against
previous-year-paper sites. Absence of evidence is not a licence — but it is
the honest picture of the enforcement posture.

**Express site terms.** NTA's own copyright policy (opened at
cmat.nta.nic.in; the identical page at exams.nta.nic.in appears in search but
returned HTTP 403 to our tools) says material "may be reproduced free of
charge **after taking proper permission** from National Testing Agency",
reproduced accurately, not misleadingly, with the source prominently
acknowledged. So NTA's stated position asks for permission even where it
charges nothing. jeemain.nta.nic.in also blocked automated access; its terms
are unverified. jeeadv.ac.in shows only a bare footer — "Copyright © JEE
(Advanced) 2026. All Rights Reserved." — with no detailed policy we could
find. Do not claim any of these sites grants blanket republication rights;
they do not.

## 2. Fair dealing (s.52) — and why a question bank doesn't fit

Section 52(1) permits, among other things:

- **(a)** fair dealing for *private or personal use, including research*, and
  for *criticism or review*. This protects a student photocopying a paper for
  themselves, not a website distributing a structured database to the public.
- **(h)** publication in a *collection of short passages* bona fide intended
  for instructional use — capped (no more than two passages from works by the
  same author within five years) and excluding works themselves published for
  educational use. A systematic bank of whole questions fails both limbs.
- **(i)** reproduction by a *teacher or pupil in the course of instruction*,
  or as part of examination questions or answers. The DU photocopy case
  (*University of Oxford v. Rameshwari Photocopy Services*, Delhi HC Division
  Bench, 9 Dec 2016; suit later withdrawn) read "in the course of instruction"
  generously — but inside an institutional teacher–pupil relationship. A
  public website is not a classroom, and the "examination" limb protects the
  body *setting* the exam, not a site republishing it afterwards. *Rupendra
  Kashyap* rejected fair dealing on facts very close to ours.

Being free and ad-free today genuinely matters — it weakens any damages story
and makes us an unattractive target — but no s.52 clause turns on whether the
copier charges. A "systematic reproduction at scale" is the thing the
exceptions were drafted not to cover. If we ship extracted question text, we
should do it knowing it rests on the exam bodies' tolerance, not on a clean
statutory right.

## 3. Questions vs. solutions — the distinction that shapes the roadmap

- **The questions** are the exam body's work (NTA / the IITs), per section 1.
- **Coaching-authored solutions** are the coaching company's own literary
  work — the explanation, working and presentation are Competishun's
  copyright, layered on top of the question text they quote.
- **Competishun's permission covers what it covers.** They agreed to us
  hosting their PDFs as PDFs (e.g. the NSEP solutions the site already
  serves). Extracting their solution text into a database, re-rendering it
  per-question, remixing or editing it is a *different act of reproduction
  and adaptation*. It needs fresh, explicit, ideally written permission that
  names that use. Assume nothing; ask.
- Side note: NSEP is not an NTA/government exam (it is run by a private
  teachers' association), so its papers sit outside the s.17(dd) analysis
  above — another reason the safe unit for olympiad content remains the
  permitted PDF, not extracted text. We did not separately verify NSEP's
  ownership chain; flag it for the lawyer if olympiad questions ever enter
  the bank.

## 4. Risk assessment in plain language

**What comparable Indian ed-tech does:** republishes official PYQs wholesale,
with attribution, at commercial scale, with ads and paid tiers — and has done
so for years without visible copyright consequences from NTA or the IITs.
The exam bodies' incentive runs the other way: wide circulation of past
papers serves their candidates.

**Realistic exposure for us today:** low. We are free, attributed,
non-commercial, and the site already hosts the official PDFs. The realistic
worst first contact is a legal notice or takedown demand, which we would
comply with immediately. Statutory infringement liability exists on paper
(injunctions, damages, and s.63 criminal provisions in egregious commercial
cases), but *Rupendra Kashyap*-style suits have been publisher-vs-publisher
fights over exclusive licences, not actions against free study sites.

**What would change the picture:** adding ads or any monetisation (the
strongest single risk multiplier), selling or paywalling the bank, claiming
the questions as our own, altering questions in ways that misrepresent the
exam body, or republishing coaching-company content beyond permission. Any
of those before lawyer review would be a mistake.

**Concrete mitigations:**

1. **Attribution everywhere.** Every question carries exam, year, session /
   shift and body ("© NTA, JEE Main 2024 Session 2"), consistent with NTA's
   own acknowledge-the-source policy.
2. **Verbatim-PDF-only vs extracted text.** Hosting the unmodified official
   PDF (which we already do, with manifests in `docs/study-materials/`) is
   the same act the entire industry performs against the bodies' own public
   releases. Extracting text into a database is a further act — keep these
   two modes distinct in the build and in our own heads.
3. **Takedown procedure.** Publish a rights-holder notice page routed to the
   monitored address (`jeeneetardshelp@gmail.com`, per
   `docs/legal_release_inputs.md`), with a commitment to remove challenged
   content fast. This is our single best practical shield.
4. **Ask NTA / the JEE (Advanced) office.** NTA's policy literally invites a
   permission request for free reproduction. A short letter costs nothing,
   and a yes converts tolerated use into licensed use.
5. **Answer-key-reveal design.** A practice mode that shows *our* chapter
   tags, navigation and answer reveal against the official paper PDF — never
   reproducing question text into our database — keeps almost all the student
   value with the smallest copyright surface.

## 5. Options for the owner (pick one; none of this is legal advice)

- **Option A — hold.** Build nothing until a lawyer reviews this memo.
  Safest; costs roadmap time.
- **Option B — PDF-anchored bank (recommended starting point).** The
  database stores only our own work: chapter tags, question numbers, marks,
  official answer-key values, difficulty notes. The student practises against
  the official PDF rendered alongside; tapping a question number reveals the
  key. No exam-body text is reproduced. Mitigations 1–4 apply anyway.
- **Option C — full extracted-text MCQ bank.** Industry-standard posture,
  best UX, weakest legal footing. Only with mitigations 1–4 in place, no
  monetisation, and explicit lawyer sign-off first.
- **In every option:** no extraction of Competishun (or any coaching body's)
  solution text without fresh written permission naming database use.

Recommendation to put to the owner: **Option B now**, send the NTA
permission letter in parallel, and treat Option C as a separate later
decision gated on the lawyer review this memo keeps insisting on.

## Sources (all accessed 2026-09-02)

Opened directly:

- Copyright Act, 1957 full text (ss. 2(k), 17(dd) + Explanation, 28, 28A,
  52(1)): <https://indiankanoon.org/doc/1136195/>
- *Agarwala Publishing House v. Board of High School and Intermediate
  Education*, AIR 1967 All 91: <https://indiankanoon.org/doc/1183558/>
- *Rupendra Kashyap v. Jiwan Publishing House*, Delhi HC 1996:
  <https://indiankanoon.org/doc/134584/>
- NTA Copyright Policy (CMAT mirror of the standard NTA page):
  <https://cmat.nta.nic.in/copyright-policy/>
- JEE (Advanced) official site, footer + public paper/key links:
  <https://jeeadv.ac.in/>
- DU photocopy case overview (Delhi HC DB, 9 Dec 2016; suit withdrawn 2017):
  <https://en.wikipedia.org/wiki/University_of_Oxford_v._Rameshwari_Photocopy_Service>
- Physics Wallah republishing official NTA papers with credit:
  <https://www.pw.live/iit-jee/exams/jee-main-session-1-question-paper-2026-official-nta>

Seen only via search results (not independently opened — treat as
second-hand): NTA policy at <https://exams.nta.nic.in/copyright-policy/> and
the Ministry note <https://www.education.gov.in/sites/upload_files/mhrd/files/NTA.pdf>
(both returned HTTP 403 to our tools); NTA society registration S/ND/914/2018;
Institutes of Technology Act, 1961 s.4 text at
<https://indiankanoon.org/doc/1585254/>. jeemain.nta.nic.in also blocked
automated access; its terms remain unverified. We found no reported NTA
copyright-enforcement action against previous-year-paper republication; that
is an absence in our searches, not a guarantee.
