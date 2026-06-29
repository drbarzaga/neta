import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El proyecto vive en /Develop/finanzas; fijamos la raíz para que Turbopack
  // no infiera el directorio padre (que tiene otro lockfile).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
