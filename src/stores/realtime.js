import { defineStore } from "pinia";
import YahooFinance from "yahoo-finance2";

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const useRealtimeStore = defineStore("realtime", {
  state: () => ({
    quotes: {}, // symbol -> { quote, timestamp }
    loading: false,
    error: null,
  }),
  actions: {
    async fetchQuotes(symbols) {
      if (!symbols || symbols.length === 0) return;

      const now = Date.now();
      const symbolsToFetch = symbols.filter(symbol => {
        const cached = this.quotes[symbol];
        return !cached || (now - cached.timestamp > CACHE_DURATION);
      });

      if (symbolsToFetch.length === 0) return;

      this.loading = true;
      this.error = null;

      try {
        const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
        // yahoo-finance2 supports array of symbols
        const results = await yahooFinance.quote(symbolsToFetch);

        // results is an array of quotes
        if (Array.isArray(results)) {
          results.forEach(quote => {
            if (quote && quote.symbol) {
              this.quotes[quote.symbol] = {
                quote,
                timestamp: now,
              };
            }
          });
        } else if (results && results.symbol) {
          // Single result case (though we usually pass array)
          this.quotes[results.symbol] = {
            quote: results,
            timestamp: now,
          };
        }
      } catch (err) {
        console.error("Failed to fetch real-time quotes:", err);
        this.error = err.message || "Failed to fetch real-time quotes";
      } finally {
        this.loading = false;
      }
    },
  },
});
