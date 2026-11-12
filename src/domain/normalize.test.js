import { describe, expect, it } from "vitest";
import { normalizePortfolio } from "./normalize";

describe("normalizePortfolio", () => {
  it("numeric strings are parsed and totals computed", () => {
    const api = {
      breakdown: [
        { category: "預金", amount_yen: "1,000", percentage: "50" },
        { category: "株式", amount_yen: "￥ 2,000", percentage: "50%" },
      ],
      "total-liability": [{ total_yen: "500" }],
      "breakdown-liability": [{ category: "カード", amount_yen: "500", percentage: "100" }],
    };

    const normalized = normalizePortfolio(api);

    expect(normalized.totals.assetsYen).toBe(3000);
    expect(normalized.totals.liabilitiesYen).toBe(500);
    expect(normalized.totals.netWorthYen).toBe(2500);
    expect(normalized.summary.assetsByClass[1].percentage).toBe(50);
  });

  it("missing keys are safe and holdings fallback to empty arrays", () => {
    const normalized = normalizePortfolio({});

    expect(normalized.totals.assetsYen).toBe(0);
    expect(normalized.totals.liabilitiesYen).toBe(0);
    expect(normalized.summary.assetsByClass).toEqual([]);
    expect(normalized.holdings.cashLike).toEqual([]);
    expect(normalized.holdings.stocks).toEqual([]);
    expect(normalized.holdings.liabilitiesDetail).toEqual([]);
  });


  it("keeps pension profit when value already exists", () => {
    const normalized = normalizePortfolio({
      details__portfolio_det_pns__t0: [{ 名称: "Corporate DC", 現在価値: "120000", 評価損益率: "20", 評価損益: "999" }],
    });

    expect(normalized.holdings.pensions[0]["評価損益"]).toBe("999");
  });

  it("does not derive pension profit when denominator becomes zero", () => {
    const normalized = normalizePortfolio({
      details__portfolio_det_pns__t0: [{ 名称: "Edge", 現在価値: "120000", 評価損益率: "-100" }],
    });

    expect(normalized.holdings.pensions[0]["評価損益"]).toBeUndefined();
  });

  it("derives pension profit from current value and profit rate", () => {
    const normalized = normalizePortfolio({
      details__portfolio_det_pns__t0: [{ 名称: "iDeCo", 現在価値: "120000", 評価損益率: "20" }],
    });

    expect(normalized.holdings.pensions[0]["評価損益"]).toBe("20000");
  });

  it("handles null or non-object in pensions array safely", () => {
    const api = {
      details__portfolio_det_pns__t0: [null, "not-an-object"],
    };
    const normalized = normalizePortfolio(api);
    expect(normalized.holdings.pensions[0]).toBeNull();
    expect(normalized.holdings.pensions[1]).toBe("not-an-object");
  });

  it("handles null api input", () => {
    const normalized = normalizePortfolio(null);
    expect(normalized.totals.assetsYen).toBe(0);
  });

  it("handles missing category in breakdown items", () => {
    const api = {
      breakdown: [{}],
      "breakdown-liability": [{}],
    };
    const normalized = normalizePortfolio(api);
    expect(normalized.summary.assetsByClass[0].name).toBe("");
    expect(normalized.summary.liabilitiesByCategory[0].category).toBe("");
  });

  it("normalizes cashFlow data including edge cases for branches", () => {
    const api = {
      mfcf: [
        { date: "2026-02-12", amount: -3000, currency: "JPY", name: "Shop", category: "Food", is_transfer: false },
        { date: null, amount: 1000, currency: null, name: null, category: null, is_transfer: true },
        {},
      ],
    };
    const normalized = normalizePortfolio(api);
    expect(normalized.cashFlow).toHaveLength(3);
    expect(new Set(normalized.cashFlow.map((item) => item.id)).size).toBe(3);

    expect(normalized.cashFlow[0]).toEqual({
      id: "2026-02-12::-3000::JPY::Shop::Food::0",
      date: "2026-02-12",
      amount: -3000,
      currency: "JPY",
      name: "Shop",
      category: "Food",
      isTransfer: false,
    });

    expect(normalized.cashFlow[1]).toEqual({
      id: "::1000::JPY::::::1",
      date: "",
      amount: 1000,
      currency: "JPY",
      name: "",
      category: "",
      isTransfer: true,
    });

    expect(normalized.cashFlow[2]).toEqual({
      id: "::0::JPY::::::0",
      date: "",
      amount: 0,
      currency: "JPY",
      name: "",
      category: "",
      isTransfer: false,
    });
  });

  it("deduplicates visually duplicated cashFlow rows", () => {
    const normalized = normalizePortfolio({
      mfcf: [
        { date: "2026-02-12", amount: "-3000", currency: "JPY", name: "Shop", category: "Food", is_transfer: false },
        { date: "2026-02-12 ", amount: -3000, currency: " JPY", name: "Shop ", category: "Food", is_transfer: false },
      ],
    });

    expect(normalized.cashFlow).toHaveLength(1);
    expect(normalized.cashFlow[0]).toEqual({
      id: "2026-02-12::-3000::JPY::Shop::Food::0",
      date: "2026-02-12",
      amount: -3000,
      currency: "JPY",
      name: "Shop",
      category: "Food",
      isTransfer: false,
    });
  });

  it("parses monthly snapshots, numeric strings to numbers, sorted by month", () => {
    const normalized = normalizePortfolio({
      snapshots: [
        {
          month: "2026-11",
          total_assets: "78,139,712",
          total_liabilities: "11,510,887",
          net_assets: "66,628,825",
          cash: "7,502,164",
          risk_assets: "70,630,234",
          living_cost_12m_avg: "461,012",
          income_12m_avg: "1,056,465",
        },
        {
          month: "2026-10",
          total_assets: "77000000",
          total_liabilities: "11600000",
          net_assets: "65400000",
          cash: "7000000",
          risk_assets: "69000000",
          living_cost_12m_avg: "470000",
          income_12m_avg: "1050000",
        },
        { month: "not-a-month", total_assets: "1" },
      ],
    });

    expect(normalized.snapshots).toEqual([
      {
        month: "2026-10",
        totalAssetsYen: 77000000,
        totalLiabilitiesYen: 11600000,
        netAssetsYen: 65400000,
        cashYen: 7000000,
        riskAssetsYen: 69000000,
        livingCost12mAvgYen: 470000,
        income12mAvgYen: 1050000,
      },
      {
        month: "2026-11",
        totalAssetsYen: 78139712,
        totalLiabilitiesYen: 11510887,
        netAssetsYen: 66628825,
        cashYen: 7502164,
        riskAssetsYen: 70630234,
        livingCost12mAvgYen: 461012,
        income12mAvgYen: 1056465,
      },
    ]);
  });

  it("snapshots fall back to an empty array when missing", () => {
    expect(normalizePortfolio({}).snapshots).toEqual([]);
  });

});

describe("normalizePortfolio currency fallback", () => {
  it("falls back to JPY when a cash flow row has an empty currency", () => {
    const normalized = normalizePortfolio({
      mfcf: [
        { date: "2026-02-12", amount: -3000, currency: "", name: "Shop", category: "Food", is_transfer: false },
      ],
    });
    expect(normalized.cashFlow[0].currency).toBe("JPY");
  });
});
