// app/api/export/pdf/route.tsx — PDF export route (D-20 / D-21 / D-09).
//
// Accepts POST with a full ReportViewModel body. Validates using ReportViewModelSchema (D-21).
// Bad shape → 400 invalid_request (no Zod internals in response body — D-05 discipline).
// Valid body → renderToBuffer(<ReportPDF vm={parseResult.data} />) → 200 application/pdf (D-09).
//
// Phase 4: replaced the 501 not_implemented stub with a real renderToBuffer response.
//   - pdfBuffer = await renderToBuffer(<ReportPDF vm={parseResult.data} />)
//   - Content-Type: application/pdf
//   - Content-Disposition: attachment; filename=<slug(displayName, ccn)>-Snapshot.pdf (D-06)
//
// export const runtime = 'nodejs': explicit Node.js runtime (D-25) — required for routes
// that import @react-pdf/renderer (serverExternalPackages already configured in next.config.ts).

import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPDF } from "@/components/pdf/ReportPDF";
import { slugFilename } from "@/lib/report/slug";
import { ReportViewModelSchema } from "@/lib/report/view-model";

/** D-25: explicit Node.js runtime for routes that touch @react-pdf/renderer. */
export const runtime = "nodejs";

/**
 * POST /api/export/pdf — PDF export.
 *
 * Phase 2: validates the incoming ReportViewModel body (D-20/D-21).
 * Phase 4: renderToBuffer + Content-Disposition with slugged filename (D-09/D-06).
 */
export async function POST(request: Request): Promise<Response> {
  // A non-JSON body throws here; the route contract is 400 invalid_request for bad input,
  // not a bare 500. Same clean-envelope discipline as the parse-failure branch below.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
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

  // Phase 4: renderToBuffer + Content-Disposition filename (D-09 / D-06)
  // renderToBuffer returns a Node.js Buffer; convert to Uint8Array for the Web Response API
  // (Buffer extends Uint8Array at runtime; the cast is correct and lossless).
  const pdfBuffer = await renderToBuffer(<ReportPDF vm={parseResult.data} />);
  const filename = slugFilename(
    parseResult.data.facility.displayName,
    parseResult.data.facility.ccn,
  );
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
