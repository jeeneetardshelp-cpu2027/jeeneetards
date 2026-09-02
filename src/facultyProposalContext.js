// facultyProposalContext.js — the channel a proposed name actually teaches on.
//
// The Faculty Review queue shows a reviewer a name, a `kind`, and how many
// courses carry it: "Magnet Brains · single · 10 playlist occurrences". That is
// not enough to decide who somebody is, and for a specific set of names it is
// actively misleading.
//
// scan_free_text_teachers classifies with two keyword regexes.
// looks_like_organization matches team|department|faculty|institute|academy|
// classes and so on; "Magnet Brains" contains none of those words, so it
// arrives labelled `single` — offered to the reviewer as a person. Measured
// against production on 2026-09-02, of the nine distinct names that are simply
// the YouTube channel's own name:
//
//   Competishun+ (76)        caught, but as `multi-person` — by the "+"
//   Mohit Tyagi (32)         `single`, and correctly so: the channel is theirs
//   Magnet Brains (10)       `single` — an organisation offered as a person
//   Digraj Singh Rajput (5)  `single`, correctly
//   NEEV Competishun (4)     `single` — an organisation
//   Hindi Adhyapak (2)       `single` — an organisation
//   Shobhit Nirwan (1)       `single`, correctly
//   Sunlike Study (1)        `single` — an organisation
//   Vinay Uppal (1)          `single`, correctly
//
// The signal that separates those two groups is not in the name at all: it is
// whether the name equals the channel the courses sit on. That is a fact the
// catalogue already holds and the review RPC does not return, so it is joined
// on here rather than guessed at from spelling.
//
// This ADDS context. It changes no classification and hides nothing: the
// reviewer still decides, with one more true thing in front of them.

import { courseCredit } from "./courseCredit.js";

const normalise = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Index the catalogue by its exact free-text teacher string.
 *
 * Keyed on the RAW text, not on a normalised form: the review RPC groups by
 * normalize_person_name(), a Postgres function this cannot reproduce faithfully,
 * and guessing at it would silently mis-attach context. Every variant the RPC
 * returns carries its raw_teacher, so exact matching is both possible and safe.
 *
 * @param rows playlists as { teacher, institutes_channels: { name } }
 * @returns Map<rawTeacher, { total, channels: Map<name, count>, channelNamed }>
 */
export function indexTeacherChannels(rows = []) {
  const index = new Map();
  for (const row of rows) {
    const raw = typeof row?.teacher === "string" ? row.teacher : null;
    if (!raw || !raw.trim()) continue;
    const channel = row?.institutes_channels?.name ?? null;
    if (!index.has(raw)) index.set(raw, { total: 0, channels: new Map(), channelNamed: 0 });
    const entry = index.get(raw);
    entry.total += 1;
    if (channel) {
      entry.channels.set(channel, (entry.channels.get(channel) ?? 0) + 1);
      // The same rule the cards use, so the queue and the catalogue cannot
      // disagree about what counts as "the teacher is just the channel".
      if (courseCredit({ teacher: raw, institute: channel }).duplicated) entry.channelNamed += 1;
    }
  }
  return index;
}

/**
 * Context for one review group: which channels its courses sit on, and whether
 * the proposed name is simply one of those channels' own names.
 *
 * `isChannelName` is true only when EVERY course carrying the name sits on a
 * channel of that name. A teacher who happens to have one self-named course
 * among many is a person, not an organisation, and must not be flagged as one.
 */
export function proposalContext(group, index) {
  const variants = Array.isArray(group?.variants) ? group.variants : [];
  const channels = new Map();
  let total = 0;
  let channelNamed = 0;

  for (const variant of variants) {
    const entry = index.get(variant?.raw_teacher);
    if (!entry) continue;
    total += entry.total;
    channelNamed += entry.channelNamed;
    for (const [name, n] of entry.channels) channels.set(name, (channels.get(name) ?? 0) + n);
  }

  return {
    total,
    channels: [...channels.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    channelNamed,
    isChannelName: total > 0 && channelNamed === total,
  };
}

/** Attach context to every group, leaving the groups otherwise untouched. */
export function withProposalContext(groups = [], rows = []) {
  const index = indexTeacherChannels(rows);
  return groups.map((group) => ({ ...group, context: proposalContext(group, index) }));
}

export { normalise as normaliseTeacherName };
