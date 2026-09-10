// Pure USFM → per-chapter/per-verse conversion for the published source
// scripture (e.g. unfoldingWord/en_ult) shown as a read-only reference lane in
// the flows notes screen (issue #430). The BSOJ translate case: the project's
// own lit/sim lanes hold the Arabic AVD/NAV, and the English ULT the note was
// written against is not in D1 at all — so the notes screen fetches it from
// Door43 in the browser and renders it as a third lane, exactly the way
// useSourceNotes.ts fetches the English source *notes*.
//
// Kept a plain .ts module (no JSX, no React) so the `node --experimental-strip-
// types` web test runner can import and unit-test the conversion directly —
// same convention as sourceRef.ts / verseRange.ts.

import usfm from "usfm-js";
import type { VerseDto } from "../sync/api";

// USFM book-file numbers (the `NN` in `NN-BOOK.usfm` on Door43), mirroring the
// backend BOOK_NUMBERS in api/src/dcsSources.ts. Keep the two in lockstep. The
// gap at 40 (MAT starts at 41) is the standard Paratext numbering.
export const BOOK_NUMBERS: Record<string, string> = {
  GEN: "01", EXO: "02", LEV: "03", NUM: "04", DEU: "05", JOS: "06", JDG: "07",
  RUT: "08", "1SA": "09", "2SA": "10", "1KI": "11", "2KI": "12", "1CH": "13",
  "2CH": "14", EZR: "15", NEH: "16", EST: "17", JOB: "18", PSA: "19",
  PRO: "20", ECC: "21", SNG: "22", ISA: "23", JER: "24", LAM: "25",
  EZK: "26", DAN: "27", HOS: "28", JOL: "29", AMO: "30", OBA: "31",
  JON: "32", MIC: "33", NAM: "34", HAB: "35", ZEP: "36", HAG: "37",
  ZEC: "38", MAL: "39",
  MAT: "41", MRK: "42", LUK: "43", JHN: "44", ACT: "45",
  ROM: "46", "1CO": "47", "2CO": "48", GAL: "49", EPH: "50",
  PHP: "51", COL: "52", "1TH": "53", "2TH": "54", "1TI": "55",
  "2TI": "56", TIT: "57", PHM: "58", HEB: "59", JAS: "60",
  "1PE": "61", "2PE": "62", "1JN": "63", "2JN": "64", "3JN": "65",
  JUD: "66", REV: "67",
};

/** The `NN-BOOK.usfm` filename for a book id, or null for an unknown book. */
export function usfmFileName(book: string): string | null {
  const num = BOOK_NUMBERS[book.toUpperCase()];
  return num ? `${num}-${book.toUpperCase()}.usfm` : null;
}

// Parse a usfm-js verse KEY into a leading verse number + inclusive end.
//   "6"      → { verse: 6, verseEnd: null }
//   "6-9"    → { verse: 6, verseEnd: 9 }   (mirrors D1's verse/verse_end)
//   "front"  → { verse: 0, verseEnd: null } (chapter front matter → verse 0)
//   "intro"  → null  (skipped — no digit)
// Returns null for anything without a parseable leading number.
export function parseVerseKey(
  key: string,
): { verse: number; verseEnd: number | null } | null {
  if (key === "front") return { verse: 0, verseEnd: null };
  if (!/\d/.test(key)) return null; // "intro" and other non-numeric keys
  const dash = key.indexOf("-");
  if (dash < 0) {
    const n = parseInt(key, 10);
    return Number.isFinite(n) ? { verse: n, verseEnd: null } : null;
  }
  const a = parseInt(key.slice(0, dash), 10);
  const b = parseInt(key.slice(dash + 1), 10);
  if (!Number.isFinite(a)) return null;
  // A malformed or non-widening range ("6-x", "9-6") collapses to a singleton
  // rather than inventing a bogus span.
  if (!Number.isFinite(b) || b <= a) return { verse: a, verseEnd: null };
  return { verse: a, verseEnd: b };
}

// The `verseObjects` tree of one usfm-js verse cell, or [] when absent.
function verseObjectsOf(cell: unknown): unknown[] {
  const vo = (cell as { verseObjects?: unknown[] } | null)?.verseObjects;
  return Array.isArray(vo) ? vo : [];
}

// Convert a whole book's USFM into `{ [chapter]: { [verse]: VerseDto } }`,
// keyed by leading verse the same way D1's chapter payload is, so the result
// drops straight into buildVerseIndex / coveredLaneSlices with no adapter. The
// DTOs are SYNTHETIC (never persisted, never PATCHed): `plain_text` is null so
// coveredLaneSlices extracts display text from the tree, and the audit fields
// carry inert placeholders. `bible_version` is a label of convenience only —
// the lane's visible label comes from the caller, not this field.
export function usfmBookToChapterVerses(
  rawUsfm: string,
  book: string,
): Record<number, Record<number, VerseDto>> {
  const bookId = book.toUpperCase();
  const out: Record<number, Record<number, VerseDto>> = {};
  const json = usfm.toJSON(rawUsfm);
  const chapters = json?.chapters ?? {};
  for (const chapterKey of Object.keys(chapters)) {
    const chapter = Number(chapterKey);
    // Skip the book-level "front" (book intro) and any non-numeric chapter key.
    if (!Number.isInteger(chapter)) continue;
    const cells = chapters[chapterKey] as Record<string, unknown>;
    const byVerse: Record<number, VerseDto> = {};
    for (const verseKey of Object.keys(cells)) {
      const parsed = parseVerseKey(verseKey);
      if (!parsed) continue;
      byVerse[parsed.verse] = {
        book: bookId,
        chapter,
        verse: parsed.verse,
        verse_end: parsed.verseEnd,
        bible_version: "ULT",
        plain_text: null,
        version: 0,
        updated_by: null,
        updated_at: 0,
        content: { verseObjects: verseObjectsOf(cells[verseKey]) },
      };
    }
    out[chapter] = byVerse;
  }
  return out;
}
