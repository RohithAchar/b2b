"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_SUGGESTIONS,
  normalizeSuggestQuery,
  SUGGEST_MIN_CHARS,
  type SearchSuggestResponse,
} from "@/lib/search-suggest";

/**
 * Debounced fetch of `/api/search/suggest` for a controlled search input.
 *
 * Pass "" (or keep the dropdown closed) to skip fetching. Aborts in-flight
 * requests on each keystroke so slow responses can never overwrite newer
 * results. Results are keyed by query: while a new query is debouncing or in
 * flight the hook reports empty results with `loading` true, so stale
 * suggestions are never shown for fresh input.
 */
export function useSearchSuggestions(query: string, delay = 200) {
  const q = normalizeSuggestQuery(query);
  const active = q.length >= SUGGEST_MIN_CHARS;
  const [state, setState] = useState<{ q: string; data: SearchSuggestResponse }>({
    q: "",
    data: EMPTY_SUGGESTIONS,
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPending(true);
      void (async () => {
        try {
          const res = await fetch(
            `/api/search/suggest?q=${encodeURIComponent(q)}`,
            { signal: controller.signal },
          );
          if (!res.ok) throw new Error(`suggest ${res.status}`);
          const data = (await res.json()) as SearchSuggestResponse;
          if (!controller.signal.aborted) setState({ q, data });
        } catch {
          if (!controller.signal.aborted) setState({ q, data: EMPTY_SUGGESTIONS });
        } finally {
          if (!controller.signal.aborted) setPending(false);
        }
      })();
    }, delay);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, q, delay]);

  const settled = state.q === q;
  const visible = active && settled ? state.data : EMPTY_SUGGESTIONS;

  return {
    products: visible.products,
    categories: visible.categories,
    loading: active && (!settled || pending),
    hasResults: visible.products.length + visible.categories.length > 0,
  };
}
