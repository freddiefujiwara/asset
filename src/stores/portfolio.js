import { defineStore } from "pinia";
import { normalizePortfolio } from "@/domain/normalize";
import sampleApi from "@/mocks/sampleApi.json";

const API_URL =
  "https://script.google.com/macros/s/AKfycbxjQAp6rtSCUTz4T5J96_-zCs9Vrae-7uhZXY7ZIukOZP5fs_HIf44aOAfcN3XfPkis/exec";

export const usePortfolioStore = defineStore("portfolio", {
  state: () => ({
    data: null,
    loading: false,
    error: "",
    source: "",
  }),
  actions: {
    async fetchPortfolio() {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        this.data = normalizePortfolio(json);
        this.source = "live";
      } catch (error) {
        this.error = `${error?.message ?? "unknown error"} (fallback to mock)`;
        this.data = normalizePortfolio(sampleApi);
        this.source = "mock";
      } finally {
        this.loading = false;
      }
    },
  },
});
