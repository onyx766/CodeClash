"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * One query parameter of the current URL. It is null while the page is
 * prerendered and hydrated, then the real value - so prerendered pages need
 * no Suspense boundary (as useSearchParams() would) and never mismatch.
 */
export default function useSearchParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}
