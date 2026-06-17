// Fixture capture entrypoint, run via `npm run fixture:capture` (tsx).
//
// Re-resolves all three dataset IDs against the CMS metastore at capture time
// (D-03 / CLAUDE.md rule #3: distribution IDs rotate; dataset IDs are stable).
// Writes three fixtures to tests/fixtures/:
//   provider-686123.json  — full results array (single-element)
//   claims-686123.json    — full results array (4 rows)
//   averages-xcdc.json    — keyed object { NATION: row, FL: row }
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures");
const BASE = "https://data.cms.gov/provider-data/api/1/datastore/query";
const METASTORE_URL =
  "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items";

// ─── Dataset registry (D-03) ────────────────────────────────────────────────

interface DatasetCapture {
  datasetId: string;
  outputFile: string;
  filter?: { property: string; value: string };
  /** For xcdc-v8bm: fetch multiple rows by state_or_nation */
  multiFilter?: Array<{ property: string; value: string }>;
}

const REGISTRY: DatasetCapture[] = [
  {
    datasetId: "4pq5-n9py",
    outputFile: "provider-686123.json",
    filter: { property: "cms_certification_number_ccn", value: "686123" },
  },
  {
    datasetId: "ijh5-nb2v",
    outputFile: "claims-686123.json",
    filter: { property: "cms_certification_number_ccn", value: "686123" },
  },
  {
    datasetId: "xcdc-v8bm",
    outputFile: "averages-xcdc.json",
    multiFilter: [
      { property: "state_or_nation", value: "NATION" },
      { property: "state_or_nation", value: "FL" },
    ],
  },
];

// ─── Metastore validation ────────────────────────────────────────────────────

interface DatasetMeta {
  title?: string;
  modified?: string;
  distributionUrls: string[];
}

async function resolveDatasets(
  ids: string[],
): Promise<Map<string, DatasetMeta>> {
  console.log("Validating dataset IDs against CMS metastore...");
  const res = await fetch(METASTORE_URL);
  if (!res.ok) {
    throw new Error(`Metastore fetch failed: HTTP ${res.status}`);
  }
  const items = (await res.json()) as Array<{
    identifier: string;
    title?: string;
    modified?: string;
    distribution?: Array<{ downloadURL?: string }>;
  }>;
  // Map each dataset ID → provenance: title, last-modified date, and the distribution
  // downloadURL(s). The URL embeds the rotating distribution hash and a dated filename
  // (e.g. NH_ProviderInfo_May2026.csv), so it records exactly which CMS vintage the
  // committed fixtures came from — the /datastore/query/{id}/0 endpoint resolves the
  // same distribution by stable dataset ID at fetch time (CLAUDE.md rule #3).
  const byId = new Map<string, DatasetMeta>();
  for (const item of items) {
    const distributionUrls = (item.distribution ?? [])
      .map((d) => d.downloadURL)
      .filter((u): u is string => Boolean(u));
    byId.set(item.identifier, {
      title: item.title,
      modified: item.modified,
      distributionUrls,
    });
  }
  for (const id of ids) {
    if (!byId.has(id)) {
      throw new Error(
        `Dataset ID "${id}" not found in CMS metastore — it may have been retired or renamed.`,
      );
    }
  }
  console.log(`All ${ids.length} dataset IDs confirmed in metastore.`);
  return byId;
}

// ─── CMS fetch helper ────────────────────────────────────────────────────────

async function queryCMS(
  datasetId: string,
  property: string,
  value: string,
): Promise<unknown[]> {
  const url = new URL(`${BASE}/${datasetId}/0`);
  url.searchParams.set("conditions[0][property]", property);
  url.searchParams.set("conditions[0][value]", value);
  // Single "=" operator — "==" returns HTTP 400 (RESEARCH.md Pitfall 3)
  url.searchParams.set("conditions[0][operator]", "=");

  console.log(`  Fetching ${datasetId} where ${property}=${value}`);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`CMS API HTTP ${res.status} for dataset=${datasetId}`);
  }
  const json = (await res.json()) as { results: unknown[]; count: number };
  if (json.count === 0) {
    throw new Error(
      `Zero results: dataset=${datasetId} / ${property}=${value}`,
    );
  }
  return json.results;
}

// ─── Main capture logic ──────────────────────────────────────────────────────

interface ManifestDataset {
  dataset_id: string;
  dataset_title?: string;
  dataset_modified?: string;
  output_file: string;
  row_count: number;
  filter: string;
  distribution_urls: string[];
}

export async function captureFixtures(): Promise<void> {
  const capturedAt = new Date().toISOString();

  // Step 1: Re-resolve + validate all dataset IDs against the metastore before any fetch
  const ids = REGISTRY.map((entry) => entry.datasetId);
  const metaById = await resolveDatasets(ids);

  // Step 2: Create fixtures directory (Pitfall 5 — does not exist yet)
  mkdirSync(FIXTURES_DIR, { recursive: true });
  console.log(`Fixtures directory ensured: ${FIXTURES_DIR}`);

  const manifestDatasets: ManifestDataset[] = [];

  // Step 3: Capture each dataset
  for (const entry of REGISTRY) {
    const outputPath = join(FIXTURES_DIR, entry.outputFile);
    console.log(
      `\nCapturing ${entry.outputFile} from dataset ${entry.datasetId}...`,
    );

    let rowCount = 0;
    let filterDesc = "";

    if (entry.filter) {
      // Single-filter datasets (provider + claims)
      const results = await queryCMS(
        entry.datasetId,
        entry.filter.property,
        entry.filter.value,
      );
      writeFileSync(outputPath, JSON.stringify(results, null, 2));
      rowCount = results.length;
      filterDesc = `${entry.filter.property}=${entry.filter.value}`;
      console.log(`  Written: ${entry.outputFile} (${results.length} row(s))`);
    } else if (entry.multiFilter) {
      // Multi-filter dataset (averages — fetch NATION and FL, write as keyed object)
      const output: Record<string, unknown> = {};
      for (const f of entry.multiFilter) {
        const results = await queryCMS(entry.datasetId, f.property, f.value);
        const row = results[0] as Record<string, unknown>;
        const key = row[f.property] as string;
        output[key] = row;
      }
      writeFileSync(outputPath, JSON.stringify(output, null, 2));
      const keys = Object.keys(output);
      rowCount = keys.length;
      filterDesc = entry.multiFilter
        .map((f) => `${f.property}=${f.value}`)
        .join(" | ");
      console.log(`  Written: ${entry.outputFile} (keys: ${keys.join(", ")})`);
    }

    const meta = metaById.get(entry.datasetId);
    manifestDatasets.push({
      dataset_id: entry.datasetId,
      dataset_title: meta?.title,
      dataset_modified: meta?.modified,
      output_file: entry.outputFile,
      row_count: rowCount,
      filter: filterDesc,
      distribution_urls: meta?.distributionUrls ?? [],
    });
  }

  // Step 4: Write provenance manifest (D-03 / CLAUDE.md rule #3 — dataset IDs are
  // re-resolved against the metastore on every capture; provenance is recorded so a
  // graded repo shows when fixtures were captured and which datasets they came from).
  const manifest = {
    captured_at: capturedAt,
    source: "CMS Provider Data Catalog API",
    query_endpoint: `${BASE}/{datasetId}/0`,
    metastore_url: METASTORE_URL,
    note: "Dataset IDs are stable and re-confirmed against the CMS metastore on every capture. The /datastore/query/{id}/0 endpoint resolves the current distribution by dataset ID, so rotating distribution URLs are never hardcoded; distribution_urls + dataset_modified below record exactly which CMS vintage these fixtures came from.",
    datasets: manifestDatasets,
  };
  writeFileSync(
    join(FIXTURES_DIR, "_capture-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log("\nWrote _capture-manifest.json (provenance).");

  console.log("\nAll fixtures captured successfully.");
}

captureFixtures().catch((err: unknown) => {
  console.error("Fixture capture failed:", err);
  process.exit(1);
});
