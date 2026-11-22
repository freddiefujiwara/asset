// Global test setup: the domain engines read the family config
// (owner suffixes, birth dates, FIRE assumptions) from a runtime
// holder that the portfolio store populates after login. Seed it
// with the dummy config so tests exercise the engines directly.
import { beforeEach } from "vitest";
import { setFamilyConfig } from "../src/domain/familyConfig";
import { DUMMY_FAMILY_CONFIG } from "./helpers/dummyFamilyConfig";

// Seed once at setup time too: some suites compute fixtures at
// describe-body level, before any beforeEach hook runs.
setFamilyConfig(DUMMY_FAMILY_CONFIG);

beforeEach(() => {
  setFamilyConfig(DUMMY_FAMILY_CONFIG);
});
