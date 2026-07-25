# PHASE 7 — done

Changed: `package.json:12-16`; `src/scripts/importChannel.js:28-30,61-63,194-207,232-234`;
`src/scripts/ingestionSafety.js:1-128`; `src/scripts/ingestionSafety.test.js:1-124`;
`src/scripts/applyMetadata.js:13-40`; `src/scripts/applyClassification.js:13-43`;
`src/scripts/classifyExisting.js:18-51`; `src/scripts/youtubeNode.js:37-52`;
`src/scripts/inspectIngestionState.js:1-51`; `src/scripts/resolvePlaylistOwner.js:1-17`;
`src/scripts/listChannelPlaylists.js:1-27`.

Command:

```text
npm run import -- UCpyc1eTpM1cA3P0ZWym4clw --env=staging --playlist-id=PL_A4M5IAkMadyoou3Fl2jR0pG3X1Wi6xA --category=JEE --goal=JEE --subject=Physics --chapter=Kinematics --classes=11th --content-type=full-course --language=hinglish --difficulty=advanced
npm run audit:ingestion -- --env=production
npm test
npm run test:integration
npm run lint
npm run build
npm audit --omit=dev
```

Output:

```text
10 videos added, 0 reused
1 chapters created
1 courses created

"placeholderChannels": []
"name": "Mohit Tyagi"
"youtube_channel_id": "UCpyc1eTpM1cA3P0ZWym4clw"

Test Files  64 passed (64)
Tests       604 passed (604)

88 passed, 0 failed
report -> test-report.json

eslint . --max-warnings=0
✓ built in 746ms
found 0 vulnerabilities
```

Production SQL result:

```text
id  name         youtube_channel_id            linked_playlists
1   Mohit Tyagi  UCpyc1eTpM1cA3P0ZWym4clw     5
```

Mutation test: `content_type: plan.contentType` broken to `null` -> RED
(`1 failed, 6 passed`) -> restored -> GREEN (`7 passed`);
`--confirm` guard bypassed -> RED (`1 failed, 6 passed`) -> restored -> GREEN
(`7 passed`).

Blanket-script probes:

```text
Refusing bulk update without --confirm.
Refusing bulk update without --confirm.
Bulk classification stopped: Refusing bulk update without --confirm.
```

Not done: none.

Needs owner: none.
