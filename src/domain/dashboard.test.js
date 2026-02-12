import { describe, expect, it } from "vitest";
import { balanceSheetLayout } from "./dashboard";

describe("balanceSheetLayout", () => {
  it("builds left-assets / right-split proportions", () => {
    const layout = balanceSheetLayout({ assetsYen: 600, liabilitiesYen: 200, netWorthYen: 400 });

    expect(layout.assetsWidthPct).toBeCloseTo(50, 5);
    expect(layout.rightWidthPct).toBeCloseTo(50, 5);
    expect(layout.liabilitiesHeightPct).toBeCloseTo(33.3333, 3);
    expect(layout.netWorthHeightPct).toBeCloseTo(66.6667, 3);
  });

  it("falls back safely for empty totals", () => {
    const layout = balanceSheetLayout({ assetsYen: 0, liabilitiesYen: 0, netWorthYen: 0 });
    expect(layout.assetsWidthPct).toBeCloseTo(33.34, 2);
    expect(layout.liabilitiesHeightPct).toBe(50);
  });
});
