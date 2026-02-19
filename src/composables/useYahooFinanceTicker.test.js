import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useYahooFinanceTicker, _resetInternalState } from "./useYahooFinanceTicker";

describe("useYahooFinanceTicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
    _resetInternalState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should fetch and cache a ticker successfully", async () => {
    const { tickerMap, requestTicker } = useYahooFinanceTicker();
    const name = "SuccessStock_" + Math.random();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: "9984.T" }),
    });

    requestTicker(name);

    // Initial call
    await vi.runAllTimersAsync();

    expect(tickerMap[name]).toBe("9984.T");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should handle sequential processing of multiple requests", async () => {
    const { tickerMap, requestTicker } = useYahooFinanceTicker();
    const name1 = "Seq1_" + Math.random();
    const name2 = "Seq2_" + Math.random();

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "ANS1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "ANS2" }),
      });

    requestTicker(name1);
    requestTicker(name2);

    // Process first
    await vi.advanceTimersByTimeAsync(0);
    expect(tickerMap[name1]).toBe("ANS1");

    // Wait for delay
    await vi.advanceTimersByTimeAsync(200);
    // Process second
    await vi.advanceTimersByTimeAsync(0);

    expect(tickerMap[name2]).toBe("ANS2");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("should avoid duplicate requests (cache, fetching, queue)", async () => {
    const { requestTicker } = useYahooFinanceTicker();
    const name = "DupStock_" + Math.random();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ answer: "DUP" }),
    });

    // 1. First request
    requestTicker(name);
    // 2. Immediate second request (should be in fetchingSet or queue)
    requestTicker(name);

    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);

    // 3. Request after cached
    requestTicker(name);
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should handle fetch error", async () => {
    const { tickerMap, requestTicker } = useYahooFinanceTicker();
    const name = "ErrStock_" + Math.random();
    fetch.mockRejectedValueOnce(new Error("Network Fail"));

    requestTicker(name);
    await vi.runAllTimersAsync();

    expect(tickerMap[name]).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("should handle non-ok response", async () => {
    const { tickerMap, requestTicker } = useYahooFinanceTicker();
    const name = "HttpErrStock_" + Math.random();
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    requestTicker(name);
    await vi.runAllTimersAsync();

    expect(tickerMap[name]).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("should handle empty answer", async () => {
    const { tickerMap, requestTicker } = useYahooFinanceTicker();
    const name = "EmptyStock_" + Math.random();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: "  " }),
    });

    requestTicker(name);
    await vi.runAllTimersAsync();

    expect(tickerMap[name]).toBeUndefined();
  });

  it("should ignore invalid names", () => {
    const { requestTicker } = useYahooFinanceTicker();
    requestTicker("");
    requestTicker(null);
    requestTicker(undefined);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("should reach empty queue branch", async () => {
    const { requestTicker } = useYahooFinanceTicker();
    const name = "LastStock_" + Math.random();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: "LAST" }),
    });

    requestTicker(name);
    await vi.advanceTimersByTimeAsync(0);
    // After processing name, it sets timeout for next processQueue
    // At that time queue will be empty.
    await vi.advanceTimersByTimeAsync(200);
    // Now processQueue should have returned early because queue.length === 0
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
