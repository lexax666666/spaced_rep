import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // One self-contained server bundle, so the same image runs in every environment.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default config;
