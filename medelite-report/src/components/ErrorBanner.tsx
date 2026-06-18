"use client";

// ErrorBanner.tsx — Top-of-page alert banner for system / transient errors.
//
// D-07: Banner errors are network_error, cms_api_error, and validation_error.
//   The parent (SnapshotApp) decides which error kind goes here vs inline in
//   CCNSearchBar. This component only handles the rendering.
//
// T-03-08: Only getErrorPresentation().message (UI-authored copy) is rendered —
//   no raw server message, no Zod internals reach the user.

import type { CmsApiError } from "@/lib/cms/errors";
import { getErrorPresentation } from "@/lib/ui/error-presentation";

interface Props {
  /** Banner-kind CmsApiError to display. */
  error: CmsApiError;
}

/**
 * Top-of-page alert banner for network/CMS/validation errors.
 *
 * Placement: rendered ABOVE the CCNSearchBar in the left pane.
 * Only rendered when the error's placement is 'banner' (D-07) —
 * the parent is responsible for only passing banner-kind errors.
 */
export function ErrorBanner({ error }: Props) {
  const { message } = getErrorPresentation(error);
  return (
    <div
      role="alert"
      className="rounded bg-red-50 border border-red-200 p-4 text-red-800 text-sm"
    >
      <strong className="font-semibold">Error: </strong>
      {message}
    </div>
  );
}
