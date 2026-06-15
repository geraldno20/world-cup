import type { NextConfig } from "next";

// Static export for GitHub Pages. Set NEXT_PUBLIC_BASE_PATH to "/<repo-name>"
// in CI; locally it's empty so `npm run dev` serves at /.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // better-sqlite3 has a native binding that webpack can't bundle.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
