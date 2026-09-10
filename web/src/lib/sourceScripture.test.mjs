// Tests for the pure USFM → per-chapter/per-verse conversion behind the flows
// notes source-scripture lane (web/src/lib/sourceScripture.ts, issue #430).
// Run from web/:
//   node --experimental-strip-types --no-warnings --test src/lib/sourceScripture.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOK_NUMBERS,
  parseVerseKey,
  usfmFileName,
  usfmBookToChapterVerses,
} from "./sourceScripture.ts";

test("usfmFileName builds NN-BOOK.usfm and lockstep-matches BOOK_NUMBERS", () => {
  assert.equal(usfmFileName("ZEC"), "38-ZEC.usfm");
  assert.equal(usfmFileName("zec"), "38-ZEC.usfm"); // case-insensitive
  assert.equal(usfmFileName("MAT"), "41-MAT.usfm"); // the 40-gap boundary
  assert.equal(usfmFileName("REV"), "67-REV.usfm");
  assert.equal(usfmFileName("XYZ"), null); // unknown book → no source
  assert.equal(BOOK_NUMBERS.GEN, "01");
});

test("parseVerseKey: singleton, front→0, range, intro skipped", () => {
  assert.deepEqual(parseVerseKey("1"), { verse: 1, verseEnd: null });
  assert.deepEqual(parseVerseKey("front"), { verse: 0, verseEnd: null });
  assert.deepEqual(parseVerseKey("6-9"), { verse: 6, verseEnd: 9 });
  assert.equal(parseVerseKey("intro"), null);
  assert.equal(parseVerseKey("back"), null);
});

test("parseVerseKey: malformed / non-widening range collapses to a singleton", () => {
  assert.deepEqual(parseVerseKey("9-6"), { verse: 9, verseEnd: null }); // end < start
  assert.deepEqual(parseVerseKey("6-6"), { verse: 6, verseEnd: null }); // end == start
  assert.deepEqual(parseVerseKey("6-x"), { verse: 6, verseEnd: null }); // NaN end
});

const SAMPLE_USFM = `\\id GEN unfoldingWord Literal Text
\\mt Genesis
\\c 1
\\p
\\v 1 In the beginning God created the heavens and the earth.
\\v 2 Now the earth was formless and empty.
\\c 2
\\p
\\v 6-9 Now a mist used to rise from the land.
`;

test("usfmBookToChapterVerses maps chapters/verses to VerseDto-like rows", () => {
  const out = usfmBookToChapterVerses(SAMPLE_USFM, "gen"); // lowercased on purpose

  // Non-integer chapter keys (book "front"/intro matter) are dropped.
  for (const key of Object.keys(out)) {
    assert.ok(Number.isInteger(Number(key)), `chapter key ${key} should be integer`);
  }

  const ch1 = out[1];
  assert.ok(ch1, "chapter 1 present");
  assert.equal(ch1[1].book, "GEN"); // uppercased
  assert.equal(ch1[1].chapter, 1);
  assert.equal(ch1[1].verse, 1);
  assert.equal(ch1[1].verse_end, null);
  assert.equal(ch1[1].plain_text, null); // forces tree extraction downstream
  assert.ok(
    Array.isArray(ch1[1].content.verseObjects) && ch1[1].content.verseObjects.length > 0,
    "verse 1 carries a verseObjects tree",
  );
  assert.ok(ch1[2], "verse 2 present");

  // The bridged `\v 6-9` block keys under its leading verse with an inclusive end.
  const ch2 = out[2];
  assert.ok(ch2, "chapter 2 present");
  assert.equal(ch2[6].verse, 6);
  assert.equal(ch2[6].verse_end, 9);
});
