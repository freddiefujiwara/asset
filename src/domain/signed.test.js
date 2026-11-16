import { describe, expect, it } from "vitest";
import { diffRatePct, formatSignedPercent, signedClass, totalProfitRate } from "./signed";

describe("signed domain", () => {
  it("returns sign classes", () => {
    expect(signedClass(10)).toBe("is-positive");
    expect(signedClass(-1)).toBe("is-negative");
    expect(signedClass(0)).toBe("");
  });

  it("formats signed percent", () => {
    expect(formatSignedPercent(1.234)).toBe("+1.23%");
    expect(formatSignedPercent(-1.239, 1)).toBe("-1.2%");
    expect(formatSignedPercent(0)).toBe("±0.00%");
    expect(formatSignedPercent(null)).toBe("-");
  });

  it("calculates the change rate against the base value", () => {
    expect(diffRatePct(100, 1000)).toBeCloseTo(10);
    expect(diffRatePct(-30000, 1030000)).toBeCloseTo(-2.9126, 3);
    expect(diffRatePct(0, 1000)).toBe(0);
    expect(diffRatePct(100, 0)).toBeNull();
  });

  it("calculates total profit rate with edge cases", () => {
    expect(totalProfitRate(0, 0)).toBe(0);
    expect(totalProfitRate(100, 100)).toBeNull();
    expect(totalProfitRate(110, 10)).toBeCloseTo(10);
  });
});
