import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite carrega fitxers WASM propis: no s'ha d'empaquetar
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
