import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that must not be bundled by Next.js
  serverExternalPackages: ["nodemailer", "web-push"],
};

export default nextConfig;
