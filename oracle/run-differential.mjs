import fc from "fast-check";
import { extractHoldings } from "./extract.mjs";
import { holdingsArb } from "./gen.mjs";

/**
 * Run the differential property for one engine implementation
 * (`riskAssetSummary`) against the Lean oracle.
 * Returns when every generated case matches; throws the fast-check
 * error (with the shrunk counterexample) on the first mismatch.
 */
export async function runDifferential(riskAssetSummary, oracle, numRuns) {
  await fc.assert(
    fc.asyncProperty(holdingsArb, async (holdings) => {
      const js = riskAssetSummary(holdings);
      const expected = await oracle.query(extractHoldings(holdings));
      if (js.totalYen !== expected.totalYen) return false;
      if (js.totalProfitYen !== expected.totalProfitYen) return false;
      return true;
    }),
    { numRuns },
  );
}
