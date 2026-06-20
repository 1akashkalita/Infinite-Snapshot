import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // D-25: opt @react-pdf/renderer out of the Server Components bundle.
  // @react-pdf/renderer is already on Next.js 16's auto-opt-out list, but we add it
  // explicitly as a defensive measure against Turbopack bug #88844, which can omit
  // auto-opted packages from standalone builds. Key name is 'serverExternalPackages'
  // (renamed from 'serverComponentsExternalPackages' at Next.js 15.0.0 — the old key
  // is silently ignored in NJS16).
  //
  // @resvg/resvg-js uses a NAPI .node binary (platform-specific native module) and is
  // NOT in Next.js's auto-external list (verified: only @react-pdf/renderer, canvas, and
  // sharp appear in node_modules/next/dist/lib/server-external-packages.jsonc). Without
  // this entry, Next.js/Turbopack would attempt to bundle the .node binary at build time,
  // which fails — the binary cannot be bundled and must be loaded at runtime from
  // node_modules (Pitfall 2 / RESEARCH.md §New Package Required). Verify after any config
  // change with npm run verify:full (next build runs as part of the full gate).
  //
  // Source: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md
  serverExternalPackages: ["@react-pdf/renderer", "@resvg/resvg-js"],
};

export default nextConfig;
