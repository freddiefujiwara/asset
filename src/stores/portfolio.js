import { defineStore } from "pinia";
import { normalizePortfolio } from "@/domain/normalize";
import sampleApi from "@/mocks/sampleApi.json";

const API_URL =
  "https://script.google.com/macros/s/AKfycbxjQAp6rtSCUTz4T5J96_-zCs9Vrae-7uhZXY7ZIukOZP5fs_HIf44aOAfcN3XfPkis/exec";
const ID_TOKEN_STORAGE_KEY = "asset-google-id-token";

function getGoogleIdToken() {
  return globalThis.localStorage?.getItem(ID_TOKEN_STORAGE_KEY) ?? "";
}

// GAS endpoint accepts id_token as query parameter; append only when available.
function buildApiUrlWithToken() {
  const idToken = getGoogleIdToken();
  if (!idToken) {
    return API_URL;
  }

  const url = new URL(API_URL);
  url.searchParams.set("id_token", idToken);
  return url.toString();
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
      if (this.loading) {
        return;
      }
      if (this.error.startsWith("AUTH ") || this.error.startsWith("CORS blocked")) {
        return;
      }

      this.loading = true;
      this.error = "";
      try {
        const response = await fetch(buildApiUrlWithToken());
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        if (json?.status === 401 || json?.status === 403) {
          const authMessage = json.error ?? "unauthorized";
          if (authMessage === "missing id token") {
            throw new Error("AUTH 401: missing id token (GAS must read e.parameter.id_token)");
          }
          throw new Error(`AUTH ${json.status}: ${authMessage}`);
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

        if (getGoogleIdToken() && message.toLowerCase().includes("failed to fetch")) {
          this.error = "CORS blocked API request. Ensure GAS doGet returns Access-Control-Allow-Origin.";
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
