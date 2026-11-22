// Runtime holder for the family config.
//
// The config (owner suffixes, birth dates and the family's FIRE
// assumptions) is served by the backend via action=family_config
// after authentication and populated here by the portfolio store.
// Nothing personal is bundled with the app: until the config is
// loaded, every accessor throws instead of letting a view compute
// with wrong numbers.

let currentConfig = null;

export function setFamilyConfig(config) {
  currentConfig = config ?? null;
}

export function getFamilyConfig() {
  if (!currentConfig) {
    throw new Error("family config is not loaded");
  }
  return currentConfig;
}

export function hasFamilyConfig() {
  return currentConfig !== null;
}

export function resetFamilyConfig() {
  currentConfig = null;
}

export function getOwnerRules() {
  return getFamilyConfig().ownerRules;
}

export function getBirthDates() {
  return getFamilyConfig().birthDates;
}

export function getUserBirthDate() {
  return getBirthDates().user;
}

export function getSpouseBirthDate() {
  return getBirthDates().spouse;
}

export function getDaughterBirthDate() {
  return getBirthDates().daughter;
}

export function getUniversityFundYen() {
  return getFamilyConfig().universityFundYen;
}

export function getSideFireAnnualIncomeYen() {
  return getFamilyConfig().sideFireAnnualIncomeYen;
}

export function getMonthlyInvestmentSelfYen() {
  return getFamilyConfig().monthlyInvestmentSelfYen;
}

export function getMonthlyInvestmentHouseholdYen() {
  const config = getFamilyConfig();
  return config.monthlyInvestmentSelfYen + config.monthlyInvestmentSpouseYen;
}

export function getProgressMilestones() {
  return getFamilyConfig().milestones;
}

export function getMilestoneMonthKey(id) {
  const milestones = getFamilyConfig().milestones;
  const found = Array.isArray(milestones)
    ? milestones.find((milestone) => milestone.id === id)
    : null;
  if (!found) {
    throw new Error(`family config milestone is missing: ${id}`);
  }
  return found.monthKey;
}
