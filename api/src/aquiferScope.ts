// Optional chapter-scoping for the Aquifer draft pull (issue #310).
//
// `aquiferDrafts` (aquiferImport.ts) pulls a WHOLE book by default. When the
// caller wants only a subset of chapters — e.g. picking up upstream Aquifer
// revisions for MRK 9 and 12 without re-pulling (and re-provenancing) the rest
// of the book — it passes a `chapters` query param. This module is the pure,
// unit-testable core of that scoping: parse the param, and answer "is chapter N
// in scope?".
//
// A `null` scope means "no scope was given" → whole-book behaviour, unchanged.
// Keeping the default as null is what makes the feature a strict no-op for every
// existing caller.

/**
 * Parse a `chapters` scope param into a set of chapter numbers.
 *
 * Accepts a comma-separated list of positive integers and/or `a-b` inclusive
 * ranges (whitespace ignored), e.g. `"9,12"`, `"9-12"`, `"1-3,9,12"`. A list is
 * used rather than a single range because the motivating case (MRK 9 and 12) is
 * non-contiguous, which a plain start/end range cannot express.
 *
 * Returns `null` when the param is absent/blank or yields no valid chapter —
 * meaning "whole book" (the default, unchanged behaviour). Invalid tokens are
 * skipped rather than throwing, so a partly-malformed param still scopes to the
 * chapters it could parse (and to null if it parsed none).
 *
 * Chapter numbers above {@link MAX_CHAPTER} and non-safe integers are skipped
 * the same way (see issue #425): without a bound, an admin-supplied
 * `?chapters=1-1000000000` would allocate ~1e9 `Set` entries, and a range at
 * `2^53` (which passes `Number.isInteger` but which `n++` can never advance
 * past) would loop forever.
 */
// Real books top out at 150 chapters (Psalms); cap generously so the expanded
// set can never exceed a sane size regardless of what an admin caller passes.
const MAX_CHAPTER = 200;

export function parseChapterScope(raw: string | null | undefined): Set<number> | null {
  if (!raw) return null;
  const out = new Set<number>();
  for (const tokenRaw of raw.split(",")) {
    const token = tokenRaw.trim();
    if (!token) continue;
    const dash = token.indexOf("-");
    if (dash > 0) {
      const start = Number(token.slice(0, dash).trim());
      const end = Number(token.slice(dash + 1).trim());
      if (
        Number.isSafeInteger(start) &&
        Number.isSafeInteger(end) &&
        start > 0 &&
        end >= start &&
        end <= MAX_CHAPTER
      ) {
        for (let n = start; n <= end; n++) out.add(n);
      }
      continue;
    }
    const n = Number(token);
    if (Number.isSafeInteger(n) && n > 0 && n <= MAX_CHAPTER) out.add(n);
  }
  return out.size ? out : null;
}

/**
 * True when `chapter` is in scope. A `null` scope means "no scope given" → every
 * chapter is in scope (whole-book default).
 */
export function chapterInScope(chapter: number, scope: Set<number> | null): boolean {
  return scope === null || scope.has(chapter);
}
