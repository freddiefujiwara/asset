import { describe, expect, it } from "vitest";
import * as familyDomain from "./family";
import { setFamilyConfig } from "./familyConfig";
import { DUMMY_FAMILY_CONFIG } from "../../tests/helpers/dummyFamilyConfig";
import { assetAmountYen, detectAssetOwner, summarizeFamilyAssets, assetDisplayName, ownerFromText, calculateAge } from "./family";

describe("family domain", () => {
  it("keeps expected exported functions on the family barrel", () => {
    expect(familyDomain).toMatchObject({
      getUserBirthDate: expect.any(Function),
      getSpouseBirthDate: expect.any(Function),
      getDaughterBirthDate: expect.any(Function),
      calculateAge: expect.any(Function),
      ownerFromText: expect.any(Function),
      detectAssetOwner: expect.any(Function),
      assetAmountYen: expect.any(Function),
      assetDisplayName: expect.any(Function),
      summarizeFamilyAssets: expect.any(Function),
    });
  });

  it("calculates age correctly", () => {
    // Born 1980-06-15. On 2024-06-14, should be 43. On 2024-06-15, should be 44.
    const birthDate = "1980-06-15";
    expect(calculateAge(birthDate, new Date("2024-06-14"))).toBe(43);
    expect(calculateAge(birthDate, new Date("2024-06-15"))).toBe(44);
    expect(calculateAge(birthDate, new Date("2024-01-01"))).toBe(43);
    expect(calculateAge(birthDate, new Date("2025-01-01"))).toBe(44);
  });

  it("falls back to the owner id as label when a rule is missing", () => {
    setFamilyConfig({
      ...DUMMY_FAMILY_CONFIG,
      ownerRules: [{ id: "wife", label: "妻", suffix: "@spouse.test" }],
    });
    const summary = summarizeFamilyAssets({ cashLike: [], stocks: [], funds: [], pensions: [], points: [] });
    // Groups come back in [me, wife, daughter] order.
    expect(summary[2].ownerLabel).toBe("daughter");
  });

  it("detects owner suffix", () => {
    expect(detectAssetOwner({ 名称: "A@spouse.test" }).id).toBe("wife");
    expect(detectAssetOwner({ 名称: "B@child.test" }).id).toBe("daughter");
    expect(detectAssetOwner({ 名称: "C@freddie" }).id).toBe("me");
  });

  it("extracts amount fields", () => {
    expect(assetAmountYen({ 残高: "1,234" })).toBe(1234);
    expect(assetAmountYen({ 評価額: "500000" })).toBe(500000);
  });

  it("summarizes holdings and daily moves by owner", () => {
    const groups = summarizeFamilyAssets({
      cashLike: [{ 種類・名称: "普通預金@spouse.test", 残高: "100" }],
      stocks: [{ 銘柄名: "ETF@child.test", 評価額: "200", 前日比: "20", 評価損益: "50", 評価損益率: "33.3" }],
      funds: [{ 銘柄名: "All Country", 評価額: "300", 前日比: "-10", 評価損益: "30", 評価損益率: "11.1" }],
      pensions: [],
      points: [],
    });

    expect(groups.find((g) => g.ownerLabel === "妻")?.totalYen).toBe(100);
    expect(groups.find((g) => g.ownerLabel === "娘")?.dailyMoveYen).toBe(20);
    expect(groups.find((g) => g.ownerLabel === "私")?.dailyMoveYen).toBe(-10);
    expect(groups.find((g) => g.ownerLabel === "娘")?.profitYen).toBe(50);
    expect(groups.find((g) => g.ownerLabel === "私")?.profitRatePct).toBeCloseTo(11.111, 3);
    expect(groups.find((g) => g.ownerLabel === "娘")?.items[0]?.profitRatePct).toBe(33.3);
  });

  it("treats holdings without daily-move or profit fields as no move and no profit", () => {
    const groups = summarizeFamilyAssets({
      cashLike: [],
      stocks: [{ 銘柄名: "Plain@freddie", 評価額: "400" }],
      funds: [],
      pensions: [],
      points: [],
    });

    const me = groups.find((g) => g.ownerLabel === "私");
    expect(me?.totalYen).toBe(400);
    expect(me?.dailyMoveYen).toBe(0);
    expect(me?.profitYen).toBe(0);
  });

  it("returns null group profit rate when principal is zero", () => {
    const groups = summarizeFamilyAssets({
      cashLike: [],
      stocks: [{ 銘柄名: "HighRisk", 評価額: "100", 評価損益: "100", 評価損益率: "999" }],
      funds: [],
      pensions: [],
      points: [],
    });

    expect(groups.find((g) => g.ownerLabel === "私")?.profitRatePct).toBeNull();
  });

  it("treats missing holdings object safely", () => {
    const groups = summarizeFamilyAssets();

    expect(groups).toHaveLength(3);
    expect(groups.every((group) => group.totalYen === 0)).toBe(true);
    expect(groups.every((group) => group.profitRatePct === 0)).toBe(true);
  });

  it("handles null or non-object in detectAssetOwner", () => {
    expect(detectAssetOwner(null).id).toBe("me");
    expect(detectAssetOwner("not an object").id).toBe("me");
  });

  it("handles null or non-object in assetAmountYen", () => {
    expect(assetAmountYen(null)).toBe(0);
    expect(assetAmountYen(undefined)).toBe(0);
  });

  it("returns zero if no amount field found in assetAmountYen", () => {
    expect(assetAmountYen({ no_amount: "100" })).toBe(0);
  });

  it("handles null text in ownerFromText", () => {
    expect(ownerFromText(null).id).toBe("me");
    expect(ownerFromText(undefined).id).toBe("me");
  });

  it("falls through all fields in assetDisplayName", () => {
    expect(assetDisplayName({})).toBe("-");
    expect(assetDisplayName({ "種類": "TypeA" })).toBe("TypeA");
    expect(assetDisplayName({ "名称": "NameB" })).toBe("NameB");
    expect(assetDisplayName({ "銘柄名": "StockC" })).toBe("StockC");
    expect(assetDisplayName({ "種類・名称": "CategoryD" })).toBe("CategoryD");
    expect(assetDisplayName({ "名称・説明": "FullE" })).toBe("FullE");
  });

});
