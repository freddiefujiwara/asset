import { existsSync } from "node:fs";
import { describe, it, beforeAll, afterAll } from "vitest";
import { riskAssetSummary } from "../src/domain/holdings/engine.js";
import { Oracle } from "./oracle-client.mjs";
import { runDifferential } from "./run-differential.mjs";

const BIN = new URL("../lean_spec/.lake/build/bin/asset_oracle", import.meta.url).pathname;

// The Lean oracle binary is built by CI (or locally via
// `cd lean_spec && lake build`). Without it this suite skips, so the
// default `npm test` flow never depends on a Lean toolchain.
describe.skipIf(!existsSync(BIN))("differential: riskAssetSummary vs Lean oracle", () => {
  let oracle;
  beforeAll(() => {
    oracle = new Oracle(BIN);
  });
  afterAll(() => {
    oracle.close();
  });

  it("matches on 2000 random holdings", async () => {
    await runDifferential(riskAssetSummary, oracle, 2000);
  }, 180_000);
});
