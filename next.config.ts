import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  // Lets a production build run without disturbing a running dev server: NEXT_DIST_DIR=.next-build npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["archiver", "@node-rs/argon2"],
};
export default config;
