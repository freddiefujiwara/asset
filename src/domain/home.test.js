import { describe, expect, it } from "vitest";
import {
  CARD_STATUS,
  MONTHLY_CHECKLIST_ITEMS,
  buildFreshnessCard,
  buildInvestmentCard,
  buildLivingCostCard,
  buildMilestoneCard,
  buildMonthlyChanges,
  buildSpecialExpenseCard,
  checklistStorageKey,
  isInvestmentExecution,
  listSpecialExpenses,
  parseChecklistState,
  shiftMonthKey,
  sumInvestmentExecutions,
} from "./home";

const NOW = new Date(2026, 10, 10); // 2026-11-10

function item(overrides) {
  return {
    date: "2026-10-15",
    amount: -1000,
    name: "テスト",
    category: "食費/食料品",
    isTransfer: false,
    ...overrides,
  };
}

describe("shiftMonthKey", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonthKey("2026-11", -1)).toBe("2026-10");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-11", -12)).toBe("2025-11");
  });
});

describe("isInvestmentExecution / sumInvestmentExecutions", () => {
  const ideco = item({
    date: "2026-10-26",
    amount: -23000,
    name: "コクミンネンキンキキンレンゴウカイ(カクテイキヨシユツネンキン)",
    category: "",
    isTransfer: true,
  });
  const bankFund = item({
    date: "2026-10-24",
    amount: -149856,
    name: "ラクテンショウケンカブシキガイシャ (投信積立代金)",
    category: "",
    isTransfer: true,
  });
  const cardFund = item({
    date: "2026-10-16",
    amount: -50000,
    name: "楽天証券投信積立0.5%~",
    category: "",
    isTransfer: true,
  });

  it("matches Rakuten Securities fund accumulation and iDeCo debits", () => {
    expect(isInvestmentExecution(ideco)).toBe(true);
    expect(isInvestmentExecution(bankFund)).toBe(true);
    expect(isInvestmentExecution(cardFund)).toBe(true);
  });

  it("does not match card bill payments or positive amounts", () => {
    expect(
      isInvestmentExecution(item({ name: "ラクテンカ-ドサ-ビス", amount: -376209, isTransfer: true })),
    ).toBe(false);
    expect(isInvestmentExecution(item({ name: "楽天証券投信積立0.5%~", amount: 50000 }))).toBe(false);
    expect(isInvestmentExecution(null)).toBe(false);
  });

  it("sums only the target month", () => {
    const rows = [ideco, bankFund, cardFund, { ...cardFund, date: "2026-09-16" }];
    expect(sumInvestmentExecutions(rows, "2026-10")).toBe(222856);
    expect(sumInvestmentExecutions(rows, "2026-08")).toBe(0);
    expect(sumInvestmentExecutions(null, "2026-10")).toBe(0);
  });
});

describe("buildInvestmentCard", () => {
  const october = [
    item({ date: "2026-10-26", amount: -23000, name: "コクミンネンキンキキンレンゴウカイ(カクテイキヨシユツネンキン)", category: "", isTransfer: true }),
    item({ date: "2026-10-24", amount: -149856, name: "ラクテンショウケンカブシキガイシャ (投信積立代金)", category: "", isTransfer: true }),
    item({ date: "2026-10-16", amount: -50000, name: "楽天証券投信積立0.5%~", category: "", isTransfer: true }),
    item({ date: "2026-10-16", amount: -99962, name: "楽天証券投信積立0.5%~", category: "", isTransfer: true }),
  ];

  // 判定基準は本人分323,000円（世帯423,000円のうち妻分100,000円は
  // フィード対象外）。フィクスチャの先月合計322,818円は本人分の実測相当。
  it("judges against the self-only standard of 323,000 yen and is ok near it", () => {
    const card = buildInvestmentCard(october, NOW);
    expect(card.lastMonth).toEqual({ month: "2026-10", amountYen: 322818 });
    expect(card.standardYen).toBe(323000);
    expect(card.status).toBe(CARD_STATUS.OK);
  });

  it("flags attention when last month is below 95% of the self standard", () => {
    const rows = [october[0]]; // iDeCo掛金23,000円のみ
    const card = buildInvestmentCard(rows, NOW);
    expect(card.lastMonth.amountYen).toBe(23000);
    expect(card.status).toBe(CARD_STATUS.ATTENTION);
  });

  it("reports current month progress without judging it", () => {
    const rows = [
      ...october,
      item({ date: "2026-11-05", amount: -50000, name: "楽天証券投信積立0.5%~", category: "", isTransfer: true }),
    ];
    const card = buildInvestmentCard(rows, NOW);
    expect(card.lastMonth.amountYen).toBe(322818);
    expect(card.status).toBe(CARD_STATUS.OK);
    expect(card.currentMonth).toEqual({ month: "2026-11", amountYen: 50000 });
  });
});

function livingCostFixture({ lastMonthExtra = [] } = {}) {
  const rows = [];
  for (let i = 1; i <= 12; i++) {
    const month = shiftMonthKey("2026-11", -i);
    rows.push(item({ date: `${month}-05`, amount: -100000, category: "食費/食料品" }));
    rows.push(item({ date: `${month}-27`, amount: -60000, category: "住宅/ローン返済" }));
    // 生活費に含めないもの: 特別な支出・カード引き落とし・振替
    rows.push(item({ date: `${month}-10`, amount: -500000, category: "特別な支出/家具・家電" }));
    rows.push(item({ date: `${month}-27`, amount: -300000, name: "カード引き落とし", category: "現金・カード/カード引き落とし" }));
  }
  return [...rows, ...lastMonthExtra];
}

describe("buildLivingCostCard", () => {
  it("is ok when last month is within +10% of the 12 month average", () => {
    const card = buildLivingCostCard(livingCostFixture(), NOW);
    expect(card.lastMonth).toEqual({ month: "2026-10", amountYen: 160000 });
    expect(card.averageYen).toBe(160000);
    expect(card.status).toBe(CARD_STATUS.OK);
    expect(card.topCategories).toEqual([]);
  });

  it("flags attention over +10% and lists the pushing categories top3", () => {
    const card = buildLivingCostCard(
      livingCostFixture({
        lastMonthExtra: [
          item({ date: "2026-10-12", amount: -50000, category: "食費/外食" }),
          item({ date: "2026-10-20", amount: -30000, category: "趣味・娯楽/旅行" }),
        ],
      }),
      NOW,
    );
    expect(card.lastMonth.amountYen).toBe(240000);
    expect(card.status).toBe(CARD_STATUS.ATTENTION);
    expect(card.topCategories[0]).toEqual({
      label: "食費",
      lastMonthYen: 150000,
      averageYen: 104167,
      excessYen: 45833,
    });
    expect(card.topCategories.map((c) => c.label)).toContain("趣味・娯楽");
    // 特別な支出は押し上げカテゴリにも生活費にも入らない
    expect(card.topCategories.map((c) => c.label)).not.toContain("特別な支出");
  });

  it("handles empty data", () => {
    const card = buildLivingCostCard([], NOW);
    expect(card.status).toBe(CARD_STATUS.OK);
    expect(card.averageYen).toBe(0);
  });
});

describe("special expenses", () => {
  const rows = [
    item({ date: "2026-10-02", amount: -162550, name: "埼玉高速鉄道 定期券", category: "特別な支出/その他特別な支出" }),
    item({ date: "2026-11-03", amount: -45000, name: "冷蔵庫", category: "特別な支出/家具・家電" }),
    item({ date: "2026-11-04", amount: -10000, name: "対象外", category: "食費/食料品" }),
  ];

  it("lists special expenses by month with content", () => {
    expect(listSpecialExpenses(rows, "2026-10")).toEqual([
      {
        date: "2026-10-02",
        name: "埼玉高速鉄道 定期券",
        category: "特別な支出/その他特別な支出",
        amountYen: 162550,
      },
    ]);
  });

  it("builds the card for last and current month without a status", () => {
    const card = buildSpecialExpenseCard(rows, NOW);
    expect(card.lastMonth.totalYen).toBe(162550);
    expect(card.currentMonth.totalYen).toBe(45000);
    expect(card).not.toHaveProperty("status");
  });
});

describe("buildMilestoneCard", () => {
  it("shows the iDeCo window 30 days before it opens, as upcoming", () => {
    const card = buildMilestoneCard(new Date(2026, 10, 10));
    expect(card.visible).toBe(true);
    expect(card.status).toBe(CARD_STATUS.OK);
    expect(card.items).toHaveLength(1);
    expect(card.items[0]).toMatchObject({
      id: "ideco-increase-application",
      state: "upcoming",
      daysUntilStart: 21,
      periodLabel: "12月1日〜12月24日",
    });
  });

  it("is attention while the application window is open", () => {
    const card = buildMilestoneCard(new Date(2026, 11, 5));
    expect(card.items[0].state).toBe("active");
    expect(card.status).toBe(CARD_STATUS.ATTENTION);
  });

  it("is hidden outside the display window", () => {
    expect(buildMilestoneCard(new Date(2026, 9, 15)).visible).toBe(false);
    expect(buildMilestoneCard(new Date(2026, 11, 25)).visible).toBe(false);
    expect(buildMilestoneCard(new Date(2027, 0, 15)).visible).toBe(false);
  });
});

describe("buildFreshnessCard", () => {
  it("is ok when the latest transaction is within 2 days", () => {
    const card = buildFreshnessCard([item({ date: "2026-11-08" })], NOW);
    expect(card).toEqual({ status: CARD_STATUS.OK, latestDate: "2026-11-08", ageDays: 2 });
  });

  it("is attention when the latest transaction is 3+ days old (over 48h for sure)", () => {
    const card = buildFreshnessCard([item({ date: "2026-11-05" })], NOW);
    expect(card.status).toBe(CARD_STATUS.ATTENTION);
    expect(card.ageDays).toBe(5);
  });

  it("is attention when there is no data", () => {
    expect(buildFreshnessCard([], NOW)).toEqual({
      status: CARD_STATUS.ATTENTION,
      latestDate: "",
      ageDays: null,
    });
  });
});

describe("buildMonthlyChanges", () => {
  const snapshots = [
    { month: "2026-10", totalAssetsYen: 77000000, netAssetsYen: 65000000, livingCost12mAvgYen: 470000 },
    { month: "2026-11", totalAssetsYen: 78139712, netAssetsYen: 66628825, livingCost12mAvgYen: 461012 },
  ];

  it("compares the latest snapshot with the previous one", () => {
    const changes = buildMonthlyChanges(snapshots, 10450000);
    expect(changes.available).toBe(true);
    expect(changes.month).toBe("2026-11");
    expect(changes.rows).toEqual([
      { key: "netAssets", label: "純資産", currentYen: 66628825, previousYen: 65000000, diffYen: 1628825 },
      { key: "fireTargetAssets", label: "FIRE対象資産（大学資金を除く）", currentYen: 67689712, previousYen: 66550000, diffYen: 1139712 },
      { key: "livingCostAverage", label: "生活費（12か月平均）", currentYen: 461012, previousYen: 470000, diffYen: -8988 },
    ]);
  });

  it("is unavailable with fewer than two snapshots", () => {
    expect(buildMonthlyChanges(snapshots.slice(1), 10450000).available).toBe(false);
    expect(buildMonthlyChanges([], 10450000).available).toBe(false);
    expect(buildMonthlyChanges(null, 10450000).available).toBe(false);
  });
});

describe("monthly checklist helpers", () => {
  it("has the four items in order", () => {
    expect(MONTHLY_CHECKLIST_ITEMS.map((item) => item.label)).toEqual([
      "先月の特別支出を確認した",
      "先月の投資が基準どおりだった",
      "生活費の超過カテゴリを見た",
      "FIRE進捗を確認した",
    ]);
  });

  it("keys storage by month so a new month resets automatically", () => {
    expect(checklistStorageKey(new Date(2026, 10, 10))).toBe("asset-monthly-checklist:2026-11");
    expect(checklistStorageKey(new Date(2026, 11, 1))).toBe("asset-monthly-checklist:2026-12");
  });

  it("parses saved state and drops unknown ids and broken json", () => {
    expect(parseChecklistState('["investment-standard","bogus"]')).toEqual(["investment-standard"]);
    expect(parseChecklistState("not-json")).toEqual([]);
    expect(parseChecklistState(null)).toEqual([]);
    expect(parseChecklistState('{"a":1}')).toEqual([]);
  });
});

describe("home cards edge cases", () => {
  it("builds the living cost card for a missing cash flow list", () => {
    const card = buildLivingCostCard(null, NOW);
    expect(card.lastMonth.amountYen).toBe(0);
    expect(card.topCategories).toEqual([]);
  });

  it("combines categories seen only in the window or only in the last month", () => {
    const cashFlow = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(2025, 10 + i, 5);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (month !== "2026-10") {
        cashFlow.push(item({ date: `${month}-05`, amount: -1000, category: "日用品/消耗品" }));
      }
    }
    cashFlow.push(item({ date: "2026-10-05", amount: -5000, category: "食費/食料品" }));
    const card = buildLivingCostCard(cashFlow, NOW);
    const food = card.topCategories.find((category) => category.label === "食費");
    expect(food).toMatchObject({ lastMonthYen: 5000, averageYen: 417 });
  });

  it("groups rows with missing or empty large categories under 未分類", () => {
    const card = buildLivingCostCard(
      [
        item({ date: "2026-10-03", amount: -1000, category: undefined }),
        item({ date: "2026-10-04", amount: -2000, category: "" }),
        item({ date: "2026-10-05", amount: -4000, category: "/その他" }),
      ],
      NOW,
    );
    expect(card.lastMonth.amountYen).toBe(7000);
  });

  it("treats rows without a name or category as non-special, non-investment rows", () => {
    expect(isInvestmentExecution({ amount: -100 })).toBe(false);
    expect(listSpecialExpenses([{ date: "2026-10-01", amount: -100 }], "2026-10")).toEqual([]);
    expect(listSpecialExpenses(null, "2026-10")).toEqual([]);
  });

  it("builds the freshness card for a missing cash flow list", () => {
    expect(buildFreshnessCard(null, NOW)).toBeTypeOf("object");
  });
});
