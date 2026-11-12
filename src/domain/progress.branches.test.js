import { describe, expect, it, vi } from "vitest";

// The growth table reports a reach month that has no row in the table
// itself, so the required-assets lookup comes back empty.
vi.mock("./fire", () => ({
  generateGrowthTable: () => ({
    table: [{ month: 0, assets: 1000000 }],
    fireReachedMonth: 3,
  }),
  calculateFirePortfolio: () => ({
    totalAssetsYen: 60000000,
    riskAssetsYen: 30000000,
    cashAssetsYen: 30000000,
    liabilitiesYen: 0,
    netWorthYen: 60000000,
  }),
  performFireSimulation: () => ({ fireReachedMonth: -1 }),
}));

import { buildFireProgress, UNIVERSITY_FUND_YEN } from "./progress";

describe("buildFireProgress with a growth table missing the reach month", () => {
  it("reports zero required assets and a null progress rate", () => {
    const progress = buildFireProgress({
      portfolio: { totals: { assetsYen: 50000000 }, holdings: {} },
      baseParams: { postFireExtraExpense: 60000 },
    });
    expect(progress.side.monthsToReach).toBe(3);
    expect(progress.side.requiredAssetsYen).toBe(0);
    expect(progress.side.progressRate).toBeNull();
    expect(progress.side.gapYen).toBe(-(50000000 - UNIVERSITY_FUND_YEN));
    expect(progress.full.requiredAssetsYen).toBe(0);
    expect(progress.full.progressRate).toBeNull();
  });
});
