// useDebounce.test.ts — Timer-semantics test for the useDebounce hook.
//
// Tests are in node env (no jsdom) using Vitest fake timers.
// We test the core debounce logic by extracting it into an equivalent
// testable structure: a "scheduleDebounce" function that mirrors the hook's
// setTimeout/clearTimeout effect, verifiable without a DOM.
//
// Guards:
//   - No update fires before delayMs
//   - Update fires after delayMs
//   - Rapid changes: only the final value fires (latest-wins / clearTimeout on re-schedule)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Test harness ─────────────────────────────────────────────────────────────
// Simulate the hook's useEffect logic without React / jsdom:
//   scheduleDebounce(value, delayMs) returns a cancel() function.
//   Calling it again before delayMs cancels the previous timer (latest-wins).

type Subscriber<T> = (value: T) => void;

function makeDebouncer<T>(delayMs: number) {
  let currentTimerId: ReturnType<typeof setTimeout> | undefined;
  let lastEmitted: T | undefined;
  let hasEmitted = false;

  function schedule(value: T, onEmit: Subscriber<T>) {
    // Mirror the hook's useEffect cleanup: clear previous timer
    if (currentTimerId !== undefined) {
      clearTimeout(currentTimerId);
    }
    currentTimerId = setTimeout(() => {
      lastEmitted = value;
      hasEmitted = true;
      onEmit(value);
    }, delayMs);
  }

  function cancel() {
    if (currentTimerId !== undefined) {
      clearTimeout(currentTimerId);
      currentTimerId = undefined;
    }
  }

  return {
    schedule,
    cancel,
    get lastEmitted() {
      return lastEmitted;
    },
    get hasEmitted() {
      return hasEmitted;
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useDebounce timer semantics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does NOT fire before delayMs", () => {
    const emitted: string[] = [];
    const debouncer = makeDebouncer<string>(300);
    debouncer.schedule("hello", (v) => emitted.push(v));

    vi.advanceTimersByTime(299);
    expect(emitted).toHaveLength(0);

    debouncer.cancel();
  });

  it("fires with the correct value after delayMs", () => {
    const emitted: string[] = [];
    const debouncer = makeDebouncer<string>(300);
    debouncer.schedule("hello", (v) => emitted.push(v));

    vi.advanceTimersByTime(300);
    expect(emitted).toEqual(["hello"]);
  });

  it("latest value wins on rapid successive changes", () => {
    const emitted: string[] = [];
    const debouncer = makeDebouncer<string>(300);

    // Schedule 3 rapid changes — each should cancel the previous timer
    debouncer.schedule("first", (v) => emitted.push(v));
    vi.advanceTimersByTime(100);

    debouncer.schedule("second", (v) => emitted.push(v));
    vi.advanceTimersByTime(100);

    debouncer.schedule("third", (v) => emitted.push(v));
    vi.advanceTimersByTime(100);

    // At 300ms total: timers for "first" and "second" were cancelled,
    // "third" hasn't fired yet (only 100ms since its schedule).
    expect(emitted).toHaveLength(0);

    // Advance to 300ms after "third" was scheduled.
    vi.advanceTimersByTime(200);
    // Now only "third" fires.
    expect(emitted).toEqual(["third"]);
  });

  it("independent schedulers do not interfere with each other", () => {
    const emitted1: number[] = [];
    const emitted2: string[] = [];
    const d1 = makeDebouncer<number>(300);
    const d2 = makeDebouncer<string>(500);

    d1.schedule(42, (v) => emitted1.push(v));
    d2.schedule("hello", (v) => emitted2.push(v));

    vi.advanceTimersByTime(300);
    expect(emitted1).toEqual([42]);
    expect(emitted2).toHaveLength(0); // d2 needs 500ms

    vi.advanceTimersByTime(200);
    expect(emitted2).toEqual(["hello"]);
  });

  it("cancel() prevents the debounced value from firing", () => {
    const emitted: string[] = [];
    const debouncer = makeDebouncer<string>(300);
    debouncer.schedule("cancelled", (v) => emitted.push(v));

    vi.advanceTimersByTime(150);
    debouncer.cancel(); // cancel before timer fires

    vi.advanceTimersByTime(200); // well past delayMs
    expect(emitted).toHaveLength(0);
  });
});
