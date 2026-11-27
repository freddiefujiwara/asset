import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHeadline } from "../src/domain/home/headline";

const snapshot = (month, netAssetsYen) => ({ month, netAssetsYen });
const cases = [
  {
    name: "out-of-order months, gain and improving pace",
    input: { snapshots: [snapshot("2026-12", 1050), snapshot("2026-11", 1000)], projectionDeltaMonths: 3 },
    expected: { hasComparison: true, month: "2026-12", previousMonth: "2026-11", netAssetsYen: 1050, diffYen: 50, diffRatePct: 5, pace: "improving", projectionDeltaMonths: 3 },
  },
  {
    name: "year boundary, loss and worsening pace",
    input: { snapshots: [snapshot("2026-11", 750), snapshot("2027-01", 950), snapshot("2026-12", 1000)], projectionDeltaMonths: -2 },
    expected: { hasComparison: true, month: "2027-01", previousMonth: "2026-12", netAssetsYen: 950, diffYen: -50, diffRatePct: -5, pace: "worsening", projectionDeltaMonths: -2 },
  },
  {
    name: "zero previous balance has no percentage",
    input: { snapshots: [snapshot("2026-11", 0), snapshot("2026-12", 240)], projectionDeltaMonths: 0 },
    expected: { hasComparison: true, month: "2026-12", previousMonth: "2026-11", netAssetsYen: 240, diffYen: 240, diffRatePct: null, pace: "steady", projectionDeltaMonths: 0 },
  },
  {
    name: "one snapshot falls back to the current balance",
    input: { snapshots: [snapshot("2026-12", 900)], currentNetAssetsYen: 1000 },
    expected: { hasComparison: false, month: "2026-12", previousMonth: "", netAssetsYen: 1000, diffYen: null, diffRatePct: null, pace: null, projectionDeltaMonths: null },
  },
  {
    name: "no history still reports the current balance",
    input: { snapshots: [], currentNetAssetsYen: 1000 },
    expected: { hasComparison: false, month: "", previousMonth: "", netAssetsYen: 1000, diffYen: null, diffRatePct: null, pace: null, projectionDeltaMonths: null },
  },
];

describe("net-assets headline contract", () => {
  it.each(cases)("$name in asset", ({ input, expected }) => {
    expect(buildHeadline(structuredClone(input))).toEqual(expected);
  });

  // The dedicated CI job supplies asset-gas, which produces Reader's card.
  const gasSource = process.env.ASSET_GAS_SOURCE;
  it.skipIf(!gasSource).each(cases)("$name in asset-gas", ({ input, expected }) => {
    const { dashboardBuildHeadline_ } = createRequire(import.meta.url)(resolve(gasSource));
    expect(dashboardBuildHeadline_(structuredClone(input))).toEqual(expected);
  });
});
