import { useEffect, useState } from "react";

import type { VerseDto } from "../sync/api";
import { usfmBookToChapterVerses, usfmFileName } from "../lib/sourceScripture";

// The published source-language literal scripture (e.g. unfoldingWord/en_ult)
// for a book, keyed `{ [chapter]: { [verse]: VerseDto } }` so the result drops
// straight into buildVerseIndex / coveredLaneSlices. This is the scripture twin
// of useSourceNotes: in a BSOJ translate workspace the project's own lit/sim
// lanes hold the Arabic AVD/NAV, and the English ULT the note was written
// against is not in D1 at all — so the flows notes screen fetches it from
// Door43 in the browser and shows it as a read-only reference lane (issue #430).
// Door43 serves raw USFM with permissive CORS, and the prod CSP already allows
// git.door43.org (same path useSourceNotes / the tW article viewer rely on).
//
// Degrades gracefully: an unknown book, a null source, or a failed fetch yields
// an empty map, and the lane simply doesn't render.

export type SourceScriptureBook = Record<number, Record<number, VerseDto>>;

const EMPTY: SourceScriptureBook = {};

function rawUrl(org: string, repo: string, book: string): string | null {
  const file = usfmFileName(book);
  if (!file) return null;
  return `https://git.door43.org/${org}/${repo}/raw/branch/master/${file}`;
}

// Cache the parsed book per URL — memoizes the in-flight/resolved promise so a
// re-render or a second consumer of the same source doesn't refetch. Failures
// are evicted so a later mount can retry (mirrors useSourceNotes).
const cache = new Map<string, Promise<SourceScriptureBook>>();

function fetchSourceScripture(
  org: string,
  repo: string,
  book: string,
): Promise<SourceScriptureBook> {
  const url = rawUrl(org, repo, book);
  if (!url) return Promise.resolve(EMPTY);
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => usfmBookToChapterVerses(text, book))
      .catch((err) => {
        cache.delete(url); // don't cache failures — allow retry
        throw err;
      });
    cache.set(url, pending);
  }
  return pending;
}

// `source` is a resolved translationSource projection {org, repo} (the "lit"
// role); null (or a null book) short-circuits to an empty map, so no fetch
// fires. The caller passes a null book to keep the fetch OFF until the toggle
// is on — nothing leaves the browser for the source lane until the translator
// asks for it.
export function useSourceScripture(
  book: string | null | undefined,
  source: { org: string; repo: string } | null,
): SourceScriptureBook {
  const [byChapter, setByChapter] = useState<SourceScriptureBook>(EMPTY);
  useEffect(() => {
    if (!book || !source) {
      setByChapter(EMPTY);
      return;
    }
    let mounted = true;
    fetchSourceScripture(source.org, source.repo, book)
      .then((m) => {
        if (mounted) setByChapter(m);
      })
      .catch(() => {
        if (mounted) setByChapter(EMPTY);
      });
    return () => {
      mounted = false;
    };
  }, [book, source?.org, source?.repo]);
  return byChapter;
}
