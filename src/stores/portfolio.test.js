import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePortfolioStore } from "./portfolio";

function successResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

describe("portfolio store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(""),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it("loads live data when api request succeeds", async () => {
    const payload = {
      breakdown: [{ category: "預金", amount_yen: "1,000", percentage: "100" }],
      "total-liability": [{ total_yen: "200" }],
      "breakdown-liability": [{ category: "カード", amount_yen: "200", percentage: "100" }],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successResponse(payload)));

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.loading).toBe(false);
    expect(store.error).toBe("");
    expect(store.source).toBe("live");
    expect(store.data.totals.assetsYen).toBe(1000);
    expect(store.data.totals.liabilitiesYen).toBe(200);
  });

  it("sends bearer token when localStorage has google id token", async () => {
    globalThis.localStorage.getItem.mockReturnValue("token-123");
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ breakdown: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
      headers: { Authorization: "Bearer token-123" },
    });
  });

  it("does not fallback to mock on auth error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        successResponse({ status: 403, error: "forbidden email" }),
      ),
    );

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.source).toBe("");
    expect(store.error).toContain("AUTH 403");
    expect(store.data).toBe(null);
    expect(store.loading).toBe(false);
  });

  it("falls back to mock data when api request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.loading).toBe(false);
    expect(store.source).toBe("mock");
    expect(store.error).toContain("network down");
    expect(store.error).toContain("fallback to mock");
    expect(store.data).toBeTruthy();
    expect(Array.isArray(store.data.holdings.cashLike)).toBe(true);
  });

  it("falls back to mock data when api response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    );

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.source).toBe("mock");
    expect(store.error).toContain("HTTP 503");
    expect(store.loading).toBe(false);
  });
});
