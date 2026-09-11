// Turn a whole-book USFM blob (as served raw by Door43) into the per-chapter,
// per-verse `VerseDto` shape the flows lanes already consume, so a published
// SOURCE bible (e.g. unfoldingWord/en_ult in a gateway-language workspace) can
// be shown alongside the project's own D1 lanes without a server round trip.
//
// Deliberately display-only and minimal: the Worker importer
// (api/src/importParsers.ts extractVersesForRange) additionally normalizes
// `\w` punctuation, de-glues AI-authored words, and drops doubled markers
// before a verse is STORED. None of that is needed to read a published,
// already-clean source, and none of it may run here — nothing this module
// produces is ever written back. Verse-key handling mirrors the importer:
// numeric ("3"), hyphenated range ("6-9" → verse 6, verse_end 9), and the
// chapter-front pseudo-verse ("front" → verse 0). Book-level `intro` is skipped.
//
// Plain .ts (no JSX) so the node --strip-types web test runner can import it.

import usfm from "usfm-js";
import type { VerseDto } from "../sync/api";

// Standard unfoldingWord book-number prefixes for USFM filenames. Web mirror of
// BOOK_NUMBERS in api/src/dcsSources.ts — keep in lockstep.
export const USFM_BOOK_NUMBERS: Record<string, string> = {
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

// "38-ZEC.usfm" for ZEC; null for a code that isn't a known book (so a caller
// never builds a URL for a garbage book segment).
export function sourceUsfmPath(book: string): string | null {
  const code = book.toUpperCase();
  const num = USFM_BOOK_NUMBERS[code];
  return num ? `${num}-${code}.usfm` : null;
}

// chapter → verse-start → dto (the wire shape of ChapterPayload.verses[bv]).
export type SourceBookVerses = Record<number, Record<number, VerseDto>>;

export function parseSourceUsfm(raw: string, book: string, bibleVersion: string): SourceBookVerses {
  const json = usfm.toJSON(raw);
  const out: SourceBookVerses = {};
  const chapters = json.chapters ?? {};
  for (const chapterKey of Object.keys(chapters)) {
    const chapter = parseInt(chapterKey, 10);
    if (!Number.isFinite(chapter)) continue;
    const chapterObj = chapters[chapterKey] as Record<string, unknown>;
    const byVerse: Record<number, VerseDto> = {};
    for (const verseKey of Object.keys(chapterObj)) {
      let verse: number;
      let verseEnd: number | null = null;
      if (verseKey === "front") {
        verse = 0;
      } else {
        const m = verseKey.match(/^(\d+)(?:-(\d+))?$/);
        if (!m) continue;
        verse = parseInt(m[1], 10);
        if (m[2]) {
          const end = parseInt(m[2], 10);
          verseEnd = end > verse ? end : null;
        }
      }
      if (!Number.isFinite(verse)) continue;
      const verseObj = chapterObj[verseKey] as { verseObjects?: unknown[] } | undefined;
      const verseObjects = Array.isArray(verseObj?.verseObjects) ? verseObj.verseObjects : [];
      byVerse[verse] = {
        book: book.toUpperCase(),
        chapter,
        verse,
        verse_end: verseEnd,
        bible_version: bibleVersion,
        // Null on purpose: coveredLaneSlices extracts the lane text from the
        // tree when plain_text is empty, the same walk flowHighlight renders.
        plain_text: null,
        version: 0,
        updated_by: null,
        updated_at: 0,
        content: { ...verseObj, verseObjects },
      };
    }
    out[chapter] = byVerse;
  }
  return out;
}
