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
    expect(store.rawResponse).toEqual(payload);
    expect(store.data.totals.assetsYen).toBe(1000);
    expect(store.data.totals.liabilitiesYen).toBe(200);
  });

  it("loads cashFlow data when present in api response", async () => {
    const payload = {
      breakdown: [],
      mfcf: [
        { date: "2026-02-12", amount: -3000, currency: "JPY", name: "Shop", category: "Food", is_transfer: false }
      ]
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successResponse(payload)));

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.data.cashFlow).toHaveLength(1);
    expect(store.data.cashFlow[0].name).toBe("Shop");
  });

  it("sends session token as query param when localStorage has a session token", async () => {
    globalThis.localStorage.getItem.mockReturnValue("token-123");
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ breakdown: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain("session_token=token-123");
  });

  it("exchanges a google id token for a stored owner session", async () => {
    globalThis.localStorage.getItem.mockReturnValue("");
    const fetchMock = vi.fn().mockResolvedValue(successResponse({
      session_token: "session-xyz",
      expires_at: "2026-12-31T05:00:00.000Z",
      ttl_seconds: 2592000,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const store = usePortfolioStore();
    const token = await store.exchangeSession("google-token-456");

    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain("action=exchange_session");
    expect(calledUrl).toContain("id_token=google-token-456");
    expect(token).toBe("session-xyz");
    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith("asset-session-token", "session-xyz");
    expect(store.hasSession).toBe(true);
  });

  it("shows cors error and does not fallback to mock when request is blocked", async () => {
    globalThis.localStorage.getItem.mockReturnValue("token-123");
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.source).toBe("");
    expect(store.data).toBe(null);
    expect(store.error).toContain("CORS blocked API request");
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

  it("does not retry automatically after terminal CORS error", async () => {
    globalThis.localStorage.getItem.mockReturnValue("token-123");
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const store = usePortfolioStore();
    await store.fetchPortfolio();
    await store.fetchPortfolio();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.error).toContain("CORS blocked API request");
  });


  it("reports the api auth error when no token is stored", async () => {
    globalThis.localStorage.getItem.mockReturnValue("");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(successResponse({ status: 401, error: "missing id token" })),
    );

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.source).toBe("");
    expect(store.data).toBe(null);
    expect(store.error).toContain("AUTH 401: missing id token");
  });

  it("clears the stored session when api reports it expired or invalid", async () => {
    globalThis.localStorage.getItem.mockReturnValue("token-123");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successResponse({ status: 401, error: "session expired or invalid" }));
    vi.stubGlobal("fetch", fetchMock);

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.error).toContain("AUTH 401: session expired or invalid");
    expect(store.hasSession).toBe(false);
    expect(globalThis.localStorage.removeItem).toHaveBeenCalledWith("asset-session-token");
    expect(store.source).toBe("");
  });

  it("allows retry after auth error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(successResponse({ status: 403, error: "forbidden email" }))
      .mockResolvedValueOnce(successResponse({ breakdown: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const store = usePortfolioStore();
    await store.fetchPortfolio();
    await store.fetchPortfolio();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.source).toBe("live");
    expect(store.error).toBe("");
  });

  it("falls back to mock data when api request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const store = usePortfolioStore();
    await store.fetchPortfolio();

    expect(store.loading).toBe(false);
    expect(store.source).toBe("mock");
    expect(store.error).toContain("network down");
    expect(store.error).toContain("fallback to mock");
    expect(store.rawResponse).toBeTruthy();
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
    expect(store.source).toBe("mock");
    expect(store.error).toContain("HTTP 503");
    expect(store.loading).toBe(false);
  });

  it("returns early if already loading", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Promise(() => {})); // never resolves
    vi.stubGlobal("fetch", fetchMock);

    const store = usePortfolioStore();
    const firstCall = store.fetchPortfolio();
    expect(store.loading).toBe(true);

    const secondCall = store.fetchPortfolio();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await secondCall;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles payload in data property", async () => {
    const payload = {
      data: {
        breakdown: [],
        "total-liability": [],
      }
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successResponse(payload)));
    const store = usePortfolioStore();
    await store.fetchPortfolio();
    expect(store.source).toBe("live");
  });

  it("handles errors without message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue({})); // No .message
    const store = usePortfolioStore();
    await store.fetchPortfolio();
    expect(store.error).toContain("unknown error");
  });

  it("falls back to mock if Failed to Fetch occurs without token", async () => {
    globalThis.localStorage.getItem.mockReturnValue("");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const store = usePortfolioStore();
    await store.fetchPortfolio();
    expect(store.source).toBe("mock");
  });

  it("handles missing error field in auth response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(successResponse({ status: 401 })), // no error field
    );
    const store = usePortfolioStore();
    await store.fetchPortfolio();
    expect(store.error).toContain("unauthorized");
  });

  it("handles missing localStorage or null token safely", async () => {
    // Test ?? "" when getItem returns null
    globalThis.localStorage.getItem.mockReturnValue(null);
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ breakdown: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const store = usePortfolioStore();
    await store.fetchPortfolio();
    expect(fetchMock.mock.calls[0][0]).not.toContain("id_token=");

    // Test globalThis.localStorage?. fallback (by deleting it)
    const originalLocalStorage = globalThis.localStorage;
    delete globalThis.localStorage;
    try {
      // Need to re-create store or re-trigger buildApiUrlWithToken?
      // usePortfolioStore is already defined, but getGoogleIdToken is called inside actions
      await store.fetchPortfolio();
    } finally {
      globalThis.localStorage = originalLocalStorage;
    }
  });

  it("sets source to 'mock' and populates data when fetch fails without idToken", async () => {
    globalThis.localStorage.getItem.mockReturnValue("");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("API unreachable")));
    const store = usePortfolioStore();
    await store.fetchPortfolio();
    expect(store.source).toBe("mock");
    expect(store.data).not.toBeNull();
  });

  describe("share sessions", () => {
    beforeEach(() => {
      sessionStorage.clear();
      vi.stubGlobal("location", { hash: "" });
    });

    it("fetches data with the share token from the URL hash", async () => {
      vi.stubGlobal("location", { hash: "#share=share-token-1" });
      const fetchMock = vi.fn().mockResolvedValue(
        successResponse({ breakdown: [], _share: { expires_at: "2026-12-01T22:56:56.075Z" } }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = usePortfolioStore();
      await store.fetchPortfolio();

      expect(fetchMock.mock.calls[0][0]).toContain("share_token=share-token-1");
      expect(store.shareMode).toBe(true);
      expect(store.hasSession).toBe(false);
      expect(store.shareExpiresAt).toBe("2026-12-01T22:56:56.075Z");
      expect(store.source).toBe("live");
      expect(sessionStorage.getItem("asset-share-token")).toBe("share-token-1");
    });

    it("reuses the share token stored in sessionStorage", async () => {
      sessionStorage.setItem("asset-share-token", "stored-token");
      const fetchMock = vi.fn().mockResolvedValue(successResponse({ breakdown: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const store = usePortfolioStore();
      await store.fetchPortfolio();

      expect(fetchMock.mock.calls[0][0]).toContain("share_token=stored-token");
      expect(store.shareMode).toBe(true);
      expect(store.shareExpiresAt).toBe("");
    });

    it("marks hasSession when signed in and does not enter share mode", async () => {
      globalThis.localStorage.getItem.mockReturnValue("token-123");
      vi.stubGlobal("location", { hash: "#share=ignored-token" });
      const fetchMock = vi.fn().mockResolvedValue(successResponse({ breakdown: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const store = usePortfolioStore();
      await store.fetchPortfolio();

      expect(fetchMock.mock.calls[0][0]).toContain("session_token=token-123");
      expect(fetchMock.mock.calls[0][0]).not.toContain("share_token=");
      expect(store.hasSession).toBe(true);
      expect(store.shareMode).toBe(false);
    });

    it("shows an auth error for an expired share token", async () => {
      vi.stubGlobal("location", { hash: "#share=expired-token" });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          successResponse({ status: 401, error: "share session expired or invalid" }),
        ),
      );

      const store = usePortfolioStore();
      await store.fetchPortfolio();

      expect(store.error).toBe("AUTH 401: share session expired or invalid");
      expect(store.data).toBe(null);
      expect(store.source).toBe("");
    });

    it("does not fall back to mock data in share mode", async () => {
      vi.stubGlobal("location", { hash: "#share=share-token-1" });
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

      const store = usePortfolioStore();
      await store.fetchPortfolio();

      expect(store.error).toBe("network down");
      expect(store.data).toBe(null);
      expect(store.source).toBe("");
    });

    it("issues a share session with the stored owner session", async () => {
      globalThis.localStorage.getItem.mockReturnValue("token-123");
      const fetchMock = vi.fn().mockResolvedValue(
        successResponse({
          share_token: "issued-token",
          expires_at: "2026-12-01T22:56:56.075Z",
          ttl_seconds: 2592000,
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = usePortfolioStore();
      const issued = await store.issueShare();

      expect(fetchMock.mock.calls[0][0]).toContain("action=issue_share");
      expect(fetchMock.mock.calls[0][0]).toContain("session_token=token-123");
      expect(issued).toEqual({ token: "issued-token", expiresAt: "2026-12-01T22:56:56.075Z" });
      expect(store.issuedShare).toEqual(issued);
    });

    it("issues a share session without a session token param when none is stored", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        successResponse({ share_token: "t", expires_at: "2026-12-01T00:00:00.000Z" }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = usePortfolioStore();
      await store.issueShare();

      expect(fetchMock.mock.calls[0][0]).toContain("action=issue_share");
      expect(fetchMock.mock.calls[0][0]).not.toContain("session_token=");
    });

    it("throws on auth error responses when issuing", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(successResponse({ status: 403, error: "forbidden email" })),
      );
      const store = usePortfolioStore();
      await expect(store.issueShare()).rejects.toThrow("AUTH 403: forbidden email");
    });

    it("throws a default message when the auth error has no error field", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(successResponse({ status: 401 })),
      );
      const store = usePortfolioStore();
      await expect(store.issueShare()).rejects.toThrow("AUTH 401: unauthorized");
    });

    it("throws on HTTP errors when issuing", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
      );
      const store = usePortfolioStore();
      await expect(store.issueShare()).rejects.toThrow("HTTP 500");
    });

    it("revokes the issued share session", async () => {
      const fetchMock = vi.fn().mockResolvedValue(successResponse({ revoked: true }));
      vi.stubGlobal("fetch", fetchMock);

      const store = usePortfolioStore();
      store.issuedShare = { token: "t", expiresAt: "2026-12-01T00:00:00.000Z" };
      await store.revokeShare();

      expect(fetchMock.mock.calls[0][0]).toContain("action=revoke_share");
      expect(store.issuedShare).toBe(null);
    });

    it("throws on auth error responses when revoking", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(successResponse({ status: 401, error: "missing id token" })),
      );
      const store = usePortfolioStore();
      await expect(store.revokeShare()).rejects.toThrow("AUTH 401: missing id token");
    });

    it("throws on HTTP errors when revoking", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
      );
      const store = usePortfolioStore();
      await expect(store.revokeShare()).rejects.toThrow("HTTP 500");
    });
  });

});
