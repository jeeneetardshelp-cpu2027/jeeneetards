# Competishun+ Physics PYQ pilot review — 2026-07-31

Scope: read-only review for a possible future `content_type=pyq` import. No
production write has been performed for this playlist.

Source:

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI-5zKxeVKuhjTzvV-Cwd2Ku`
- Title: `Physics- JEE Advanced PYQs`
- Usable videos returned by YouTube API: 47

Automated draft result:

- `21 auto`
- `6 review`
- `20 unmatched`
- Draft manifest: `docs/manifests/draft-PLQsNiHo64JI-5zKxeVKuhjTzvV-Cwd2Ku.json`
- Review detail: `docs/manifests/draft-PLQsNiHo64JI-5zKxeVKuhjTzvV-Cwd2Ku.review.json`

## Import readiness

Not ready for production import without owner/Claude review.

Reasons:

- The playlist spans many Physics chapters and mixes short PYQs with longer
  chapter-wise PYQ sessions.
- Several rows are ambiguous or need exact chapter decisions:
  - SHM with elastic collision + COM frame;
  - Fluid Mechanics rows;
  - Heat Transfer, Thermal Expansion, Calorimetry;
  - EMF/EMI rows;
  - Nuclear Physics, Bohr Model, Photoelectric Effect, Matter Waves;
  - Surface Tension rows;
  - Sound Wave / Wave on String;
  - Rigid Body Dynamics;
  - Unit and Dimension;
  - Geometrical Optics rows.
- The drafter suggested some wrong or too-broad alternatives, for example
  Geometrical Optics → Wave Optics, which should be reviewed against
  `Ray Optics and Optical Instruments`.

## Safe next gate

If this playlist is approved as a PYQ course, do a dedicated review table before
writing:

1. confirm every video maps to one Physics chapter;
2. create any missing reference chapters additively if needed;
3. keep source order unless owner wants chapter-cluster order;
4. dry-run with `content_type=pyq`;
5. import create-only;
6. verify protected original-83 JEE fingerprint.

Recommended priority: finish the smaller Organic Chemistry PYQ pilot first,
then use the same pattern for this larger Physics playlist.
