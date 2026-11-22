import { beforeEach, describe, expect, it } from "vitest";
import {
  getBirthDates,
  getDaughterBirthDate,
  getFamilyConfig,
  getMilestoneMonthKey,
  getMonthlyInvestmentHouseholdYen,
  getMonthlyInvestmentSelfYen,
  getOwnerRules,
  getProgressMilestones,
  getSideFireAnnualIncomeYen,
  getSpouseBirthDate,
  getUniversityFundYen,
  getUserBirthDate,
  hasFamilyConfig,
  resetFamilyConfig,
  setFamilyConfig,
} from "./familyConfig";
import { DUMMY_FAMILY_CONFIG } from "../../tests/helpers/dummyFamilyConfig";

describe("familyConfig", () => {
  beforeEach(() => {
    resetFamilyConfig();
  });

  it("throws until a config is loaded", () => {
    expect(hasFamilyConfig()).toBe(false);
    expect(() => getFamilyConfig()).toThrow("family config is not loaded");
    expect(() => getOwnerRules()).toThrow("family config is not loaded");
  });

  it("exposes every accessor once loaded", () => {
    setFamilyConfig(DUMMY_FAMILY_CONFIG);
    expect(hasFamilyConfig()).toBe(true);
    expect(getFamilyConfig()).toBe(DUMMY_FAMILY_CONFIG);
    expect(getOwnerRules()).toEqual(DUMMY_FAMILY_CONFIG.ownerRules);
    expect(getBirthDates()).toEqual(DUMMY_FAMILY_CONFIG.birthDates);
    expect(getUserBirthDate()).toBe("1980-01-01");
    expect(getSpouseBirthDate()).toBe("1982-02-02");
    expect(getDaughterBirthDate()).toBe("2015-03-03");
    expect(getUniversityFundYen()).toBe(9000000);
    expect(getSideFireAnnualIncomeYen()).toBe(3600000);
    expect(getMonthlyInvestmentSelfYen()).toBe(310000);
    expect(getMonthlyInvestmentHouseholdYen()).toBe(400000);
    expect(getProgressMilestones()).toEqual(DUMMY_FAMILY_CONFIG.milestones);
  });

  it("resolves milestone month keys by id", () => {
    setFamilyConfig(DUMMY_FAMILY_CONFIG);
    expect(getMilestoneMonthKey("daughter-independence")).toBe("2039-04");
    expect(getMilestoneMonthKey("mortgage-payoff")).toBe("2044-06");
  });

  it("throws for an unknown milestone id", () => {
    setFamilyConfig(DUMMY_FAMILY_CONFIG);
    expect(() => getMilestoneMonthKey("nope")).toThrow(
      "family config milestone is missing: nope",
    );
  });

  it("throws when the milestones list is not an array", () => {
    setFamilyConfig({ ...DUMMY_FAMILY_CONFIG, milestones: null });
    expect(() => getMilestoneMonthKey("age-50")).toThrow(
      "family config milestone is missing: age-50",
    );
  });

  it("treats a null config as not loaded", () => {
    setFamilyConfig(null);
    expect(hasFamilyConfig()).toBe(false);
    expect(() => getFamilyConfig()).toThrow("family config is not loaded");
  });

  it("reset clears the loaded config", () => {
    setFamilyConfig(DUMMY_FAMILY_CONFIG);
    resetFamilyConfig();
    expect(hasFamilyConfig()).toBe(false);
  });
});
