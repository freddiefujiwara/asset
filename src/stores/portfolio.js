import { defineStore } from "pinia";
import { normalizePortfolio } from "@/domain/normalize";
import { parseShareToken } from "@/domain/share";
import sampleApi from "@/mocks/sampleApi.json";

const API_URL =
  import.meta.env.VITE_GAS_ENDPOINT ??
  "https://script.google.com/macros/s/AKfycbxjQAp6rtSCUTz4T5J96_-zCs9Vrae-7uhZXY7ZIukOZP5fs_HIf44aOAfcN3XfPkis/exec";
const SESSION_TOKEN_STORAGE_KEY = "asset-session-token";
const LEGACY_ID_TOKEN_STORAGE_KEY = "asset-google-id-token";
const SHARE_TOKEN_STORAGE_KEY = "asset-share-token";

// Sign-in uses a 30-day owner session issued by the API in exchange for
// the (1-hour) Google ID token; the raw ID token is never stored.
function getSessionToken() {
  return globalThis.localStorage?.getItem(SESSION_TOKEN_STORAGE_KEY) ?? "";
}

function setSessionToken(token) {
  if (token) {
    globalThis.localStorage?.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  } else {
    globalThis.localStorage?.removeItem(SESSION_TOKEN_STORAGE_KEY);
  }
}

function clearLegacyIdToken() {
  globalThis.localStorage?.removeItem(LEGACY_ID_TOKEN_STORAGE_KEY);
}

function getShareToken() {
  const fromHash = parseShareToken(globalThis.location?.hash ?? "");
  if (fromHash) {
    globalThis.sessionStorage?.setItem(SHARE_TOKEN_STORAGE_KEY, fromHash);
    return fromHash;
  }
  return globalThis.sessionStorage?.getItem(SHARE_TOKEN_STORAGE_KEY) ?? "";
}

function buildApiUrlWithSession(sessionToken) {
  if (!sessionToken) {
    return API_URL;
  }

  const url = new URL(API_URL);
  url.searchParams.set("session_token", sessionToken);
  return url.toString();
}

function buildApiUrlWithShare(shareToken) {
  const url = new URL(API_URL);
  url.searchParams.set("share_token", shareToken);
  return url.toString();
}

function buildActionUrl(action, { idToken = "", sessionToken = "" } = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  if (idToken) {
    url.searchParams.set("id_token", idToken);
  }
  if (sessionToken) {
    url.searchParams.set("session_token", sessionToken);
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
    hasSession: false,
    issuedShare: null,
  }),
  actions: {
    async fetchPortfolio() {
      if (this.loading) {
        return;
      }
      if (this.error.startsWith("CORS blocked")) {
        return;
      }

      this.loading = true;
      this.error = "";
      clearLegacyIdToken();
      const sessionToken = getSessionToken();
      const shareToken = sessionToken ? "" : getShareToken();
      this.shareMode = Boolean(shareToken);
      this.hasSession = Boolean(sessionToken);
      const apiUrl = sessionToken
        ? buildApiUrlWithSession(sessionToken)
        : shareToken
          ? buildApiUrlWithShare(shareToken)
          : API_URL;
      try {
        while (true) {
          const response = await fetch(apiUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const json = await response.json();
          if (json?.status === 401 || json?.status === 403) {
            const authMessage = json.error ?? "unauthorized";
            if (sessionToken && authMessage === "session expired or invalid") {
              // The stored owner session is gone or expired; drop it so
              // the shell returns to the Google sign-in gate.
              setSessionToken("");
              this.hasSession = false;
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
        if (sessionToken && isCorsError) {
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

    // Exchange a fresh Google ID token for a 30-day owner session and
    // store it. Returns the session token, or "" when the exchange was
    // rejected (the error is surfaced via this.error like other AUTH
    // failures).
    async exchangeSession(idToken) {
      const response = await fetch(buildActionUrl("exchange_session", { idToken }));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (json && (json.status === 401 || json.status === 403)) {
        this.error = `AUTH ${json.status}: ${json.error ?? "unauthorized"}`;
        return "";
      }
      if (!json?.session_token) {
        return "";
      }
      setSessionToken(json.session_token);
      this.hasSession = true;
      return json.session_token;
    },

    // Revoke the stored owner session (logout). Best effort: the local
    // copy is dropped even when the API call fails.
    async revokeSession() {
      const sessionToken = getSessionToken();
      setSessionToken("");
      this.hasSession = false;
      if (!sessionToken) {
        return;
      }
      try {
        await fetch(buildActionUrl("revoke_session", { sessionToken }));
      } catch {
        // Logout must not fail on a network error.
      }
    },

    async issueShare() {
      const response = await fetch(
        buildActionUrl("issue_share", { sessionToken: getSessionToken() }),
      );
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
      const response = await fetch(
        buildActionUrl("revoke_share", { sessionToken: getSessionToken() }),
      );
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
