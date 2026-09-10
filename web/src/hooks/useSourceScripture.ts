import { useEffect, useState } from "react";
import type { VerseDto } from "../sync/api";
import { parseSourceUsfm, sourceUsfmPath, type SourceBookVerses } from "../lib/sourceUsfm";

// A published SOURCE bible (e.g. unfoldingWord/en_ult) for one chapter, read
// straight from Door43 in the browser. In a gateway-language workspace the D1
// ULT/UST roles hold the project's OWN lit/sim texts (BSOJ: ar_avd / ar_nav);
// the English the notes were drafted against lives only in the published
// source repo. Same pattern and same reasoning as useSourceNotes.ts: Door43
// serves raw files with permissive CORS and the CSP already allows
// git.door43.org. The whole book is fetched once and parsed once (usfm-js is
// already bundled), then served per chapter from the module cache.
//
// Read-only by construction: the parsed verses never enter the outbox, the
// chapter payload, or any save path — they are handed to the lane renderer and
// nothing else (issue #430).

export type SourceScriptureStatus = "idle" | "loading" | "ready" | "error";

export interface SourceScripture {
  status: SourceScriptureStatus;
  // Keyed by verse start, the wire shape buildVerseIndex expands.
  verses: Record<number, VerseDto> | undefined;
}

const IDLE: SourceScripture = { status: "idle", verses: undefined };

function rawUrl(org: string, repo: string, path: string): string {
  return `https://git.door43.org/${org}/${repo}/raw/branch/master/${path}`;
}

const cache = new Map<string, Promise<SourceBookVerses>>();

function fetchSourceBook(
  org: string,
  repo: string,
  book: string,
  bibleVersion: string,
): Promise<SourceBookVerses> | null {
  const path = sourceUsfmPath(book);
  if (!path) return null;
  const url = rawUrl(org, repo, path);
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => parseSourceUsfm(text, book, bibleVersion))
      .catch((err) => {
        cache.delete(url); // don't cache failures — allow retry
        throw err;
      });
    cache.set(url, pending);
  }
  return pending;
}

// `source` is the resolved translationSource projection for the lit role
// ({org, repo}); null — or a null `book` (the caller's way of saying "toggle is
// off") — short-circuits to idle so no fetch fires. `bibleVersion` is only a
// tag stamped on the produced DTOs (never a D1 role).
export function useSourceScripture(
  book: string | null | undefined,
  chapter: number,
  source: { org: string; repo: string } | null,
  bibleVersion: string,
): SourceScripture {
  const [state, setState] = useState<SourceScripture>(IDLE);
  useEffect(() => {
    if (!book || !source) {
      setState(IDLE);
      return;
    }
    const pending = fetchSourceBook(source.org, source.repo, book, bibleVersion);
    if (!pending) {
      setState({ status: "error", verses: undefined });
      return;
    }
    let mounted = true;
    setState({ status: "loading", verses: undefined });
    pending
      .then((bookVerses) => {
        if (mounted) setState({ status: "ready", verses: bookVerses[chapter] ?? {} });
      })
      .catch(() => {
        if (mounted) setState({ status: "error", verses: undefined });
      });
    return () => {
      mounted = false;
    };
  }, [book, chapter, source?.org, source?.repo, bibleVersion]);
  return state;
}
