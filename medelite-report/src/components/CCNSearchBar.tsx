'use client';

// CCNSearchBar.tsx — CCN input form with client-side format pre-check and inline error display.
//
// D-05 / LOOK-02: The client pre-check gates on isValidCcnFormat BEFORE any fetch.
//   If the format is invalid, onSearch is NEVER called. This avoids a round-trip for
//   obviously malformed input.
//
// D-07: Inline errors (invalid_ccn from local check, not_found from server) appear
//   beneath the input field via a role="alert" paragraph. Banner-kind errors (network,
//   cms_api_error, validation_error) are handled by ErrorBanner in the parent.
//
// PITFALLS.md Pitfall 2: Input is type="text" — NEVER type="number".
//   type="number" strips leading zeros (CCN "012345" would become 12345).
//
// T-03-08: Only getErrorPresentation().message (UI-authored copy) is rendered —
//   no raw server message, no Zod internals.

import { useState } from 'react';
import type { CmsApiError } from '@/lib/cms/errors';
import { normalizeCcn, isValidCcnFormat } from '@/lib/ui/ccn';
import { getErrorPresentation } from '@/lib/ui/error-presentation';

interface Props {
  /** Called with the normalized CCN when the format is valid. */
  onSearch: (ccn: string) => void;
  /** True while a fetch is in progress — disables the submit button. */
  loading: boolean;
  /**
   * Inline error from the parent (not_found or invalid_ccn from the server).
   * Banner-kind errors are rendered by ErrorBanner, not here.
   */
  inlineError: CmsApiError | null;
}

/**
 * CCN search form with a text input, Generate button, and an inline error region.
 *
 * The component owns localError (format pre-check) and delegates server-returned
 * inline errors (inlineError prop) to the same inline region.
 *
 * Props contract:
 *   onSearch — called only when the local format check passes (D-05)
 *   loading  — disables the button during a pending fetch
 *   inlineError — parent-managed server error for inline display
 */
export function CCNSearchBar({ onSearch, loading, inlineError }: Props) {
  const [ccn, setCcn] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalized = normalizeCcn(ccn);
    if (!isValidCcnFormat(normalized)) {
      // D-05 / LOOK-02: gate BEFORE any fetch; never call onSearch for a bad format
      setLocalError('CCN must be exactly 6 letters or numbers.');
      return;
    }
    // Format passed — clear local error and delegate to parent
    setLocalError(null);
    onSearch(normalized);
  };

  // Resolve the displayed inline error:
  // local format error takes precedence; otherwise show the server-returned inline error.
  const displayedError: string | null =
    localError ??
    (inlineError ? getErrorPresentation(inlineError).message : null);

  const errorId = 'ccn-error';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="ccn-input" className="text-sm font-medium text-zinc-700">
        CMS Certification Number (CCN)
      </label>
      <div className="flex gap-2">
        <input
          id="ccn-input"
          type="text"
          // NEVER type="number" — leading zeros would be stripped (PITFALLS Pitfall 2)
          inputMode="numeric"
          value={ccn}
          onChange={(e) => {
            setCcn(e.target.value);
            setLocalError(null); // clear local error on any keystroke
          }}
          placeholder="Enter CCN (e.g. 686123)"
          maxLength={10}
          className={[
            'flex-1 rounded-md border px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            displayedError
              ? 'border-red-400 bg-red-50'
              : 'border-zinc-300 bg-white',
          ].join(' ')}
          aria-describedby={displayedError ? errorId : undefined}
          aria-invalid={displayedError ? 'true' : undefined}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={loading}
          className={[
            'rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors',
            loading
              ? 'cursor-not-allowed bg-blue-300'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
          ].join(' ')}
        >
          {loading ? 'Loading…' : 'Generate'}
        </button>
      </div>

      {/* Inline error region — D-07: invalid_ccn and not_found surface here */}
      {displayedError && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-600 mt-1"
        >
          {displayedError}
        </p>
      )}
    </form>
  );
}
