import { describe, expect, it } from "vitest";
import {
  ATTENTION_ITEM_LIMIT,
  ATTENTION_SPECIAL_EXPENSE_YEN,
  CARD_STATUS,
  DEADLINE_DISPLAY_LEAD_DAYS,
  MONTHLY_CHECKLIST_ITEMS,
  buildAttentionItems,
  buildDeadlineItems,
  buildFreshnessCard,
  buildHeadline,
  buildInvestmentCard,
  buildLivingCostCard,
  buildMilestoneCard,
  buildMonthlyChecklist,
  buildMonthlyChanges,
  buildSpecialExpenseCard,
  checklistStorageKey,
  isInvestmentExecution,
  listSpecialExpenses,
  parseChecklistState,
  shiftMonthKey,
  sumInvestmentExecutions,
} from "./home";
import { DEADLINE_DEFINITIONS } from "@/config/deadlines";

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

describe("buildDeadlineItems with the configured definitions", () => {
  it("shows the iDeCo window and the share link expiry 45 days ahead, sorted by countdown", () => {
    const items = buildDeadlineItems(DEADLINE_DEFINITIONS, new Date(2026, 10, 17));
    expect(items.map((item) => item.id)).toEqual([
      "ideco-increase-application",
      "share-link-expiry",
    ]);
    expect(items[0]).toMatchObject({
      kind: "window",
      phase: "upcoming",
      daysUntilStart: 14,
      countdownDays: 14,
      targetDate: "2026-12-01",
    });
    expect(items[1]).toMatchObject({
      kind: "deadline",
      phase: "upcoming",
      daysUntilEnd: 15,
      countdownDays: 15,
      targetDate: "2026-12-02",
    });
  });

  it("counts down to the window end while the iDeCo window is open, and drops the expired link", () => {
    const items = buildDeadlineItems(DEADLINE_DEFINITIONS, new Date(2026, 11, 10));
    expect(items.map((item) => item.id)).toEqual([
      "ideco-increase-application",
      "chatgpt-business-cancel",
    ]);
    expect(items[0]).toMatchObject({ phase: "active", daysUntilStart: 0, daysUntilEnd: 14, countdownDays: 14, targetDate: "2026-12-24" });
    expect(items[1]).toMatchObject({ phase: "upcoming", countdownDays: 30, targetDate: "2027-01-09" });
  });

  it("shows the OpenMoney repost countdown and marks it available from the start date", () => {
    const before = buildDeadlineItems(DEADLINE_DEFINITIONS, new Date(2027, 0, 20));
    expect(before.map((item) => item.id)).toEqual(["openmoney-repost"]);
    expect(before[0]).toMatchObject({ kind: "available-from", phase: "upcoming", daysUntilStart: 8, countdownDays: 8 });

    const onDay = buildDeadlineItems(DEADLINE_DEFINITIONS, new Date(2027, 0, 28));
    expect(onDay).toHaveLength(1);
    expect(onDay[0]).toMatchObject({ phase: "active", daysUntilStart: 0, countdownDays: 0 });

    // 終了日が無いため、開始後も「対応可能」として残る
    const later = buildDeadlineItems(DEADLINE_DEFINITIONS, new Date(2027, 2, 1));
    expect(later.map((item) => item.id)).toEqual(["openmoney-repost"]);
  });

  it("hides a deadline on the day after it passes", () => {
    const items = buildDeadlineItems(DEADLINE_DEFINITIONS, new Date(2027, 0, 10));
    expect(items.map((item) => item.id)).not.toContain("chatgpt-business-cancel");
  });
});

describe("buildDeadlineItems rules", () => {
  const windowDef = {
    id: "w",
    label: "期間もの",
    kind: "window",
    startDate: "2026-12-01",
    endDate: "2026-12-24",
  };

  it("shows a window exactly 45 days before it starts but not 46 days before", () => {
    expect(buildDeadlineItems([windowDef], new Date(2026, 9, 17))).toHaveLength(1);
    expect(buildDeadlineItems([windowDef], new Date(2026, 9, 16))).toHaveLength(0);
  });

  it("keeps a window on its last day and hides it the day after", () => {
    const lastDay = buildDeadlineItems([windowDef], new Date(2026, 11, 24));
    expect(lastDay[0]).toMatchObject({ phase: "active", countdownDays: 0 });
    expect(buildDeadlineItems([windowDef], new Date(2026, 11, 25))).toHaveLength(0);
  });

  it("shows a deadline exactly 45 days ahead but not 46", () => {
    const def = { id: "d", label: "締切", kind: "deadline", endDate: "2026-12-02" };
    expect(buildDeadlineItems([def], new Date(2026, 9, 18))).toHaveLength(1);
    expect(buildDeadlineItems([def], new Date(2026, 9, 17))).toHaveLength(0);
    expect(buildDeadlineItems([def], new Date(2026, 11, 2))[0]).toMatchObject({ countdownDays: 0 });
    expect(buildDeadlineItems([def], new Date(2026, 11, 3))).toHaveLength(0);
  });

  it("shows an available-from item exactly 45 days ahead but not 46", () => {
    const def = { id: "a", label: "開始", kind: "available-from", startDate: "2027-01-28" };
    expect(buildDeadlineItems([def], new Date(2026, 11, 14))).toHaveLength(1);
    expect(buildDeadlineItems([def], new Date(2026, 11, 13))).toHaveLength(0);
  });

  it("sorts by countdown and breaks ties by id", () => {
    const defs = [
      { id: "b-item", label: "B", kind: "deadline", endDate: "2026-12-10" },
      { id: "a-item", label: "A", kind: "deadline", endDate: "2026-12-10" },
      { id: "c-item", label: "C", kind: "deadline", endDate: "2026-12-05" },
    ];
    const items = buildDeadlineItems(defs, new Date(2026, 11, 1));
    expect(items.map((item) => item.id)).toEqual(["c-item", "a-item", "b-item"]);
  });

  it("defaults the note to an empty string", () => {
    const def = { id: "d", label: "締切", kind: "deadline", endDate: "2026-12-02" };
    expect(buildDeadlineItems([def], new Date(2026, 11, 1))[0].note).toBe("");
  });

  it("skips invalid definitions", () => {
    const defs = [
      null,
      "not-an-object",
      { label: "IDなし", kind: "deadline", endDate: "2026-12-02" },
      { id: "no-label", kind: "deadline", endDate: "2026-12-02" },
      { id: "bad-format", label: "x", kind: "deadline", endDate: "2026/12/02" },
      { id: "bad-month", label: "x", kind: "deadline", endDate: "2026-13-01" },
      { id: "bad-day", label: "x", kind: "deadline", endDate: "2026-02-30" },
      { id: "no-end", label: "x", kind: "deadline" },
      { id: "reversed", label: "x", kind: "window", startDate: "2026-12-24", endDate: "2026-12-01" },
      { id: "window-bad-start", label: "x", kind: "window", startDate: "oops", endDate: "2026-12-01" },
      { id: "window-bad-end", label: "x", kind: "window", startDate: "2026-12-01", endDate: "oops" },
      { id: "no-start", label: "x", kind: "available-from" },
      { id: "unknown-kind", label: "x", kind: "other", startDate: "2026-12-01", endDate: "2026-12-02" },
    ];
    expect(buildDeadlineItems(defs, new Date(2026, 11, 1))).toEqual([]);
  });

  it("returns an empty list for missing or non-array definitions", () => {
    expect(buildDeadlineItems(null, NOW)).toEqual([]);
    expect(buildDeadlineItems(undefined, NOW)).toEqual([]);
    expect(DEADLINE_DISPLAY_LEAD_DAYS).toBe(45);
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

  it("falls back to the current net assets with a single snapshot", () => {
    expect(
      buildHeadline({ snapshots: snapshots.slice(1), currentNetAssetsYen: 67000000 }),
    ).toEqual({
      hasComparison: false,
      month: "2026-11",
      previousMonth: "",
      netAssetsYen: 67000000,
      diffYen: null,
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

describe("buildMonthlyChecklist", () => {
  it("marks stored items as checked", () => {
    const items = buildMonthlyChecklist(["fire-progress"]);
    expect(items.find((item) => item.id === "fire-progress")).toMatchObject({ checked: true, auto: false });
    expect(items.find((item) => item.id === "special-expenses")).toMatchObject({ checked: false, auto: false });
  });

  it("marks auto items as checked regardless of the stored state", () => {
    const items = buildMonthlyChecklist([], ["investment-standard"]);
    expect(items.find((item) => item.id === "investment-standard")).toMatchObject({ checked: true, auto: true });
  });

  it("handles missing state", () => {
    expect(buildMonthlyChecklist(null).every((item) => !item.checked && !item.auto)).toBe(true);
    expect(buildMonthlyChecklist(undefined, null).every((item) => !item.checked)).toBe(true);
  });
});
