import { describe, expect, it } from "vitest";
import { getYahooSymbol, stockPriceUrl, realtimeStockTiles } from "./holdings";

describe("realtime domain logic", () => {
  describe("getYahooSymbol", () => {
    it("converts 4-digit codes to .T", () => {
      expect(getYahooSymbol("7203")).toBe("7203.T");
    });

    it("converts 5-digit codes to first 4 digits + .T", () => {
      expect(getYahooSymbol("47550")).toBe("4755.T");
    });

    it("keeps alphabetic symbols as is", () => {
      expect(getYahooSymbol("VYM")).toBe("VYM");
      expect(getYahooSymbol("AAPL")).toBe("AAPL");
    });

    it("returns null for unrecognized formats", () => {
      expect(getYahooSymbol("123")).toBe(null);
      expect(getYahooSymbol("123456")).toBe(null);
      expect(getYahooSymbol("")).toBe(null);
      expect(getYahooSymbol(null)).toBe(null);
    });
  });

  describe("stockPriceUrl", () => {
    it("returns Yahoo Finance JP URL for Japanese stocks", () => {
      expect(stockPriceUrl("トヨタ", "7203")).toBe("https://finance.yahoo.co.jp/quote/7203.T?term=1d");
      expect(stockPriceUrl("楽天", "47550")).toBe("https://finance.yahoo.co.jp/quote/4755.T?term=1d");
    });

    it("returns Yahoo Finance US URL for US stocks", () => {
      expect(stockPriceUrl("VYM", "VYM")).toBe("https://finance.yahoo.com/quote/VYM/");
    });

    it("returns Google search URL as fallback", () => {
      expect(stockPriceUrl("Unknown", "123")).toContain("google.com/search");
      expect(stockPriceUrl("My Asset", null)).toContain("google.com/search");
    });
  });

  describe("realtimeStockTiles", () => {
    it("overrides dailyChange and isNegative using quote data", () => {
      const stocks = [
        { 銘柄コード: "7203", 銘柄名: "Toyota", 評価額: "1000", 前日比: "10" },
        { 銘柄コード: "AAPL", 銘柄名: "Apple", 評価額: "2000", 前日比: "-5" },
      ];
      const quoteMap = {
        "7203.T": {
          quote: { regularMarketChange: -50, regularMarketChangePercent: -0.05 },
          timestamp: Date.now(),
        },
        "AAPL": {
          quote: { regularMarketChange: 100, regularMarketChangePercent: 0.02 },
          timestamp: Date.now(),
        },
      };

      const tiles = realtimeStockTiles(stocks, quoteMap);

      expect(tiles).toHaveLength(2);

      const toyota = tiles.find(t => t.name === "Toyota");
      expect(toyota.dailyChange).toBe(-50);
      expect(toyota.isNegative).toBe(true);

      const apple = tiles.find(t => t.name === "Apple");
      expect(apple.dailyChange).toBe(100);
      expect(apple.isNegative).toBe(false);
    });

    it("falls back to static data if quote is missing", () => {
      const stocks = [
        { 銘柄コード: "7203", 銘柄名: "Toyota", 評価額: "1000", 前日比: "10" },
      ];
      const quoteMap = {};

      const tiles = realtimeStockTiles(stocks, quoteMap);
      expect(tiles[0].dailyChange).toBe(10);
      expect(tiles[0].isNegative).toBe(false);
    });
  });
});
