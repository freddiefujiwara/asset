import { defineStore } from "pinia";
import { normalizePortfolio } from "@/domain/normalize";
import { parseShareToken } from "@/domain/share";
import sampleApi from "@/mocks/sampleApi.json";

const API_URL =
  import.meta.env.VITE_GAS_ENDPOINT ??
  "https://script.google.com/macros/s/AKfycbxjQAp6rtSCUTz4T5J96_-zCs9Vrae-7uhZXY7ZIukOZP5fs_HIf44aOAfcN3XfPkis/exec";
const ID_TOKEN_STORAGE_KEY = "asset-google-id-token";
const SHARE_TOKEN_STORAGE_KEY = "asset-share-token";

function getGoogleIdToken() {
  return globalThis.localStorage?.getItem(ID_TOKEN_STORAGE_KEY) ?? "";
}

function getShareToken() {
  const fromHash = parseShareToken(globalThis.location?.hash ?? "");
  if (fromHash) {
    globalThis.sessionStorage?.setItem(SHARE_TOKEN_STORAGE_KEY, fromHash);
    return fromHash;
  }
  return globalThis.sessionStorage?.getItem(SHARE_TOKEN_STORAGE_KEY) ?? "";
}

function buildApiUrlWithToken(idToken) {
  if (!idToken) {
    return API_URL;
  }

  const url = new URL(API_URL);
  url.searchParams.set("id_token", idToken);
  return url.toString();
}

function buildApiUrlWithShare(shareToken) {
  const url = new URL(API_URL);
  url.searchParams.set("share_token", shareToken);
  return url.toString();
}

function buildActionUrl(action, idToken) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  if (idToken) {
    url.searchParams.set("id_token", idToken);
  }
  return url.toString();
}

export const usePortfolioStore = defineStore("portfolio", {
  state: () => ({
    data: null,
    loading: false,
    error: "",
    source: "",
    rawResponse: null,
    shareMode: false,
    shareExpiresAt: "",
    hasIdToken: false,
    issuedShare: null,
  }),
  actions: {
    async fetchPortfolio(directToken = null) {
      if (this.loading) {
        return;
      }
      if (this.error.startsWith("CORS blocked")) {
        return;
      }

      this.loading = true;
      this.error = "";
      const idToken = directToken || getGoogleIdToken();
      const shareToken = idToken ? "" : getShareToken();
      this.shareMode = Boolean(shareToken);
      this.hasIdToken = Boolean(idToken);
      const apiUrl = idToken
        ? buildApiUrlWithToken(idToken)
        : shareToken
          ? buildApiUrlWithShare(shareToken)
          : API_URL;
      try {
        let didRetryMissingIdToken = false;
        while (true) {
          const response = await fetch(apiUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const json = await response.json();
          if (json?.status === 401 || json?.status === 403) {
            const authMessage = json.error ?? "unauthorized";
            if (
              authMessage === "missing id token"
              && idToken
              && !didRetryMissingIdToken
            ) {
              didRetryMissingIdToken = true;
              continue;
            }

            if (authMessage === "missing id token") {
              throw new Error("AUTH 401: missing id token (GAS must read e.parameter.id_token)");
            }

            throw new Error(`AUTH ${json.status}: ${authMessage}`);
          }

          this.rawResponse = json;
          this.shareExpiresAt = json?._share?.expires_at ?? "";
          const payload = json?.data ?? json;
          this.data = normalizePortfolio(payload);
          this.source = "live";
          break;
        }
      } catch (error) {
        const message = error?.message ?? "unknown error";
        if (message.startsWith("AUTH ")) {
          this.error = message;
          this.data = null;
          this.source = "";
          this.rawResponse = null;
          return;
        }

        if (shareToken) {
          // Never show sample data to a share-link viewer.
          this.error = message;
          this.data = null;
          this.source = "";
          this.rawResponse = null;
          return;
        }

        const isCorsError = message.toLowerCase().includes("failed to fetch");
        if (idToken && isCorsError) {
          this.error = "CORS blocked API request. Ensure GAS doGet returns Access-Control-Allow-Origin.";
          this.data = null;
          this.source = "";
          this.rawResponse = null;
          return;
        }

        this.error = `${message} (fallback to mock)`;
        this.rawResponse = sampleApi;
        this.data = normalizePortfolio(sampleApi);
        this.source = "mock";
      } finally {
        this.loading = false;
      }
    },

    async issueShare() {
      const idToken = getGoogleIdToken();
      const response = await fetch(buildActionUrl("issue_share", idToken));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (json && (json.status === 401 || json.status === 403)) {
        throw new Error(`AUTH ${json.status}: ${json.error ?? "unauthorized"}`);
      }
      this.issuedShare = { token: json.share_token, expiresAt: json.expires_at };
      return this.issuedShare;
    },

    async revokeShare() {
      const idToken = getGoogleIdToken();
      const response = await fetch(buildActionUrl("revoke_share", idToken));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (json && (json.status === 401 || json.status === 403)) {
        throw new Error(`AUTH ${json.status}: ${json.error ?? "unauthorized"}`);
      }
      this.issuedShare = null;
    },
  },
});
