// Dummy family config for tests. Every value here is fictional:
// it exists so the domain engines (which read the real config from
// the backend after login) can run under test.
export const DUMMY_FAMILY_CONFIG = {
  ownerRules: [
    { id: "wife", label: "妻", suffix: "@spouse.test" },
    { id: "daughter", label: "娘", suffix: "@child.test" },
  ],
  birthDates: {
    user: "1980-01-01",
    spouse: "1982-02-02",
    daughter: "2015-03-03",
  },
  universityFundYen: 9000000,
  sideFireAnnualIncomeYen: 3600000,
  monthlyInvestmentSelfYen: 310000,
  monthlyInvestmentSpouseYen: 90000,
  milestones: [
    { id: "age-50", label: "50歳", monthKey: "2030-01" },
    { id: "daughter-independence", label: "娘の独立", monthKey: "2039-04" },
    { id: "mortgage-payoff", label: "住宅ローン完済", monthKey: "2044-06" },
  ],
};
