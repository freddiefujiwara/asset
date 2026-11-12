import { describe, it, expect } from "vitest";
import { buildCashFlowReview } from "./review";

const NOW = new Date(2026, 10, 10); // 2026-11-10 → 評価対象は先月 2026-10

function row(date, amount, category, name = "item") {
  return { date, amount, category, name, isTransfer: false };
}

function windowMonths() {
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(2025, 10 + i, 1); // 2025-11 .. 2026-10
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

describe("buildCashFlowReview", () => {
  it("lists categories over the +10% line, sorted by excess, with special expenses separated", () => {
    const cashFlow = [];
    windowMonths().forEach((month) => {
      cashFlow.push(row(`${month}-05`, -10000, "食費/食料品"));
      cashFlow.push(row(`${month}-06`, -1000, "衣服・美容/衣類"));
      cashFlow.push(row(`${month}-07`, -2000, "日用品/消耗品"));
    });
    // 先月だけ衣服・美容が跳ね上がる（合計5,000円）
    cashFlow.push(row("2026-10-20", -4000, "衣服・美容/衣類"));
    // 特別支出と、その他の除外は生活費に含めない
    cashFlow.push(row("2026-10-15", -50000, "特別な支出/旅行", "旅行代金"));
    cashFlow.push(row("2026-10-25", -30000, "カード引き落とし"));
    // 当月の特別支出は先月の集計に入らない
    cashFlow.push(row("2026-11-02", -9999, "特別な支出/家電", "家電購入"));

    const review = buildCashFlowReview(cashFlow, NOW);

    expect(review.month).toBe("2026-10");
    expect(review.livingCostYen).toBe(17000);
    expect(review.averageLivingCostYen).toBe(13333);
    expect(review.livingCostOverAverage).toBe(true);
    expect(review.categories).toEqual([
      {
        label: "衣服・美容",
        monthYen: 5000,
        averageYen: 1333,
        excessYen: 3667,
        ratioPct: 275,
      },
    ]);
    expect(review.special.totalYen).toBe(50000);
    expect(review.special.items).toHaveLength(1);
    expect(review.special.items[0]).toMatchObject({ name: "旅行代金", amountYen: 50000 });
  });

  it("returns an empty review for no data", () => {
    const review = buildCashFlowReview([], NOW);
    expect(review.month).toBe("2026-10");
    expect(review.livingCostYen).toBe(0);
    expect(review.averageLivingCostYen).toBe(0);
    expect(review.livingCostOverAverage).toBe(false);
    expect(review.categories).toEqual([]);
    expect(review.special).toEqual({ totalYen: 0, items: [] });
  });

  it("caps the list at 3 categories in excess order", () => {
    const cashFlow = [];
    const categories = ["食費/食料品", "交通費/電車", "娯楽/映画", "日用品/消耗品"];
    windowMonths().forEach((month) => {
      categories.forEach((category) => cashFlow.push(row(`${month}-05`, -1000, category)));
    });
    // 先月の追加支出で超過額に差をつける（6000/5000/4000/3000 相当）
    cashFlow.push(row("2026-10-10", -5000, "食費/食料品"));
    cashFlow.push(row("2026-10-10", -4000, "交通費/電車"));
    cashFlow.push(row("2026-10-10", -3000, "娯楽/映画"));
    cashFlow.push(row("2026-10-10", -2000, "日用品/消耗品"));

    const review = buildCashFlowReview(cashFlow, NOW);
    expect(review.categories.map((category) => category.label)).toEqual([
      "食費",
      "交通費",
      "娯楽",
    ]);
  });
});

describe("buildCashFlowReview edge cases", () => {
  it("handles a missing cash flow list", () => {
    const review = buildCashFlowReview(null, NOW);
    expect(review.month).toBe("2026-10");
    expect(review.livingCostYen).toBe(0);
    expect(review.categories).toEqual([]);
    expect(buildCashFlowReview(undefined, NOW).livingCostYen).toBe(0);
  });

  it("ignores income and transfer rows in the target month", () => {
    const review = buildCashFlowReview(
      [
        row("2026-10-01", 300000, "収入/給与"),
        { date: "2026-10-02", amount: -20000, category: "食費/食料品", name: "振替", isTransfer: true },
      ],
      NOW,
    );
    expect(review.livingCostYen).toBe(0);
    expect(review.categories).toEqual([]);
  });

  it("groups rows without a category under 未分類", () => {
    const review = buildCashFlowReview(
      [{ date: "2026-10-03", amount: -7000, name: "不明な出金", isTransfer: false }],
      NOW,
    );
    expect(review.livingCostYen).toBe(7000);
    expect(review.categories[0].label).toBe("未分類");
  });

  it("groups empty and slash-prefixed categories under 未分類", () => {
    const review = buildCashFlowReview(
      [
        row("2026-10-03", -1000, ""),
        row("2026-10-04", -2000, "/その他"),
      ],
      NOW,
    );
    expect(review.livingCostYen).toBe(3000);
    expect(review.categories[0]).toMatchObject({ label: "未分類", monthYen: 3000 });
  });

  it("combines categories seen only in the target month or only in the window", () => {
    const cashFlow = [];
    windowMonths().forEach((month) => {
      cashFlow.push(row(`${month}-05`, -10000, "食費/食料品"));
      if (month !== "2026-10") {
        cashFlow.push(row(`${month}-06`, -1000, "日用品/消耗品"));
      }
    });
    // 先月だけに現れる少額カテゴリ（12か月平均は0に丸められるが比率は生の平均で計算される）
    cashFlow.push(row("2026-10-20", -3, "趣味・娯楽/旅行"));
    const review = buildCashFlowReview(cashFlow, NOW);
    const newCategory = review.categories.find((category) => category.label === "趣味・娯楽");
    expect(newCategory).toMatchObject({ monthYen: 3, averageYen: 0, ratioPct: 1100 });
    // 窓にだけあるカテゴリは、先月の支出が0で掲載条件にも掛からない
    const windowOnly = review.categories.find((category) => category.label === "日用品");
    expect(windowOnly).toBeUndefined();
  });
});
