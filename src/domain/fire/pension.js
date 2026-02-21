import { USER_BIRTH_DATE, SPOUSE_BIRTH_DATE, DAUGHTER_BIRTH_DATE } from "../family";

const PENSION_USER_START_AGE = 60;
const PENSION_SPOUSE_USER_AGE_START = 62; // Spouse (1976) age 65 when User (1979) is 62
const PENSION_BASIC_FULL = 780000;
const PENSION_BASIC_REDUCTION = 0.9; // 10% reduction for 4 years gap
const PENSION_EARLY_REDUCTION = 0.76; // 24% reduction for starting at 60
const PENSION_DATA_AGE = 44; // Age at which premium data was provided
const PENSION_USER_KOSEN_ACCRUED_AT_44 = 892252; // Accrued Employees' Pension based on 14.9M premiums
const PENSION_USER_KOSEN_FUTURE_FACTOR = 42000; // Estimated future accrual per year worked

export const FIRE_ALGORITHM_CONSTANTS = {
  pension: {
    userStartAge: PENSION_USER_START_AGE,
    spouseUserAgeStart: PENSION_SPOUSE_USER_AGE_START,
    basicFullAnnualYen: PENSION_BASIC_FULL,
    basicReduction: PENSION_BASIC_REDUCTION,
    earlyReduction: PENSION_EARLY_REDUCTION,
    pensionDataAge: PENSION_DATA_AGE,
    userKoseiAccruedAt44AnnualYen: PENSION_USER_KOSEN_ACCRUED_AT_44,
    userKoseiFutureFactorAnnualYenPerYear: PENSION_USER_KOSEN_FUTURE_FACTOR,
  },
  familyBirthDates: {
    user: USER_BIRTH_DATE,
    spouse: SPOUSE_BIRTH_DATE,
    daughter: DAUGHTER_BIRTH_DATE,
  },
};

/**
 * Calculate monthly pension amount for one user age.
 */
export function calculateMonthlyPension(age, fireAge) {
  let totalAnnual = 0;

  if (age >= PENSION_USER_START_AGE) {
    const basicPart = PENSION_BASIC_FULL * PENSION_BASIC_REDUCTION * PENSION_EARLY_REDUCTION;
    const participationEndAge = Math.min(60, fireAge);
    const futureYears = Math.max(0, participationEndAge - PENSION_DATA_AGE);
    const employeesPartAt65 = PENSION_USER_KOSEN_ACCRUED_AT_44 + futureYears * PENSION_USER_KOSEN_FUTURE_FACTOR;

    totalAnnual += basicPart + employeesPartAt65 * PENSION_EARLY_REDUCTION;
  }

  if (age >= PENSION_SPOUSE_USER_AGE_START) {
    totalAnnual += PENSION_BASIC_FULL;
  }

  return Math.round(totalAnnual / 12);
}
