import { describe, expect, it } from "vitest";
import { assetAmountYen, detectAssetOwner, summarizeFamilyAssets } from "./family";

describe("family domain", () => {
  it("detects owner suffix", () => {
    expect(detectAssetOwner({ 名称: "A@chipop" }).id).toBe("wife");
    expect(detectAssetOwner({ 名称: "B@aojiru.pudding" }).id).toBe("daughter");
    expect(detectAssetOwner({ 名称: "C@freddie" }).id).toBe("me");
  });

  it("extracts amount fields", () => {
    expect(assetAmountYen({ 残高: "1,234" })).toBe(1234);
    expect(assetAmountYen({ 評価額: "500000" })).toBe(500000);
  });

  it("summarizes holdings and daily moves by owner", () => {
    const groups = summarizeFamilyAssets({
      cashLike: [{ 種類・名称: "普通預金@chipop", 残高: "100" }],
      stocks: [{ 銘柄名: "ETF@aojiru.pudding", 評価額: "200", 前日比: "20" }],
      funds: [{ 銘柄名: "All Country", 評価額: "300", 前日比: "-10" }],
      pensions: [],
      points: [],
    });

    expect(groups.find((g) => g.ownerLabel === "妻")?.totalYen).toBe(100);
    expect(groups.find((g) => g.ownerLabel === "娘")?.dailyMoveYen).toBe(20);
    expect(groups.find((g) => g.ownerLabel === "私")?.dailyMoveYen).toBe(-10);
  });
});
