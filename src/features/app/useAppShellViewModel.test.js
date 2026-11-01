import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const portfolioState = ref({
  data: null,
  loading: false,
  source: "mock",
  error: "",
  rawResponse: null,
  shareMode: false,
  shareExpiresAt: "",
});

vi.mock("@/stores/portfolio", () => ({
  usePortfolioStore: () => ({
    get data() { return portfolioState.value.data; },
    set data(value) { portfolioState.value.data = value; },
    get loading() { return portfolioState.value.loading; },
    get source() { return portfolioState.value.source; },
    set source(value) { portfolioState.value.source = value; },
    get error() { return portfolioState.value.error ?? ""; },
    set error(value) { portfolioState.value.error = value; },
    get rawResponse() { return portfolioState.value.rawResponse; },
    get shareMode() { return portfolioState.value.shareMode ?? false; },
    get shareExpiresAt() { return portfolioState.value.shareExpiresAt ?? ""; },
    fetchPortfolio: vi.fn(),
  }),
}));
const uiMock = { privacyMode: false, togglePrivacy: vi.fn(), setPrivacySuspended: vi.fn() };
vi.mock("@/stores/ui", () => ({ useUiStore: () => uiMock }));

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

  describe("share mode", () => {
    it("hides the login gate and shows content state when share data is loaded", () => {
      portfolioState.value = {
        data: { totals: {} },
        loading: false,
        source: "live",
        error: "",
        rawResponse: {},
        shareMode: true,
        shareExpiresAt: new Date(2026, 11, 2, 7, 53).toISOString(),
      };
      const vm = useAppShellViewModel();
      expect(vm.showLoginGate.value).toBe(false);
      expect(vm.showShareExpired.value).toBe(false);
      expect(vm.shareExpiresLabel.value).toBe("20261202 07:53");
    });

    it("shows the expired state instead of the login gate for a dead share link", () => {
      portfolioState.value = {
        data: null,
        loading: false,
        source: "",
        error: "AUTH 401: share session expired or invalid",
        rawResponse: null,
        shareMode: true,
        shareExpiresAt: "",
      };
      const vm = useAppShellViewModel();
      expect(vm.showLoginGate.value).toBe(false);
      expect(vm.showShareExpired.value).toBe(true);
      expect(vm.shareExpiresLabel.value).toBe("");
    });

    it("suspends privacy masking while share mode is active", () => {
      uiMock.setPrivacySuspended.mockClear();
      portfolioState.value = {
        data: null,
        loading: false,
        source: "mock",
        error: "",
        rawResponse: null,
        shareMode: true,
        shareExpiresAt: "",
      };
      useAppShellViewModel();
      expect(uiMock.setPrivacySuspended).toHaveBeenCalledWith(true);
    });
  });
});
