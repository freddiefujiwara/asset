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
