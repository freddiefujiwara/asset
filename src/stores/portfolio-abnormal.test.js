import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePortfolioStore } from "./portfolio";
import { DUMMY_FAMILY_CONFIG } from "../../tests/helpers/dummyFamilyConfig";

// The store fetches action=family_config right after a successful
// data fetch; route that call to the dummy config and delegate
// every other call to the test's own data mock.
function stubFetchWithFamilyConfig(dataFetch) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      String(url).includes("action=family_config")
        ? successResponse(DUMMY_FAMILY_CONFIG)
        : dataFetch(url),
    ),
  );
}

function successResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

describe("portfolio store with deformed surroundings", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(""),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn().mockReturnValue(""),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it("a malformed share fragment does not wedge the load", async () => {
    // A share link whose token is not valid percent-encoding (truncated
    // or hand-edited). parseShareToken runs before fetchPortfolio's
    // try/catch, so a throw here leaves `loading` stuck at true.
    vi.stubGlobal("location", { hash: "#share=%E0%A4%A" });
    stubFetchWithFamilyConfig(
      vi.fn().mockResolvedValue(successResponse({ breakdown: [] })),
    );

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.loading).toBe(false);
    expect(store.source).toBe("live");
    expect(store.shareMode).toBe(false);
    expect(store.data).not.toBeNull();
  });

  it("one unstringifiable field in the payload does not lose the whole response", async () => {
    vi.stubGlobal("location", { hash: "" });
    const payload = {
      breakdown: [{ category: "預金", amount_yen: "1,000", percentage: "100" }],
      snapshots: [{ month: { toString: [] }, total_assets: "100" }],
    };
    stubFetchWithFamilyConfig(vi.fn().mockResolvedValue(successResponse(payload)));

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.loading).toBe(false);
    expect(store.source).toBe("live");
    expect(store.error).toBe("");
    expect(store.data.totals.assetsYen).toBe(1000);
    expect(store.data.snapshots).toEqual([]);
  });
});
