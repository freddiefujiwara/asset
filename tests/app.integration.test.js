import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { defineComponent, reactive, nextTick } from "vue";
import App from "@/App.vue";

let portfolioStore;
let uiStore;
let fetchPortfolioMock;

vi.mock("@/stores/portfolio", () => ({
  usePortfolioStore: () => portfolioStore,
}));

vi.mock("@/stores/ui", () => ({
  useUiStore: () => uiStore,
}));

function makeRouter(initialPath = "/") {
  const Dummy = (name) => defineComponent({ template: `<div>${name}</div>` });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", redirect: "/balance-sheet" },
      { path: "/balance-sheet", component: Dummy("balance-sheet-view") },
      { path: "/holdings", redirect: "/balance-sheet" },
      { path: "/cash-flow", component: Dummy("cash-flow-view") },
      { path: "/fire", component: Dummy("fire-view") },
    ],
  });
  router.push(initialPath);
  return router;
}

describe("App cross-screen integration", () => {
  beforeEach(() => {
    fetchPortfolioMock = vi.fn();
    portfolioStore = reactive({
      data: null,
      loading: false,
      error: "",
      source: "",
      fetchPortfolio: fetchPortfolioMock,
    });

    uiStore = reactive({
      privacyMode: false,
      togglePrivacy: vi.fn(),
    });

    localStorage.clear();
  });

  it("shows login gate when token is missing and live data is unavailable", async () => {
    const router = makeRouter("/balance-sheet");
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.text()).toContain("Googleログインが必要です");
    expect(wrapper.text()).not.toContain("balance-sheet-view");
  });

  it("renders route content when token exists", async () => {
    localStorage.setItem("asset-google-id-token", "dummy-token");

    const router = makeRouter("/cash-flow");
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    await nextTick();
    await nextTick();

    expect(wrapper.text()).toContain("cash-flow-view");
    expect(wrapper.text()).not.toContain("Googleログインが必要です");
  });

  it("logs out and refetches when auth error occurs with existing token", async () => {
    localStorage.setItem("asset-google-id-token", "dummy-token");
    const removeSpy = vi.spyOn(Storage.prototype, "removeItem");

    const router = makeRouter("/fire");
    await router.isReady();

    mount(App, {
      global: {
        plugins: [router],
      },
    });

    expect(fetchPortfolioMock).toHaveBeenCalledTimes(1);

    portfolioStore.error = "AUTH 401";
    await nextTick();
    await nextTick();

    expect(removeSpy).toHaveBeenCalledWith("asset-google-id-token");
    expect(fetchPortfolioMock).toHaveBeenCalledTimes(2);

    removeSpy.mockRestore();
  });
});
