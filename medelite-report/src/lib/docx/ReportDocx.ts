// ReportDocx.ts — Template-fill Word document builder (D-06 pivot).
//
// Instead of rebuilding the document from scratch with docx primitives (which caused
// format bugs — image pixel/EMU errors, tblGrid column collapse), we fill the official
// "Facility Assessment Snapshot" Word template by manipulating its OOXML XML directly.
//
// Approach:
//   1. Decode the base64 template (FACILITY_TEMPLATE_DOCX_BASE64) into a zip buffer.
//   2. Open word/document.xml via JSZip.
//   3. Strip the 12 yellow cell shading markers (w:fill="ffff00") that CMS used as
//      fill-from-API markers — removed for visual parity with the PDF/web preview.
//   4. Match each 2-cell table row by its left-cell label text; replace the right-cell
//      <w:t> content with the corresponding ReportViewModel value.
//   5. Replace the {STATE} standalone placeholder paragraph.
//   6. Re-serialize and return the modified zip as a Uint8Array.
//
// Design constraints:
//   CLAUDE.md rule #2: header branding is the STATIC INFINITE / Managed-by-MEDELITE
//     logo image — already in the template; NEVER derived from or replaced by the
//     facility name. vm.facility.displayName appears ONLY in the body "Name of Facility"
//     row and the Document title metadata.
//
//   NO "use client" — this file is server-only. Import only from route handlers.
//   The JSZip and Buffer APIs are Node-only; never include in client bundles.

import JSZip from "jszip";
import {
  formatRating,
  formatBeds,
  formatLocation,
  formatPercent,
  formatRate,
  formatFootnote,
  formatDate,
} from "@/lib/report/format";
import { FACILITY_TEMPLATE_DOCX_BASE64 } from "@/lib/docx/template";
import type { ReportViewModel } from "@/lib/report/view-model";
import type { HospMetric } from "@/lib/cms/types";

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

/** Escape special XML characters for safe injection into w:t text content. */
function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Reverse XML escape so we can compare the decoded label against our MAP keys. */
function xmlDecode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ---------------------------------------------------------------------------
// renderMetricValue — same rule as the old ReportDocx (D-08)
// ---------------------------------------------------------------------------

function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === "percent" ? formatPercent(m.value) : formatRate(m.value);
}

// ---------------------------------------------------------------------------
// buildValueMap — build label → display string from the ReportViewModel
// ---------------------------------------------------------------------------

function buildValueMap(vm: ReportViewModel): Record<string, string> {
  const f = vm.facility;
  const m = vm.manual;

  const map: Record<string, string> = {
    "Name of Facility": f.displayName,
    Location: formatLocation(f.address),
    EMR: m.emr ?? "—",
    "Census Capacity": formatBeds(f.certifiedBeds),
    "Current Census": m.currentCensus != null ? String(m.currentCensus) : "—",
    "Type of Patient": m.typeOfPatient ?? "—",
    "Previous Coverage from Medelite": m.previousCoverage ?? "—",
    "Previous Provider Performance from Medelite":
      m.previousProviderPerformance ?? "—",
    "Medical Coverage": m.medicalCoverage ?? "—",
    "Overall Star Rating": formatRating(f.starRatings.overall),
    "Health Inspection": formatRating(f.starRatings.healthInspection),
    Staffing: formatRating(f.starRatings.staffing),
    "Quality of Resident Care": formatRating(f.starRatings.qualityCare),
  };

  // If hospMetrics is present, add the 12 metric rows.
  // If absent (D-09 degraded path), leave them out — the fill loop will default to "—".
  if (vm.hospMetrics !== undefined) {
    for (const metric of vm.hospMetrics) {
      map[metric.label] = renderMetricValue(metric);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// buildReportDocxBuffer — exported server-only builder
// ---------------------------------------------------------------------------

/**
 * Fills the official "Facility Assessment Snapshot" Word template with values
 * from a validated ReportViewModel and returns the resulting .docx as a Uint8Array.
 *
 * Server-only: must never be imported by a client component.
 * Uses JSZip + OOXML XML manipulation (no docx-primitive rebuilding).
 *
 * @param vm — The validated ReportViewModel (already passed through ReportViewModelSchema).
 * @returns Promise<Uint8Array> — the filled .docx file bytes.
 */
export async function buildReportDocxBuffer(
  vm: ReportViewModel,
): Promise<Uint8Array> {
  // 1. Decode template from base64 into a Node Buffer.
  const templateBuffer = Buffer.from(FACILITY_TEMPLATE_DOCX_BASE64, "base64");

  // 2. Open as a JSZip archive.
  const zip = await JSZip.loadAsync(templateBuffer);

  // 3. Read word/document.xml.
  const docEntry = zip.file("word/document.xml");
  if (!docEntry) {
    throw new Error(
      "Template is corrupt: word/document.xml not found in the DOCX archive.",
    );
  }
  let xml = await docEntry.async("string");

  // 4. Build the label → value map.
  const MAP = buildValueMap(vm);

  // 5. Strip yellow shading markers (12× in the template — CMS fill-from-API markers).
  //    Removed for visual parity: the PDF/web preview have no yellow, so the docx should not either.
  xml = xml.replace(/<w:shd\b[^>]*w:fill="ffff00"[^>]*\/>/gi, "");

  // 6. Fill each 2-cell table row by matching the left-cell label.
  //    Rows with exactly 2 <w:t> tags: first = label, second = value placeholder.
  //    Rows with ≠ 2 <w:t> tags (header rows, merged cells) are left unchanged.
  xml = xml.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (row) => {
    const tMatches = [...row.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];
    if (tMatches.length !== 2) return row; // not a label|value row

    const label = xmlDecode(tMatches[0][1]).trim();
    // Use MAP value if label matches; default to "—" so no placeholder survives.
    const value = label in MAP ? MAP[label] : "—";

    // Replace only the second <w:t>…</w:t> (the value cell).
    const originalValTag = tMatches[1][0];
    const newValTag = originalValTag.replace(
      /(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/,
      `$1${xmlEsc(value)}$2`,
    );
    return row.replace(originalValTag, newValTag);
  });

  // 7. Replace standalone {STATE} placeholder (appears once, outside the table, under the title).
  const stateLine = vm.header.stateLine;
  xml = xml.split("{STATE}").join(xmlEsc(stateLine));

  // 8. Inject a footer paragraph (clickable CMS hyperlink + processing date) immediately
  //    before the body-level <w:sectPr> (there is exactly one in this template).
  //    The hyperlink references rIdCmsLink, added to word/_rels/document.xml.rels below.
  //    Guards:
  //      - Template always has exactly one body-level <w:sectPr> (verified at build time).
  //      - rIdCmsLink must NOT already be present in the template rels (guard below fails loudly).
  const f = vm.facility;
  const footerP =
    `<w:p><w:pPr><w:spacing w:before="200"/></w:pPr>` +
    `<w:hyperlink r:id="rIdCmsLink"><w:r><w:rPr><w:color w:val="1d4ed8"/><w:u w:val="single"/><w:rtl w:val="0"/></w:rPr>` +
    `<w:t xml:space="preserve">View official CMS profile on Medicare.gov</w:t></w:r></w:hyperlink>` +
    `<w:r><w:rPr><w:color w:val="9ca3af"/><w:rtl w:val="0"/></w:rPr>` +
    `<w:t xml:space="preserve">   CMS dataset processing date: ${xmlEsc(formatDate(f.processingDate))}</w:t></w:r></w:p>`;
  xml = xml.replace("<w:sectPr>", footerP + "<w:sectPr>");

  // 9. Add the External hyperlink relationship for the CMS link to document.xml.rels.
  //    Guard: assert rIdCmsLink is not already present so we fail loudly if the template changes.
  const relsEntry = zip.file("word/_rels/document.xml.rels");
  if (!relsEntry) {
    throw new Error(
      "Template is corrupt: word/_rels/document.xml.rels not found in the DOCX archive.",
    );
  }
  let rels = await relsEntry.async("string");
  if (rels.includes('Id="rIdCmsLink"')) {
    throw new Error(
      "Template already contains a relationship with Id=rIdCmsLink — guard triggered; template may have changed.",
    );
  }
  rels = rels.replace(
    "</Relationships>",
    `<Relationship Id="rIdCmsLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEsc(f.careCompareUrl)}" TargetMode="External"/></Relationships>`,
  );
  zip.file("word/_rels/document.xml.rels", rels);

  // 10. Write the modified XML back into the zip and re-serialize.
  zip.file("word/document.xml", xml);

  const bytes = await zip.generateAsync({ type: "uint8array" });
  return bytes;
}
