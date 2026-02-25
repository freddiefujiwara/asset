import { defineStore } from "pinia";
import { ref, computed, watchEffect } from "vue";
import { usePortfolioStore } from "./portfolio";
import { calculateAge, USER_BIRTH_DATE, SPOUSE_BIRTH_DATE, DAUGHTER_BIRTH_DATE } from "@/domain/family";
import {
  calculateFirePortfolio,
  getPast5MonthSummary,
  estimateMortgageMonthlyPayment,
} from "@/domain/fire";
import { EMPTY_SUMMARY } from "@/features/fireSimulator/formatters";
import { compressToEncodedURIComponent } from "@/lib/lzString";
import { FIRE_ALGORITHM_CONSTANTS } from "@/domain/fire/pension";

export const useFireSimulatorStore = defineStore("fireSimulator", () => {
  const portfolioStore = usePortfolioStore();
  const data = computed(() => portfolioStore.data);

  // Simulation parameters
  const monthlyInvestment = ref(423000);
  const annualReturnRate = ref(5);
  const currentAge = ref(calculateAge(USER_BIRTH_DATE));
  const includeInflation = ref(true);
  const inflationRate = ref(2);
  const includeTax = ref(true);
  const taxRate = ref(20.315);
  const postFireExtraExpense = ref(60000);
  const retirementLumpSumAtFire = ref(5000000);
  const manualPostFireFirstYearExtraExpense = ref(0);
  const useAutoFirstYearExtra = ref(true);
  const withdrawalRate = ref(4);
  const includeBonus = ref(true);

  const useMonteCarlo = ref(false);
  const monteCarloTrials = ref(1000);
  const monteCarloVolatility = ref(15);
  const monteCarloSeed = ref(123);

  const manualMonthlyExpense = ref(0);
  const useAutoExpense = ref(true);
  const manualRegularMonthlyIncome = ref(0);
  const manualAnnualBonus = ref(0);
  const useAutoIncome = ref(true);
  const useAutoBonus = ref(true);
  const mortgageMonthlyPayment = ref(0);
  const mortgagePayoffDate = ref("2042-05");

  // Derived from portfolio data
  const firePortfolio = computed(() =>
    data.value
      ? calculateFirePortfolio(data.value)
      : { totalAssetsYen: 0, riskAssetsYen: 0, cashAssetsYen: 0, liabilitiesYen: 0, netWorthYen: 0 },
  );
  const initialAssets = computed(() => firePortfolio.value.totalAssetsYen);
  const riskAssets = computed(() => fireSimulatorStore.firePortfolio.riskAssetsYen); // Wait, this is wrong, should be firePortfolio.value

  // Correction:
  const riskAssetsVal = computed(() => firePortfolio.value.riskAssetsYen);
  const cashAssetsVal = computed(() => firePortfolio.value.cashAssetsYen);

  const past5MonthSummary = computed(() =>
    data.value?.cashFlow ? getPast5MonthSummary(data.value.cashFlow) : EMPTY_SUMMARY,
  );

  const autoMonthlyExpense = computed(() => past5MonthSummary.value.monthlyLivingExpenses.average);
  const autoRegularMonthlyIncome = computed(() => past5MonthSummary.value.monthlyRegularIncome.average);
  const autoAnnualBonus = computed(() => past5MonthSummary.value.annualBonus.average);
  const autoMortgageMonthlyPayment = computed(() =>
    data.value?.cashFlow ? estimateMortgageMonthlyPayment(data.value.cashFlow) : 0,
  );

  const monthlyExpense = computed(() => (useAutoExpense.value ? autoMonthlyExpense.value : manualMonthlyExpense.value));
  const regularMonthlyIncome = computed(() =>
    useAutoIncome.value ? autoRegularMonthlyIncome.value : manualRegularMonthlyIncome.value,
  );
  const annualBonus = computed(() =>
    includeBonus.value ? (useAutoBonus.value ? autoAnnualBonus.value : manualAnnualBonus.value) : 0,
  );
  const monthlyIncome = computed(() => regularMonthlyIncome.value + annualBonus.value / 12);

  const autoPostFireFirstYearExtraExpense = computed(() => {
    const annualIncome = monthlyIncome.value * 12;
    return Math.round((annualIncome * 0.15) / 10000) * 10000;
  });

  // Automatically sync manual values when auto values change
  watchEffect(() => {
    if (autoMonthlyExpense.value && useAutoExpense.value) {
      manualMonthlyExpense.value = autoMonthlyExpense.value;
    }
    if (useAutoIncome.value) {
      manualRegularMonthlyIncome.value = autoRegularMonthlyIncome.value;
    }
    if (useAutoBonus.value) {
      manualAnnualBonus.value = autoAnnualBonus.value;
    }
    if (autoMortgageMonthlyPayment.value > 0 && mortgageMonthlyPayment.value === 0) {
      mortgageMonthlyPayment.value = autoMortgageMonthlyPayment.value;
    }
    if (useAutoFirstYearExtra.value) {
      manualPostFireFirstYearExtraExpense.value = autoPostFireFirstYearExtraExpense.value;
    }
  });

  const externalSimulatorUrl = computed(() => {
    const payload = {
      ht: "family",
      sea: 100,
      ubd: USER_BIRTH_DATE,
      sbd: SPOUSE_BIRTH_DATE,
      dbds: [DAUGHTER_BIRTH_DATE],
      ia: 24,
      pc: {
        userStartAge: FIRE_ALGORITHM_CONSTANTS.pension.userStartAge,
        spouseUserAgeStart: FIRE_ALGORITHM_CONSTANTS.pension.spouseUserAgeStart,
        basicFullAnnualYen: FIRE_ALGORITHM_CONSTANTS.pension.basicFullAnnualYen,
        basicReduction: FIRE_ALGORITHM_CONSTANTS.pension.basicReduction,
        earlyReduction: FIRE_ALGORITHM_CONSTANTS.pension.earlyReduction,
        pensionDataAge: FIRE_ALGORITHM_CONSTANTS.pension.pensionDataAge,
        userKoseiAccruedAtDataAgeAnnualYen: FIRE_ALGORITHM_CONSTANTS.pension.userKoseiAccruedAt44AnnualYen,
        userKoseiFutureFactorAnnualYenPerYear: FIRE_ALGORITHM_CONSTANTS.pension.userKoseiFutureFactorAnnualYenPerYear,
      },
      mira: riskAssetsVal.value,
      mica: cashAssetsVal.value,
      mi: monthlyInvestment.value,
      arr: annualReturnRate.value,
      ii: includeInflation.value,
      ir: inflationRate.value,
      it: includeTax.value,
      tr: taxRate.value,
      pfee: postFireExtraExpense.value,
      rlsaf: retirementLumpSumAtFire.value,
      mpffyee: manualPostFireFirstYearExtraExpense.value,
      mpffyeem: true,
      mctsr: 80,
      wr: withdrawalRate.value,
      ib: includeBonus.value,
      umc: useMonteCarlo.value,
      mct: monteCarloTrials.value,
      mcv: monteCarloVolatility.value,
      mcs: monteCarloSeed.value,
      mme: manualMonthlyExpense.value,
      mrmi: manualRegularMonthlyIncome.value,
      mab: manualAnnualBonus.value,
      mabm: true,
      mmp: mortgageMonthlyPayment.value,
      mpd: mortgagePayoffDate.value || "",
    };

    const compressed = compressToEncodedURIComponent(JSON.stringify(payload)).replace(/\+/g, "_");
    return `https://freddiefujiwara.com/fire/${compressed}`;
  });

  return {
    monthlyInvestment,
    annualReturnRate,
    currentAge,
    includeInflation,
    inflationRate,
    includeTax,
    taxRate,
    postFireExtraExpense,
    retirementLumpSumAtFire,
    manualPostFireFirstYearExtraExpense,
    useAutoFirstYearExtra,
    withdrawalRate,
    includeBonus,
    useMonteCarlo,
    monteCarloTrials,
    monteCarloVolatility,
    monteCarloSeed,
    manualMonthlyExpense,
    useAutoExpense,
    manualRegularMonthlyIncome,
    manualAnnualBonus,
    useAutoIncome,
    useAutoBonus,
    mortgageMonthlyPayment,
    mortgagePayoffDate,
    firePortfolio,
    initialAssets,
    riskAssets: riskAssetsVal,
    cashAssets: cashAssetsVal,
    past5MonthSummary,
    autoMonthlyExpense,
    autoRegularMonthlyIncome,
    autoAnnualBonus,
    autoMortgageMonthlyPayment,
    monthlyExpense,
    regularMonthlyIncome,
    annualBonus,
    monthlyIncome,
    externalSimulatorUrl,
    autoPostFireFirstYearExtraExpense,
  };
});
