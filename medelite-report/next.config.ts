import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // D-25: opt @react-pdf/renderer out of the Server Components bundle.
  // @react-pdf/renderer is already on Next.js 16's auto-opt-out list, but we add it
  // explicitly as a defensive measure against Turbopack bug #88844, which can omit
  // auto-opted packages from standalone builds. Key name is 'serverExternalPackages'
  // (renamed from 'serverComponentsExternalPackages' at Next.js 15.0.0 — the old key
  // is silently ignored in NJS16).
  //
  // Source: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
