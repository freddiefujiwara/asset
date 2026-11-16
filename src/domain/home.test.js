import { describe, expect, it } from "vitest";
import {
  ASSET_DAILY_CONTRIBUTOR_LIMIT,
  ATTENTION_ITEM_LIMIT,
  ATTENTION_SPECIAL_EXPENSE_YEN,
  CARD_STATUS,
  RECENT_EXPENSE_DAYS,
  buildAssetDailyChange,
  buildAttentionItems,
  buildFreshnessCard,
  buildHeadline,
  buildInvestmentCard,
  buildLivingCostCard,
  buildMilestoneCard,
  buildMonthlyChanges,
  buildRecentExpenses,
  buildSpecialExpenseCard,
  isInvestmentExecution,
  listSpecialExpenses,
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

  it("excludes transfers and income rows from the living cost", () => {
    const card = buildLivingCostCard(
      [
        item({ date: "2026-10-05", amount: -100000, category: "食費/食料品" }),
        item({ date: "2026-10-24", amount: -149856, name: "投信積立", category: "", isTransfer: true }),
        item({ date: "2026-10-25", amount: 830660, name: "給与", category: "収入/給与" }),
      ],
      NOW,
    );
    expect(card.lastMonth.amountYen).toBe(100000);
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

  it("sorts multiple special expenses in the same month by date descending", () => {
    const sameMonth = [
      item({ date: "2026-10-02", amount: -1000, name: "A", category: "特別な支出/その他特別な支出" }),
      item({ date: "2026-10-20", amount: -2000, name: "B", category: "特別な支出/家具・家電" }),
    ];
    expect(listSpecialExpenses(sameMonth, "2026-10").map((e) => e.name)).toEqual(["B", "A"]);
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

describe("buildHeadline", () => {
  const snapshots = [
    { month: "2026-10", netAssetsYen: 65000000 },
    { month: "2026-11", netAssetsYen: 66628825 },
  ];

  it("compares the latest snapshot with the previous one and maps the pace from the projection delta", () => {
    expect(buildHeadline({ snapshots, projectionDeltaMonths: 3 })).toMatchObject({
      hasComparison: true,
      month: "2026-11",
      previousMonth: "2026-10",
      netAssetsYen: 66628825,
      diffYen: 1628825,
      pace: "improving",
      projectionDeltaMonths: 3,
    });
    expect(buildHeadline({ snapshots, projectionDeltaMonths: -2 }).pace).toBe("worsening");
    expect(buildHeadline({ snapshots, projectionDeltaMonths: 0 }).pace).toBe("steady");
    expect(buildHeadline({ snapshots, projectionDeltaMonths: null }).pace).toBe(null);
    expect(buildHeadline({ snapshots }).pace).toBe(null);
  });

  it("sorts snapshots by month before comparing", () => {
    const headline = buildHeadline({ snapshots: [snapshots[1], snapshots[0]] });
    expect(headline.month).toBe("2026-11");
    expect(headline.diffYen).toBe(1628825);
  });

  it("adds the month-over-month rate of the net assets diff", () => {
    const headline = buildHeadline({ snapshots });
    expect(headline.diffRatePct).toBeCloseTo((1628825 / 65000000) * 100);
  });

  it("reports a null rate when the previous net assets are zero", () => {
    const headline = buildHeadline({
      snapshots: [
        { month: "2026-10", netAssetsYen: 0 },
        { month: "2026-11", netAssetsYen: 500 },
      ],
    });
    expect(headline.diffYen).toBe(500);
    expect(headline.diffRatePct).toBeNull();
  });

  it("falls back to the current net assets with a single snapshot", () => {
    expect(
      buildHeadline({ snapshots: snapshots.slice(1), currentNetAssetsYen: 67000000 }),
    ).toEqual({
      hasComparison: false,
      month: "2026-11",
      previousMonth: "",
      netAssetsYen: 67000000,
      diffYen: null,
      diffRatePct: null,
      pace: null,
      projectionDeltaMonths: null,
    });
  });

  it("falls back to the snapshot value when the current net assets are unknown", () => {
    const headline = buildHeadline({ snapshots: snapshots.slice(1), currentNetAssetsYen: 0 });
    expect(headline.netAssetsYen).toBe(66628825);
  });

  it("compares even when a snapshot row has no month or is null", () => {
    const headline = buildHeadline({
      snapshots: [{ netAssetsYen: 300 }, { month: "2026-11", netAssetsYen: 500 }],
    });
    expect(headline).toMatchObject({ hasComparison: true, month: "2026-11", diffYen: 200 });

    const withNull = buildHeadline({
      snapshots: [null, { month: "2026-11", netAssetsYen: 500 }],
      currentNetAssetsYen: 700,
    });
    expect(withNull).toMatchObject({ hasComparison: false, netAssetsYen: 700 });

    const mixed = buildHeadline({
      snapshots: [
        { month: "2026-11", netAssetsYen: 500 },
        { netAssetsYen: 100 },
        { month: "2026-10", netAssetsYen: 300 },
      ],
    });
    expect(mixed).toMatchObject({ hasComparison: true, month: "2026-11", diffYen: 200 });
  });

  it("handles no snapshots and non-array input", () => {
    expect(buildHeadline({ snapshots: [] })).toMatchObject({
      hasComparison: false,
      month: "",
      netAssetsYen: 0,
    });
    expect(buildHeadline({ snapshots: null, currentNetAssetsYen: 123 }).netAssetsYen).toBe(123);
    expect(buildHeadline()).toMatchObject({ hasComparison: false, netAssetsYen: 0 });
    expect(buildHeadline({ snapshots: [null] })).toMatchObject({
      hasComparison: false,
      month: "",
      netAssetsYen: 0,
    });
  });
});

describe("buildAttentionItems", () => {
  const okCards = {
    investmentCard: { status: CARD_STATUS.OK },
    freshnessCard: { status: CARD_STATUS.OK, latestDate: "2026-11-09", ageDays: 1 },
    review: {
      month: "2026-10",
      livingCostYen: 160000,
      averageLivingCostYen: 160000,
      livingCostOverAverage: false,
      categories: [],
      special: { totalYen: 0, items: [] },
    },
  };

  it("is empty when nothing needs attention", () => {
    expect(buildAttentionItems(okCards)).toEqual({ items: [], totalCount: 0 });
    expect(buildAttentionItems()).toEqual({ items: [], totalCount: 0 });
    expect(buildAttentionItems({})).toEqual({ items: [], totalCount: 0 });
    expect(buildAttentionItems({ review: {} }).items).toEqual([]);
    expect(buildAttentionItems({ review: { special: { items: "x" } } }).items).toEqual([]);
  });

  it("puts freshness first, then the investment shortfall", () => {
    const result = buildAttentionItems({
      investmentCard: {
        status: CARD_STATUS.ATTENTION,
        standardYen: 323000,
        lastMonth: { month: "2026-10", amountYen: 23000 },
      },
      freshnessCard: { status: CARD_STATUS.ATTENTION, latestDate: "2026-11-05", ageDays: 5 },
      review: okCards.review,
    });
    expect(result.items.map((item) => item.kind)).toEqual(["freshness", "investment"]);
    expect(result.items[0]).toMatchObject({ latestDate: "2026-11-05", ageDays: 5, linkTo: null });
    expect(result.items[1]).toMatchObject({ month: "2026-10", amountYen: 23000, standardYen: 323000, linkTo: "/cash-flow" });
  });

  it("lists over-average categories in the review's order", () => {
    const result = buildAttentionItems({
      ...okCards,
      review: {
        ...okCards.review,
        categories: [
          { label: "衣服・美容", monthYen: 33776, averageYen: 18713, excessYen: 15063, ratioPct: 80 },
          { label: "日用品", monthYen: 20585, averageYen: 18025, excessYen: 2560, ratioPct: 14 },
        ],
      },
    });
    expect(result.items.map((item) => item.id)).toEqual(["category-衣服・美容", "category-日用品"]);
    expect(result.items[0]).toMatchObject({ label: "衣服・美容", excessYen: 15063, ratioPct: 80 });
  });

  it("carries the category top expenses inline instead of a detail link", () => {
    const topExpenses = [
      { date: "2026-10-12", name: "美容室", amountYen: 12000 },
      { date: "2026-10-05", name: "衣類", amountYen: 8000 },
    ];
    const result = buildAttentionItems({
      ...okCards,
      review: {
        ...okCards.review,
        categories: [
          { label: "衣服・美容", monthYen: 33776, averageYen: 18713, excessYen: 15063, ratioPct: 80, topExpenses },
          { label: "日用品", monthYen: 20585, averageYen: 18025, excessYen: 2560, ratioPct: 14 },
        ],
      },
    });
    expect(result.items[0]).toMatchObject({ topExpenses, linkTo: null });
    // topExpenses が無いカテゴリは空配列になる
    expect(result.items[1]).toMatchObject({ topExpenses: [], linkTo: null });
  });

  it("adds the overall living cost item when it is over the average", () => {
    const result = buildAttentionItems({
      ...okCards,
      review: { ...okCards.review, livingCostOverAverage: true, livingCostYen: 200000, averageLivingCostYen: 160000 },
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ kind: "living-cost", month: "2026-10", amountYen: 200000, averageYen: 160000 });
  });

  it("flags the largest special expense at or over the threshold", () => {
    const review = {
      ...okCards.review,
      special: {
        totalYen: 242550,
        items: [
          { date: "2026-10-02", name: "定期券", category: "特別な支出/その他", amountYen: 162550 },
          { date: "2026-10-20", name: "家電", category: "特別な支出/家具・家電", amountYen: 80000 },
        ],
      },
    };
    const result = buildAttentionItems({ ...okCards, review });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ kind: "special", name: "定期券", amountYen: 162550 });

    const reversed = buildAttentionItems({
      ...okCards,
      review: { ...review, special: { ...review.special, items: [...review.special.items].reverse() } },
    });
    expect(reversed.items[0]).toMatchObject({ name: "定期券", amountYen: 162550 });

    const exactly = buildAttentionItems({
      ...okCards,
      review: {
        ...okCards.review,
        special: { totalYen: ATTENTION_SPECIAL_EXPENSE_YEN, items: [{ date: "2026-10-01", name: "x", category: "特別な支出/x", amountYen: ATTENTION_SPECIAL_EXPENSE_YEN }] },
      },
    });
    expect(exactly.items).toHaveLength(1);
  });

  it("ignores special expenses below the threshold", () => {
    const result = buildAttentionItems({
      ...okCards,
      review: {
        ...okCards.review,
        special: { totalYen: 30000, items: [{ date: "2026-10-01", name: "x", category: "特別な支出/x", amountYen: 30000 }] },
      },
    });
    expect(result.items).toEqual([]);
  });

  it("caps the list at the limit and reports the total count", () => {
    const result = buildAttentionItems({
      investmentCard: { status: CARD_STATUS.ATTENTION, standardYen: 323000, lastMonth: { month: "2026-10", amountYen: 0 } },
      freshnessCard: { status: CARD_STATUS.ATTENTION, latestDate: "", ageDays: null },
      review: {
        month: "2026-10",
        livingCostYen: 200000,
        averageLivingCostYen: 160000,
        livingCostOverAverage: true,
        categories: [
          { label: "食費", monthYen: 150000, averageYen: 100000, excessYen: 50000, ratioPct: 50 },
          { label: "日用品", monthYen: 30000, averageYen: 20000, excessYen: 10000, ratioPct: 50 },
        ],
        special: { totalYen: 162550, items: [{ date: "2026-10-02", name: "定期券", category: "特別な支出/x", amountYen: 162550 }] },
      },
    });
    expect(result.totalCount).toBe(6);
    expect(result.items).toHaveLength(ATTENTION_ITEM_LIMIT);
    expect(result.items.map((item) => item.kind)).toEqual(["freshness", "investment", "category"]);
  });
});

describe("buildAssetDailyChange", () => {
  it("sums the daily change and ranks contributors by absolute contribution", () => {
    const result = buildAssetDailyChange({
      stocks: [
        { 銘柄名: "楽天株", 評価額: "1000000", 前日比: "-30000" },
        { 銘柄名: "ETF", 評価額: "500000", 前日比: "5000" },
      ],
      funds: [
        { 銘柄名: "オルカン", 評価額: "8000000", 前日比: "-120000" },
        { 銘柄名: "先進国ファンド", 評価額: "2000000", 前日比: "10000" },
      ],
    });
    expect(result.hasData).toBe(true);
    expect(result.totalDailyChangeYen).toBe(-135000);
    expect(result.rowsWithData).toBe(4);
    expect(result.rowsTotal).toBe(4);
    // 合計の％は集計範囲（4銘柄）の前日の値ベース
    expect(result.totalChangeRatePct).toBeCloseTo((-135000 / 11635000) * 100);
    expect(result.contributors.map((c) => [c.name, c.changeYen])).toEqual([
      ["オルカン", -120000],
      ["楽天株", -30000],
      ["先進国ファンド", 10000],
    ]);
    // 前日比％ = 前日比 ÷（現在の評価額 − 前日比）
    expect(result.contributors[0].changeRatePct).toBeCloseTo((-120000 / 8120000) * 100);
    expect(result.contributors[1].changeRatePct).toBeCloseTo((-30000 / 1030000) * 100);
    expect(result.contributors[2].changeRatePct).toBeCloseTo((10000 / 1990000) * 100);
    expect(result.contributors).toHaveLength(ASSET_DAILY_CONTRIBUTOR_LIMIT);
  });

  it("aggregates the same fund held at multiple institutions", () => {
    const result = buildAssetDailyChange({
      funds: [
        { 銘柄名: "オルカン", 評価額: "100", 前日比: "-100" },
        { 銘柄名: "オルカン", 評価額: "200", 前日比: "-50" },
      ],
    });
    expect(result.contributors).toEqual([
      { name: "オルカン", changeYen: -150, changeRatePct: (-150 / 450) * 100 },
    ]);
    expect(result.rowsWithData).toBe(2);
    expect(result.totalChangeRatePct).toBeCloseTo((-150 / 450) * 100);
  });

  it("accepts the other daily-change keys but never falls back to 評価損益", () => {
    const result = buildAssetDailyChange({
      stocks: [
        { 銘柄名: "A", 評価額: "100", 前日比損益: "700" },
        { 銘柄名: "B", 評価額: "100", 評価損益: "99999" },
        { 銘柄名: "C", 評価額: "100" },
      ],
    });
    expect(result.totalDailyChangeYen).toBe(700);
    expect(result.rowsWithData).toBe(1);
    expect(result.rowsTotal).toBe(3);
    expect(result.contributors).toEqual([
      { name: "A", changeYen: 700, changeRatePct: (700 / -600) * 100 },
    ]);
    expect(result.totalChangeRatePct).toBeCloseTo((700 / -600) * 100);
  });

  it("falls back to the code, then to a placeholder name", () => {
    const result = buildAssetDailyChange({
      stocks: [
        { 銘柄コード: "1301", 評価額: "100", 前日比: "10" },
        { 評価額: "100", 前日比: "20" },
      ],
    });
    expect(result.contributors).toEqual([
      { name: "名称未設定", changeYen: 20, changeRatePct: (20 / 80) * 100 },
      { name: "1301", changeYen: 10, changeRatePct: (10 / 90) * 100 },
    ]);
  });

  it("reports a null rate when a value is missing or the previous value is zero", () => {
    const missingValue = buildAssetDailyChange({
      stocks: [
        { 銘柄名: "値あり", 評価額: "1000", 前日比: "100" },
        { 銘柄名: "値なし", 前日比: "50" },
      ],
    });
    expect(missingValue.totalDailyChangeYen).toBe(150);
    // 評価額が無い行が混ざるため合計の％は出さない
    expect(missingValue.totalChangeRatePct).toBeNull();
    expect(missingValue.contributors).toEqual([
      { name: "値あり", changeYen: 100, changeRatePct: (100 / 900) * 100 },
      { name: "値なし", changeYen: 50, changeRatePct: null },
    ]);

    const zeroBase = buildAssetDailyChange({
      stocks: [{ 銘柄名: "同額", 評価額: "100", 前日比: "100" }],
    });
    expect(zeroBase.contributors[0].changeRatePct).toBeNull();
    expect(zeroBase.totalChangeRatePct).toBeNull();
  });

  it("reports no data for missing or malformed holdings", () => {
    const empty = { hasData: false, totalDailyChangeYen: 0, totalChangeRatePct: null, contributors: [], rowsWithData: 0, rowsTotal: 0 };
    expect(buildAssetDailyChange(undefined)).toEqual(empty);
    expect(buildAssetDailyChange(null)).toEqual(empty);
    expect(buildAssetDailyChange({})).toEqual(empty);
    expect(buildAssetDailyChange({ stocks: "x", funds: null })).toEqual(empty);
    expect(buildAssetDailyChange({ stocks: [null, 42] })).toEqual({
      ...empty,
      rowsTotal: 2,
    });
  });
});

describe("buildRecentExpenses", () => {
  it("groups the last three days of spending by date, anchored on the latest transaction date", () => {
    const cashFlow = [
      item({ date: "2026-11-14", amount: -500, name: "コンビニ", category: "食費/食料品" }),
      item({ date: "2026-11-14", amount: -3000, name: "スーパー", category: "食費/食料品" }),
      item({ date: "2026-11-13", amount: -1200, name: "電車", category: "交通費/電車" }),
      item({ date: "2026-11-12", amount: -800, name: "日用品店", category: "日用品/消耗品" }),
      // 窓の外（4日前）は含めない
      item({ date: "2026-11-11", amount: -9999, name: "古い支出", category: "食費/食料品" }),
      // 収入・振替は含めない
      item({ date: "2026-11-14", amount: 500000, name: "給与", category: "収入/給与" }),
      item({ date: "2026-11-14", amount: -50000, name: "投信積立", category: "", isTransfer: true }),
    ];
    const result = buildRecentExpenses(cashFlow);
    expect(result.hasData).toBe(true);
    expect(result.latestDate).toBe("2026-11-14");
    expect(result.fromDate).toBe("2026-11-12");
    expect(result.totalYen).toBe(5500);
    expect(result.groups.map((group) => group.date)).toEqual(["2026-11-14", "2026-11-13", "2026-11-12"]);
    expect(result.groups[0].totalYen).toBe(3500);
    expect(result.groups[0].items.map((entry) => entry.name)).toEqual(["スーパー", "コンビニ"]);
    expect(RECENT_EXPENSE_DAYS).toBe(3);
  });

  it("excludes settlement-style rows but keeps special expenses", () => {
    const cashFlow = [
      item({ date: "2026-11-14", amount: -300000, name: "カード引き落とし", category: "現金・カード/カード引き落とし" }),
      item({ date: "2026-11-14", amount: -45000, name: "冷蔵庫", category: "特別な支出/家具・家電" }),
    ];
    const result = buildRecentExpenses(cashFlow);
    expect(result.totalYen).toBe(45000);
    expect(result.groups[0].items.map((entry) => entry.name)).toEqual(["冷蔵庫"]);
  });

  it("crosses a month boundary when shifting back from the latest date", () => {
    const result = buildRecentExpenses([
      item({ date: "2026-11-01", amount: -100, name: "月初", category: "食費/食料品" }),
      item({ date: "2026-10-30", amount: -200, name: "月末", category: "食費/食料品" }),
    ]);
    expect(result.fromDate).toBe("2026-10-30");
    expect(result.totalYen).toBe(300);
  });

  it("reports no data when there is nothing to show", () => {
    expect(buildRecentExpenses([])).toEqual({
      hasData: false,
      latestDate: "",
      fromDate: "",
      groups: [],
      totalYen: 0,
    });
    expect(buildRecentExpenses(null).hasData).toBe(false);
    expect(buildRecentExpenses(undefined).hasData).toBe(false);
    // 明細はあるが支出が無い場合も hasData は false（最新日だけ返る）
    const incomeOnly = buildRecentExpenses([
      item({ date: "2026-11-14", amount: 1000, name: "給与", category: "収入/給与" }),
      null,
    ]);
    expect(incomeOnly.hasData).toBe(false);
    expect(incomeOnly.latestDate).toBe("2026-11-14");
    expect(incomeOnly.groups).toEqual([]);
  });
});
