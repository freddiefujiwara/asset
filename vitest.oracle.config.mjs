import { defineConfig } from "vitest/config";

// Dedicated config for the Lean-oracle differential tests.
// Kept out of vite.config.js so the default suite (and its 100%
// coverage thresholds over src/) never sees these files.
export default defineConfig({
  test: {
    environment: "node",
    include: ["oracle/**/*.test.js"],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
