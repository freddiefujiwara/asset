import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const portfolioState = ref({
  data: null,
  loading: false,
  source: "mock",
  error: "",
  rawResponse: null,
});

vi.mock("@/stores/portfolio", () => ({
  usePortfolioStore: () => ({
    get data() { return portfolioState.value.data; },
    get loading() { return portfolioState.value.loading; },
    get source() { return portfolioState.value.source; },
    get error() { return portfolioState.value.error ?? ""; },
    get rawResponse() { return portfolioState.value.rawResponse; },
    fetchPortfolio: vi.fn(),
  }),
}));
vi.mock("@/stores/ui", () => ({ useUiStore: () => ({ privacyMode: false, togglePrivacy: vi.fn() }) }));

import { useAppShellViewModel } from "@/features/app/useAppShellViewModel";

describe("useAppShellViewModel", () => {
  it("exposes header actions and gate state", () => {
    const vm = useAppShellViewModel();
    expect(vm.themeLabel.value).toBe("☀️ ライト");
    expect(typeof vm.toggleTheme).toBe("function");
    expect(typeof vm.togglePrivacy).toBe("function");
    expect(vm.showLoginGate.value).toBe(true);
  });

  describe("isFireEnabled", () => {
    it("is false when idToken is missing", () => {
      const vm = useAppShellViewModel();
      vm.idToken.value = "";
      portfolioState.value = { source: "live", rawResponse: {}, data: {}, error: "" };
      expect(vm.isFireEnabled.value).toBe(false);
    });

    it("is false when source is not live", () => {
      const vm = useAppShellViewModel();
      vm.idToken.value = "token";
      portfolioState.value = { source: "mock", rawResponse: {}, data: {}, error: "" };
      expect(vm.isFireEnabled.value).toBe(false);
    });

    it("is false when rawResponse has error", () => {
      const vm = useAppShellViewModel();
      vm.idToken.value = "token";
      portfolioState.value = { source: "live", rawResponse: { error: "something went wrong" }, data: {}, error: "" };
      expect(vm.isFireEnabled.value).toBe(false);
    });

    it("is true when idToken exists, source is live, and no error in rawResponse", () => {
      const vm = useAppShellViewModel();
      vm.idToken.value = "token";
      portfolioState.value = { source: "live", rawResponse: { data: {} }, data: {}, error: "" };
      expect(vm.isFireEnabled.value).toBe(true);
    });
  });
});
