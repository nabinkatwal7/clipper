import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["archiver","@node-rs/argon2"],
};
export default config;
