# Upstream sync 2026-09-11

Triage of upstream `unfoldingWord/bible-editor` `main`, window
`1f98c0cd..2aacd9a` (2026-08-27 – 2026-09-10, **60 non-merge commits**). Reads
together with [`upstream-sync-2026-08-28.md`](upstream-sync-2026-08-28.md) and
[`upstream-sync-2026-08-21.md`](upstream-sync-2026-08-21.md).

Task focus was backend fixes (Door43/DCS sync, API/router, USFM/data-handling).
**3 ported**; the rest are already present, target subsystems this fork never
took, or touch the brittle alignment surface and are deferred.

## Ported (this PR)

- **`a65f0a64` (#730) — fix(rows): validate TWL PATCH ref_raw is a single
  same-chapter verse.** New leaf module `twlRefGuard.ts` + unit test port
  verbatim. rows.ts hook re-anchored to just before this fork's `ref_raw ->
  verse` re-derivation (no `chapterZeroGuard.ts` here to sit behind); reads
  `p.ref_raw` / `current.chapter`. Rejects range / empty / cross-chapter /
  unsafe-integer ref_raw with 400 before it can tear the stored chapter/verse
  columns from ref_raw and misfeed the nightly export.
- **`ac538754` (#756) — fix(chapters): always offer chapter 0 in the book
  summary.** New leaf module `chapterSummary.ts` + unit test, adapted to this
  fork's richer 8-field summary row (`tnValidated`/`tqValidated`/`versesDone`);
  `withChapterZero` wraps the fork's per-chapter **merged** array (not
  upstream's single query result). `Shell.tsx` intro-tile guard gains
  `chapter === 0` (fork lacks `introMarkerMissing`) + the `chapter` dep, so a
  chapter 0 whose only note was trashed keeps its rail tile and Restore path.
- **`96a5a367` (#660) — fix(rows): broadcast no-op review-flag clear to other
  open tabs.** Adds the `row.upserted` broadcast to the no-op clear branch,
  mirroring the sibling reorder fast path; new regression test
  `reviewFlagBroadcast.test.mjs` drives the real Hono router + real migrations,
  adapted to this fork's **tn-only** clear path and workspace-scoped DO room
  name (`default:BOOK:chapter`). `Shell.onUpsert` nudges the debounced
  book-lint refetch, since the clear is a same-version bit-toggle the client
  version guard drops.

## Already present (fork verified) — no port needed

- **`bbbb6df` / `39683ed` / `5bc8004` — \qs (Selah) / \d superscription
  content-loss.** The fork already descends `\qs`/`\d` via the shared
  predicates `isCharacterWrapper` / `isSuperscription` in `usfm.ts`
  (`alignment.ts`, `highlight.ts`, `quoteBuilder.ts`, `sourceOccurrences.ts`
  all keyed on them) — a more mature shape than upstream's older
  `type:"section"` / `tag==="d"` tests. The still-open `PSA 24:6 UST` Selah
  item in STATE.md is a **data/deploy blocker** (D1 already healed to v2; needs
  the `-be-` export branch merged), not a code gap — porting these would not
  clear it.
- **`ebc2b76` (#688) — twlSortOrderApply no version bump on pure reorder.**
  Already landed here as fork PR #422 (`7604afe`).

## Deferred (relevant but bounded risk / out of backend scope)

- **`334a866` (#711) — \sp/\sr/\r/\cl as header-band labels.** A genuine gap
  (fork `usfm.ts` lacks `isHeaderLabelNode`/`HEADER_LABEL_TAGS`; `\sp` label
  text can leak into `plain_text`), but spans the brittle
  `usfm.ts`+`highlight.ts`+`Shell.tsx`+`SectionHeaderBand.tsx` surface. Worth a
  separate, dedicated frontend pass.
- **`39bffae` (#713, \qa/\li) / `ad0dce6` (#707, \p-family as formatting).**
  Touch `replace.ts`/`alignment.ts` — the CLAUDE.md-flagged alignment-loss
  surface; fork already carries partial independent handling (`PARAGRAPH_TAGS`,
  acrostic comments). High scrutiny; not a backend PR.
- **`1708941` (#716, api half) — lint orphaned \b text.** Adds a lint flag
  only (not the render fix, which lives in brittle `highlight.ts`); lands on a
  diverged fork `lint.ts` missing the sibling infra it assumes
  (`lintChapterOpeningMarkers`, an exported `isInFlowMarker`). Low value alone.
- **`339726e` / `0b6b2c7` / `4cb4049` / `49eadfc` — frontend WS/auth/save
  races.** Out of backend scope; `4cb4049` and `49eadfc` look largely covered
  already (fork `App.tsx` `onAuthRefreshed(() => setSessionExpired(false))`;
  `BookView`/`DocColumn` already read live DOM at save).

## Not applicable (subsystem absent from this fork)

Confirmed against the working tree; consistent with the 2026-08-21/-28 rulings.

- **`8903250` (#750) — exportWorkflow own-PR recognition.** Needs absent
  `ownPublish.ts` + `masterLineage.ts`, `dcsSources.fileHeadCommit`/
  `fileBlobShaAtCommit` (fork has only `fileCommitSha`, different signature),
  and `book_resource_syncs.pushed_pr_number`/`pushed_blob_sha`. Fork's
  `checkMasterFreshness` has itself diverged (lane/workspace-aware).
- **`638e60e` (#751) — reimport skip source-attr reconcile.** Keys on
  `computeVerseMerge` action values; `verseMerge.ts` / `VerseMergeAction` are
  entirely absent here.
- **`b94b368` (#681) — tsvMerge self-heal torn rows.** Needs absent
  `tsvMerge.ts` + `rowProvenance.ts`, and edits a `0060_row_provenance.sql`
  migration the fork doesn't have (its 0060 is `book_source_overrides`).
- **dcs_commits ledger / provenance / lineage chain** (`d306900` `f3f499f`
  `2ab9ebb` `3197ac3` `e565c43` `a815c5e` `5741d67` `c0b1e4f` `95bc0b4`
  `d20fb9f` `0ee02d0` `2ab9ebb`) — new upstream feature stack (`dcs_commits`,
  `rowProvenance`, `masterLineage`); no such subsystems here.
- **verseMergeConflicts / verse-bridge families** (`54f2b73` `9e12337`
  `1579ddc` `67338b7` `2663604` `2aacd9a`/`690d61a` repair+lint scripts) —
  verse-merge and verse-bridge subsystems absent (ruled out 2026-08-21/-28).
- **Book-lint desk / comment-badge / toolbar UI** (`60f9145` `d09a73a`
  `158fe35` `0fed3e7` `a4214c1` `287a171` `facf21a` `04e490e` `6c2bba8`
  `8ff51a2` `19f3716` `6a4d084` `9e36c05` `8b81c71` `b3559f4` `e8271b9`) —
  frontend features / diverged surfaces, out of a backend sync.
- **Test-infra / docs / tooling** (`5434ed4` `1a7ff58` `14c4025` `ee96de4`
  Graft wiring) — not fixes to port.
