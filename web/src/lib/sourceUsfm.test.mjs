// Tests for sourceUsfm.ts — whole-book source USFM (Door43 raw) → per-chapter
// VerseDto maps for the flows lanes (issue #430). Run from web/:
//   node --experimental-strip-types --no-warnings --test src/lib/sourceUsfm.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { parseSourceUsfm, sourceUsfmPath } from "./sourceUsfm.ts";
import { buildVerseIndex, coveredLaneSlices } from "./verseRange.ts";
import { extractPlainText } from "./usfm.ts";

// Modeled on the en_ult shape Door43 serves — \zaln-s milestones wrapping \w
// tokens, punctuation outside the \w, a \d chapter-front — with a bridged
// \v 2-3 added. The verse wording is abbreviated, not the published text; the
// point is that the input is real USFM syntax, not a hand-built node literal.
const BOOK = String.raw`\id ZEC unfoldingWord® Literal Text
\usfm 3.0
\ide UTF-8
\h Zechariah
\toc1 The Book of Zechariah
\mt Zechariah
\c 1
\d \zaln-s |x-strong="H4853" x-lemma="מַשָּׂא" x-morph="He,Ncmsa" x-occurrence="1" x-occurrences="1" x-content="מַשָּׂ֥א"\*\w A|x-occurrence="1" x-occurrences="1"\w* \w burden|x-occurrence="1" x-occurrences="1"\w*\zaln-e\*
\p
\v 1 \zaln-s |x-strong="H2320" x-lemma="חֹדֶשׁ" x-morph="He,Ncmsc" x-occurrence="1" x-occurrences="1" x-content="בַּ⁠חֹ֨דֶשׁ"\*\w In|x-occurrence="1" x-occurrences="1"\w* \w the|x-occurrence="1" x-occurrences="2"\w* \w month|x-occurrence="1" x-occurrences="1"\w*\zaln-e\*, \zaln-s |x-strong="H1697" x-lemma="דָּבָר" x-morph="He,Ncmsc" x-occurrence="1" x-occurrences="1" x-content="דְבַר"\*\w the|x-occurrence="2" x-occurrences="2"\w* \w word|x-occurrence="1" x-occurrences="1"\w*\zaln-e\* came.
\v 2-3 \zaln-s |x-strong="H3068" x-lemma="יְהֹוָה" x-morph="He,Np" x-occurrence="1" x-occurrences="1" x-content="יְהוָ֖ה"\*\w Yahweh|x-occurrence="1" x-occurrences="1"\w*\zaln-e\* spoke.
\c 2
\p
\v 1 \w Then|x-occurrence="1" x-occurrences="1"\w* \w I|x-occurrence="1" x-occurrences="1"\w* looked.
`;

test("sourceUsfmPath: standard book-number prefix, null for unknown", () => {
  assert.equal(sourceUsfmPath("ZEC"), "38-ZEC.usfm");
  assert.equal(sourceUsfmPath("zec"), "38-ZEC.usfm");
  assert.equal(sourceUsfmPath("MAT"), "41-MAT.usfm");
  assert.equal(sourceUsfmPath("1SA"), "09-1SA.usfm");
  assert.equal(sourceUsfmPath("XYZ"), null);
  assert.equal(sourceUsfmPath("../etc"), null);
});

test("parseSourceUsfm: chapters, singleton, bridge, and chapter-front rows", () => {
  const book = parseSourceUsfm(BOOK, "zec", "SRC_ULT");
  assert.deepEqual(Object.keys(book).map(Number).sort(), [1, 2]);

  const ch1 = book[1];
  assert.deepEqual(Object.keys(ch1).map(Number).sort(), [0, 1, 2]);

  const v1 = ch1[1];
  assert.equal(v1.book, "ZEC");
  assert.equal(v1.chapter, 1);
  assert.equal(v1.verse, 1);
  assert.equal(v1.verse_end, null);
  assert.equal(v1.bible_version, "SRC_ULT");
  assert.equal(v1.plain_text, null);
  assert.ok(Array.isArray(v1.content.verseObjects));
  assert.equal(extractPlainText(v1.content.verseObjects), "In the month, the word came.");
  // Alignment milestones survive — the later read-only alignment view (#431)
  // depends on them, and the note-quote highlight uses them today.
  const milestone = v1.content.verseObjects.find((n) => n.tag === "zaln");
  assert.ok(milestone, "zaln milestone present");
  assert.equal(milestone.strong, "H2320");

  const bridge = ch1[2];
  assert.equal(bridge.verse, 2);
  assert.equal(bridge.verse_end, 3);
  assert.equal(extractPlainText(bridge.content.verseObjects), "Yahweh spoke.");

  const front = ch1[0];
  assert.equal(front.verse, 0);
  assert.equal(front.verse_end, null);
  assert.equal(extractPlainText(front.content.verseObjects), "A burden");

  assert.equal(extractPlainText(book[2][1].content.verseObjects), "Then I looked.");
});

test("parseSourceUsfm output feeds the existing lane pipeline unchanged", () => {
  const book = parseSourceUsfm(BOOK, "ZEC", "SRC_ULT");
  const index = buildVerseIndex(book[1]);
  // The bridge is reachable under every verse it spans.
  assert.equal(index[3], index[2]);
  const lane = coveredLaneSlices(index, undefined, [2, 3]);
  assert.equal(lane.slices.length, 1);
  assert.equal(lane.plainText, "Yahweh spoke.");
  const single = coveredLaneSlices(index, undefined, [1]);
  assert.equal(single.plainText, "In the month, the word came.");
});

test("parseSourceUsfm: minimal and empty input are tolerated", () => {
  const book = parseSourceUsfm(String.raw`\id GEN
\c 1
\p
\v 1 In the beginning.
`, "GEN", "X");
  assert.equal(extractPlainText(book[1][1].content.verseObjects), "In the beginning.");
  assert.deepEqual(parseSourceUsfm("", "GEN", "X"), {});
});
