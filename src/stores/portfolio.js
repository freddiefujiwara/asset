import { defineStore } from "pinia";
import { normalizePortfolio } from "@/domain/normalize";
import sampleApi from "@/mocks/sampleApi.json";

const API_URL =
  "https://script.google.com/macros/s/AKfycbxjQAp6rtSCUTz4T5J96_-zCs9Vrae-7uhZXY7ZIukOZP5fs_HIf44aOAfcN3XfPkis/exec";
const ID_TOKEN_STORAGE_KEY = "asset-google-id-token";

function getGoogleIdToken() {
  return globalThis.localStorage?.getItem(ID_TOKEN_STORAGE_KEY) ?? "";
}

function isCorsLikeNetworkError(error) {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes("failed to fetch") || message.includes("networkerror");
}

async function fetchPortfolioResponse() {
  const idToken = getGoogleIdToken();
  const headers = idToken ? { Authorization: `Bearer ${idToken}` } : undefined;

  try {
    return await fetch(API_URL, { headers });
  } catch (error) {
    if (!idToken || !isCorsLikeNetworkError(error)) {
      throw error;
    }

    return await fetch(API_URL);
  }
}

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
        const response = await fetchPortfolioResponse();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        if (json?.status === 401 || json?.status === 403) {
          throw new Error(`AUTH ${json.status}: ${json.error ?? "unauthorized"}`);
        }

        const payload = json?.data ?? json;
        this.data = normalizePortfolio(payload);
        this.source = "live";
      } catch (error) {
        const message = error?.message ?? "unknown error";
        if (message.startsWith("AUTH ")) {
          this.error = message;
          this.data = null;
          this.source = "";
          return;
        }

        this.error = `${message} (fallback to mock)`;
        this.data = normalizePortfolio(sampleApi);
        this.source = "mock";
      } finally {
        this.loading = false;
      }
    },
  },
});
