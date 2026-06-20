// useDebounce.ts — Generic value-debounce hook.
//
// Design constraints:
//   D-14: Explicit setTimeout/clearTimeout pattern (fixed-timer, not deferred rendering).
//
// Semantics:
//   - Returns `value` immediately on first render (no delay on init).
//   - Returns the previous debounced value for <delayMs after each change.
//   - Emits the latest `value` ~delayMs after the last change (latest wins on rapid changes).
//   - Each change clears the pending timer via useEffect cleanup (clearTimeout).

import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates ~`delayMs` after
 * the last change. Uses explicit setTimeout/clearTimeout (fixed-timer pattern).
 *
 * @param value   - The value to debounce.
 * @param delayMs - Debounce delay in milliseconds.
 * @returns The debounced value.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    // Cleanup: cancel the pending timer if value or delayMs changes before it fires.
    return () => {
      clearTimeout(id);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
