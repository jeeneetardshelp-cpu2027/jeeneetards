# Competishun+ Organic Chemistry PYQ pilot review — 2026-07-31

Scope: read-only review for a possible `content_type=pyq` import. No production
write has been performed for this playlist.

Source:

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI82vTo5kGbD7EtVkNkFMyw5`
- Title: `Org Chemistry- JEE Advanced PYQs`
- Usable videos: 19
- Embedding: all 19 currently embeddable

Automated draft result:

- `1 auto`
- `11 review`
- `7 unmatched`
- Draft manifest: `docs/manifests/draft-PLQsNiHo64JI82vTo5kGbD7EtVkNkFMyw5.json`
- Review detail: `docs/manifests/draft-PLQsNiHo64JI82vTo5kGbD7EtVkNkFMyw5.review.json`

## Recommended owner-review mapping

Use `content_type=pyq`, goal `JEE`, subject `Chemistry`, class `12th`, teacher
brand `Competishun+`, decision `1c06eb34-fbdc-4d3b-a239-39f256f889e8`.

| Source position | Video ID | Title cue | Recommended chapter | Review note |
|---:|---|---|---|---|
| 1 | `i59LKT_DgjY` | GOC | Some Basic Principles of Organic Chemistry | GOC is normally inside this chapter. |
| 2 | `7ME_SzpFOMw` | Stereoisomerism | Stereoisomerism | Needs new Chemistry chapter unless owner wants it folded into Some Basic Principles of Organic Chemistry. |
| 3 | `a90HQrHixto` | Polymers | Polymers | Needs new Chemistry chapter. |
| 4 | `ZiMgUfrS8HE` | ORM-IV | Organic Reaction Mechanisms | Needs new Chemistry chapter; broad ORM label. |
| 5 | `o4BIUlwe4Wk` | ORM-III | Organic Reaction Mechanisms | Same as above. |
| 6 | `VBPjUrqoH-o` | ORM-I & II | Organic Reaction Mechanisms | Same as above. |
| 7 | `OG7ra7EchQg` | Reduction, Oxidation, and Hydrolysis | Organic Reaction Mechanisms | Ambiguous; owner should confirm. |
| 8 | `T4By4XwAsKM` | Biomolecules | Biomolecules | Auto-mapped correctly. |
| 9 | `YXhSZ6XOVao` | Aldehydes, Ketones & Carboxylic Acids | Organic Compounds Containing Oxygen | Recommended broader existing chapter. |
| 10 | `E1K91qjJve8` | Aldehydes, Ketones & Carboxylic Acids | Organic Compounds Containing Oxygen | Same as above. |
| 11 | `5_bTNI53Dpw` | Aldehydes, Ketones & Carboxylic Acids | Organic Compounds Containing Oxygen | Same as above. |
| 12 | `6YuYm2wNolU` | Aldehydes, Ketones & Carboxylic Acids | Organic Compounds Containing Oxygen | Same as above. |
| 13 | `lFIONq5QOr4` | Aldehydes, Ketones & Carboxylic Acids | Organic Compounds Containing Oxygen | Same as above. |
| 14 | `hgcR6hPwf98` | Aldehydes, Ketones & Carboxylic Acids | Organic Compounds Containing Oxygen | Same as above. |
| 15 | `ZOL1FjuW5hU` | Aromatic Compounds | Hydrocarbons | Existing closest chapter; owner may prefer new `Aromatic Compounds`. |
| 16 | `u5Oqrae_1XI` | Aromatic Compounds | Hydrocarbons | Same as above. |
| 17 | `xHSRaO4ARWg` | Aromatic Compounds Part-3 | Hydrocarbons | Same as above. |
| 18 | `qoa7zQVzRsI` | Aromatic Compounds Part-2 | Hydrocarbons | Same as above. |
| 19 | `fAC2hqyzpzQ` | Aromatic Compounds | Hydrocarbons | Same as above. |

## New reference chapters needed if using the recommended precise mapping

Create-only, Chemistry subject:

- `Stereoisomerism`
- `Polymers`
- `Organic Reaction Mechanisms`

Optional precision choice:

- If owner does not want Aromatic Compounds folded into `Hydrocarbons`, also
  create `Aromatic Compounds`.

## Safe next gate

Owner/Claude should approve one of these mappings before any production write:

1. **Conservative existing-chapter mapping**: fold Stereoisomerism/ORM/Aromatic
   into existing broader chapters; creates only `Polymers`.
2. **Precise chapter mapping (recommended)**: create the three new chapters
   above, optionally `Aromatic Compounds`, then dry-run/import as `pyq`.

After approval, perform:

1. fresh baseline/fingerprint check;
2. create-only chapter reference step if needed;
3. production dry-run;
4. create-only import;
5. protected original-83 JEE fingerprint verification.
