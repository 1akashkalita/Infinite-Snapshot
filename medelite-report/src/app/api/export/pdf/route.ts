// app/api/export/pdf/route.ts — PDF export stub (D-20 / D-21).
//
// Accepts POST with a full ReportViewModel body. Validates using ReportViewModelSchema (D-21).
// Bad shape → 400 invalid_request (no Zod internals in response body — D-05 discipline).
// Valid body → 501 not_implemented (Phase 4 replaces this 501 with renderToBuffer).
//
// export const runtime = 'nodejs': explicit Node.js runtime (D-25) — required for any route
// that will later import @react-pdf/renderer. Documents intent and future-proofs against Edge.

import { ReportViewModelSchema } from "@/lib/report/view-model";

/** D-25: explicit Node.js runtime for routes that will touch @react-pdf/renderer (Phase 4). */
export const runtime = "nodejs";

/**
 * POST /api/export/pdf — PDF export stub.
 *
 * Phase 2: validates the incoming ReportViewModel body (D-20/D-21).
 * Phase 4: swaps the 501 response for renderToBuffer + a real PDF stream.
 */
export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json();
  const parseResult = ReportViewModelSchema.safeParse(body);

  if (!parseResult.success) {
    // D-21 / D-05: return a clean error envelope — NO Zod internals (paths, issues, codes).
    // Full validation details go to server logs only (same discipline as the facility route).
    return Response.json(
      {
        error: {
          kind: "invalid_request",
          message: "Invalid report data.",
        },
      },
      { status: 400 },
    );
  }

  // Phase 4 replaces this stub with:
  //   const pdfBuffer = await renderToBuffer(<ReportPDF vm={parseResult.data} />)
  //   return new Response(pdfBuffer, { headers: { 'Content-Type': 'application/pdf' } })
  return Response.json(
    {
      error: {
        kind: "not_implemented",
        message: "PDF export coming soon.",
      },
    },
    { status: 501 },
  );
}
