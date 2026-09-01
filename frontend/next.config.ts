import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Exports /login as login/index.html. Without it the export is login.html,
  // which the backend's StaticFiles mount does not find, and a direct visit to
  // /login/ 404s.
  trailingSlash: true,
};

export default nextConfig;
