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
import { getStarBand, buildStarGlyphs } from "@/lib/report/star-band";
import { STAR_BAND_HEX } from "@/lib/report/colors";
import { groupByMeasure } from "@/lib/report/chart-utils";
import { buildChartData, renderChartSvgString } from "@/lib/charts/chart-svg";
import { svgToPngBuffer } from "@/lib/charts/rasterize";
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
// buildStarRunXml — OOXML <w:r> fragment for a star rating value cell (D-11)
// ---------------------------------------------------------------------------

/**
 * Star row labels — the 4 label-cell texts that trigger star OOXML injection.
 * These MUST match the left-cell text in the template exactly.
 */
const STAR_ROW_LABELS = [
  "Overall Star Rating",
  "Health Inspection",
  "Staffing",
  "Quality of Resident Care",
] as const;

/**
 * Builds a colored OOXML <w:r> run fragment for a star rating value cell.
 *
 * null → grey (#9ca3af) "N/A" run (D-06).
 * 1–5 → band-hex colored run with Unicode glyphs + " N/5".
 *
 * Security (T-7-02): only closed-enum hex strings (from getStarBand + STAR_BAND_HEX)
 * and an integer rating are interpolated — no client free-text reaches this fragment.
 * Unicode ★/☆ are literal Unicode in the text node — NOT routed through xmlEsc
 * (Pitfall 7: xmlEsc only escapes XML specials &<>"'; it does not touch Unicode).
 * CR-01: callers MUST inject this fragment via callback-form .replace(), never string-form.
 */
function buildStarRunXml(rating: number | null): string {
  if (rating === null) {
    return `<w:r><w:rPr><w:color w:val="9ca3af"/></w:rPr><w:t>N/A</w:t></w:r>`;
  }
  const band = getStarBand(rating);
  // STAR_BAND_HEX values are closed-enum hex strings — strip the leading "#" for w:val.
  const hex = STAR_BAND_HEX[band].slice(1); // e.g. "#16a34a" → "16a34a"
  const glyphs = buildStarGlyphs(rating);
  // xml:space="preserve" keeps the space between glyphs and the "N/5" number.
  return `<w:r><w:rPr><w:color w:val="${hex}"/></w:rPr><w:t xml:space="preserve">${glyphs} ${rating}/5</w:t></w:r>`;
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
  //
  //    STAR ROW INJECTION (D-11 / T-7-02): The 4 rating rows are handled via a
  //    SEPARATE path inside this loop to bypass xmlEsc() and inject pre-built OOXML
  //    <w:r> runs (buildStarRunXml). Routing the star OOXML fragment through xmlEsc
  //    would escape the run tags as literal text, corrupting the output (Pitfall 7).
  //    CR-01: all .replace() calls that inject star fragments use callback form.
  const STAR_ROW_SET = new Set<string>(STAR_ROW_LABELS);
  const STAR_RATING_MAP: Record<string, number | null> = {
    "Overall Star Rating": vm.facility.starRatings.overall,
    "Health Inspection": vm.facility.starRatings.healthInspection,
    Staffing: vm.facility.starRatings.staffing,
    "Quality of Resident Care": vm.facility.starRatings.qualityCare,
  };

  xml = xml.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (row) => {
    const tMatches = [...row.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];
    if (tMatches.length !== 2) return row; // not a label|value row

    const label = xmlDecode(tMatches[0][1]).trim();

    // Star row path — inject colored OOXML run instead of plain xmlEsc text.
    if (STAR_ROW_SET.has(label)) {
      const rating = STAR_RATING_MAP[label] ?? null;
      const starFragment = buildStarRunXml(rating);

      // Find the second <w:tc> (value cell) and replace ALL its <w:r>…</w:r> runs
      // with a single star run. This ensures no leftover placeholder text survives.
      // Split on the second <w:tc> start tag — the second cell holds the value.
      const tcMatches = [...row.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)];
      if (tcMatches.length >= 2) {
        const originalTc = tcMatches[1][0];
        // Replace all <w:r>…</w:r> blocks inside the value cell with the star run.
        // CR-01: callback form so any `$` in starFragment is literal.
        let newTc = originalTc.replace(
          /(<w:r\b[\s\S]*?<\/w:r>)+/,
          () => starFragment,
        );
        // STAR-ALIGN-01: Normalize <w:ind> in the paragraph properties of the value cell.
        // The 4 star rows in the template have inconsistent (or missing) <w:ind> values:
        //   Overall Star Rating: w:left="152"   Health Inspection: w:left="152"
        //   Staffing: w:left="132"              Quality of Resident Care: (no <w:ind> at all)
        // This causes the Quality row stars to left-align differently from the others.
        // Fix: replace any existing <w:ind .../> with w:left="0" w:firstLine="0", or
        // insert one if absent, so all 4 star rows start from the same indent position
        // (effectively: rely on cell padding, not paragraph indent, for star placement).
        if (/<w:ind\b/.test(newTc)) {
          // Replace existing <w:ind .../> with zeroed indent (CR-01: no user text in this op)
          newTc = newTc.replace(
            /<w:ind\b[^/]*\/>/g,
            () => '<w:ind w:left="0" w:firstLine="0"/>',
          );
        } else {
          // No <w:ind> — insert one with zero indent before </w:pPr>
          newTc = newTc.replace(
            "</w:pPr>",
            () => '<w:ind w:left="0" w:firstLine="0"/></w:pPr>',
          );
        }
        // CR-01: callback form for the outer row replacement.
        return row.replace(originalTc, () => newTc);
      }
      // Fallback if cell structure doesn't match expectation: fill via text path.
      const originalValTag = tMatches[1][0];
      const fallback = formatRating(rating);
      const newValTag = originalValTag.replace(
        /(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/,
        (_m, open, close) => `${open}${xmlEsc(fallback)}${close}`,
      );
      return row.replace(originalValTag, () => newValTag);
    }

    // Use MAP value if label matches; default to "—" so no placeholder survives.
    const value = label in MAP ? MAP[label] : "—";

    // Replace only the second <w:t>…</w:t> (the value cell).
    // IMPORTANT: both .replace() calls use the CALLBACK (function) form so that any
    // `$` characters in the replacement string are treated literally. If the string
    // form were used, JavaScript's replacement-pattern metacharacters ($&, $`, $',
    // $$, $1…) would be re-expanded against the match, corrupting OOXML whenever a
    // user input contains a dollar sign (e.g. "Cost: $5/visit"). The callback return
    // value is always taken verbatim — no `$` interpretation (CR-01).
    const originalValTag = tMatches[1][0];
    const newValTag = originalValTag.replace(
      /(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/,
      (_m, open, close) => `${open}${xmlEsc(value)}${close}`,
    );
    // Second callback: prevent any `$` surviving in newValTag from being re-expanded
    // when inserting newValTag into the full row string (CR-01).
    return row.replace(originalValTag, () => newValTag);
  });

  // 7. Replace standalone {STATE} placeholder (appears once, outside the table, under the title).
  const stateLine = vm.header.stateLine;
  xml = xml.split("{STATE}").join(xmlEsc(stateLine));

  // 8. Build the footer paragraph (clickable CMS hyperlink + processing date).
  //    This paragraph is injected AFTER the chart grid in step 10 so the final
  //    document order is: …body… → chart grid → footer → <w:sectPr>.
  //    (Previously step 8 injected it before <w:sectPr> and step 10 inserted charts
  //    before the same <w:sectPr>, which placed charts AFTER footer. Fixed here.)
  const f = vm.facility;
  const footerP =
    `<w:p><w:pPr><w:spacing w:before="200"/><w:tabs><w:tab w:val="right" w:pos="9600"/></w:tabs></w:pPr>` +
    `<w:hyperlink r:id="rIdCmsLink"><w:r><w:rPr><w:color w:val="1d4ed8"/><w:u w:val="single"/><w:rtl w:val="0"/></w:rPr>` +
    `<w:t xml:space="preserve">View official CMS profile on Medicare.gov</w:t></w:r></w:hyperlink>` +
    `<w:r><w:rPr><w:color w:val="9ca3af"/><w:rtl w:val="0"/></w:rPr><w:tab/>` +
    `<w:t xml:space="preserve">CMS dataset processing date: ${xmlEsc(formatDate(f.processingDate))}</w:t></w:r></w:p>`;

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
  // IMPORTANT: callback form so any `$` in xmlEsc(f.careCompareUrl) is not interpreted
  // as a replacement-pattern metacharacter (CR-01). The careCompareUrl path segment
  // comes from the CCN (z.string()), and while the URL refine checks protocol + hostname,
  // it does not constrain the path — a `$` there would corrupt the rels XML if we used
  // string-form replacement.
  const relXml = `<Relationship Id="rIdCmsLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEsc(f.careCompareUrl)}" TargetMode="External"/>`;
  rels = rels.replace("</Relationships>", () => relXml + "</Relationships>");
  // Note: rels is written to zip after the optional chart-image rels are added (step 10).

  // 10. Embed chart PNGs in a 2×2 OOXML table (D-11 / T-7-04 / T-7-05 / DOCX-01).
  //
  //     Security (T-7-04): SVG is generated purely from validated vm.hospMetrics numeric
  //     values and closed-enum CHART_SERIES colors — no user-controlled string reaches the SVG.
  //     Size (T-7-05 / DOCX-01): 4 charts well within the 4.5 MB limit.
  //     CR-01: all .replace() calls injecting chart XML use callback form.
  //
  //     DOCX-GRID-01: a proper <w:tblGrid> with two <w:gridCol> entries + <w:tblLayout
  //     w:type="fixed"/> is required — omitting it collapses columns to zero width.
  //
  //     Sharpness: SVG is rasterized at 2× the display pixel size so the PNG has enough
  //     DPI for crisp rendering. The EMU extents use the display (logical) size, NOT the
  //     upscaled pixel count (DOCX-EMU-01).
  //
  //     Footer order: chartGrid + footerP are injected together before <w:sectPr>, so the
  //     document order is: …body… → chart grid → footer → <w:sectPr>.
  if (vm.hospMetrics && vm.hospMetrics.length > 0) {
    const groups = groupByMeasure(vm.hospMetrics);

    // Display size (logical pixels for EMU calculation)
    const DISPLAY_W_PX = 280;
    const DISPLAY_H_PX = 140;
    // Raster at 2× for sharpness; EMU uses display size (not raster size)
    const RASTER_W_PX = DISPLAY_W_PX * 2;
    const RASTER_H_PX = DISPLAY_H_PX * 2;
    // EMU = logical pixels × 9525 (DOCX-EMU-01)
    const CHART_EMU_W = DISPLAY_W_PX * 9525;
    const CHART_EMU_H = DISPLAY_H_PX * 9525;

    // Page content width ≈ 12240 dxa (US Letter minus 1″ margins each side).
    // Two columns of equal width: 6120 dxa each.
    const COL_DXA = 6120;

    // Relationship type URI for images
    const IMG_REL_TYPE =
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

    // Guard: assert our chart relationship IDs are not pre-existing in the template rels.
    for (let i = 0; i < groups.length; i++) {
      const rId = `rIdChart${i}`;
      if (rels.includes(`Id="${rId}"`)) {
        throw new Error(
          `Template already contains a relationship with Id=${rId} — guard triggered; template may have changed.`,
        );
      }
    }

    // Collect cell XML for each chart (one per group slot, "" for suppressed)
    const cellXmls: string[] = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const chartData = buildChartData(group);

      if (chartData.length === 0) {
        // All-suppressed — empty cell with N/A text
        cellXmls.push(
          `<w:tc><w:tcPr><w:tcW w:w="${COL_DXA}" w:type="dxa"/></w:tcPr>` +
            `<w:p><w:r><w:t>N/A</w:t></w:r></w:p></w:tc>`,
        );
        continue;
      }

      const svg = renderChartSvgString(
        chartData,
        RASTER_W_PX,
        RASTER_H_PX,
        group.label,
      );
      if (!svg || !svg.includes("<svg")) {
        cellXmls.push(
          `<w:tc><w:tcPr><w:tcW w:w="${COL_DXA}" w:type="dxa"/></w:tcPr>` +
            `<w:p><w:r><w:t>N/A</w:t></w:r></w:p></w:tc>`,
        );
        continue;
      }

      const png = svgToPngBuffer(svg, RASTER_W_PX, RASTER_H_PX);

      // Add PNG to word/media/
      const mediaPath = `word/media/chart-${i}.png`;
      zip.file(mediaPath, png);

      // Add Image relationship to rels
      const rId = `rIdChart${i}`;
      const relEntry = `<Relationship Id="${rId}" Type="${IMG_REL_TYPE}" Target="media/chart-${i}.png"/>`;
      // CR-01: callback form
      rels = rels.replace(
        "</Relationships>",
        () => relEntry + "</Relationships>",
      );

      // Build inline <w:drawing> OOXML for this chart cell.
      // EMU values use DISPLAY size (not RASTER size) — DOCX-EMU-01.
      const drawingXml =
        `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
        `<wp:extent cx="${CHART_EMU_W}" cy="${CHART_EMU_H}"/>` +
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
        `<wp:docPr id="${10 + i}" name="chart-${i}"/>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:nvPicPr><pic:cNvPr id="${10 + i}" name="chart-${i}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill>` +
        `<a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
        `<a:stretch><a:fillRect/></a:stretch>` +
        `</pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${CHART_EMU_W}" cy="${CHART_EMU_H}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
        `</pic:pic></a:graphicData></a:graphic></wp:inline>`;

      cellXmls.push(
        `<w:tc><w:tcPr><w:tcW w:w="${COL_DXA}" w:type="dxa"/></w:tcPr>` +
          `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>` +
          `<w:r><w:rPr/><w:drawing>${drawingXml}</w:drawing></w:r></w:p></w:tc>`,
      );
    }

    // Pad cellXmls to even length so every row has 2 cells
    while (cellXmls.length % 2 !== 0) {
      cellXmls.push(
        `<w:tc><w:tcPr><w:tcW w:w="${COL_DXA}" w:type="dxa"/></w:tcPr>` +
          `<w:p><w:r><w:t></w:t></w:r></w:p></w:tc>`,
      );
    }

    // Build 2×2 OOXML table rows
    let tableRows = "";
    for (let row = 0; row < cellXmls.length / 2; row++) {
      const left = cellXmls[row * 2];
      const right = cellXmls[row * 2 + 1];
      tableRows += `<w:tr>${left}${right}</w:tr>`;
    }

    // DOCX-GRID-01: <w:tblGrid> with two <w:gridCol> entries + <w:tblLayout w:type="fixed"/>
    // prevents column collapse. Without tblGrid, Word ignores cell widths and collapses to 0.
    const chartTable =
      `<w:tbl>` +
      `<w:tblPr>` +
      `<w:tblStyle w:val="TableGrid"/>` +
      `<w:tblW w:w="${COL_DXA * 2}" w:type="dxa"/>` +
      `<w:tblLayout w:type="fixed"/>` +
      `<w:tblLook w:val="0000"/>` +
      `</w:tblPr>` +
      `<w:tblGrid>` +
      `<w:gridCol w:w="${COL_DXA}"/>` +
      `<w:gridCol w:w="${COL_DXA}"/>` +
      `</w:tblGrid>` +
      tableRows +
      `</w:tbl>`;

    // Inject chart table + footer before <w:sectPr> (CR-01 callback form).
    // Order: chart grid → footer paragraph → <w:sectPr>
    const inject = chartTable + footerP;
    xml = xml.replace("<w:sectPr>", () => inject + "<w:sectPr>");
  } else {
    // No charts — just inject the footer before <w:sectPr> (CR-01 callback form).
    xml = xml.replace("<w:sectPr>", () => footerP + "<w:sectPr>");
  }

  // Write rels — includes rIdCmsLink (step 9) + chart image rels (step 10, if any).
  zip.file("word/_rels/document.xml.rels", rels);

  // 11. Write the modified XML back into the zip and re-serialize.
  zip.file("word/document.xml", xml);

  const bytes = await zip.generateAsync({ type: "uint8array" });
  return bytes;
}
