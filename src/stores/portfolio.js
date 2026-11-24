import { defineStore } from "pinia";
import { normalizePortfolio } from "@/domain/normalize";
import { parseShareToken } from "@/domain/share";
import { setFamilyConfig } from "@/domain/familyConfig";
import { isStagingBuild } from "@/staging-banner.js";
import sampleApi from "@/mocks/sampleApi.json";
import sampleFamilyConfig from "@/mocks/sampleFamilyConfig.json";

const API_URL =
  import.meta.env.VITE_GAS_ENDPOINT ??
  "https://script.google.com/macros/s/AKfycbxjQAp6rtSCUTz4T5J96_-zCs9Vrae-7uhZXY7ZIukOZP5fs_HIf44aOAfcN3XfPkis/exec";
// Storage keys are environment-scoped: localStorage is shared across
// the whole origin, so staging builds must never read or overwrite the
// production tokens (same pattern as tweet/alarm).
const storageKey = (base) => (isStagingBuild() ? `${base}:staging` : base);
export const SESSION_TOKEN_STORAGE_KEY = storageKey("asset-session-token");
const LEGACY_ID_TOKEN_STORAGE_KEY = "asset-google-id-token";
export const SHARE_TOKEN_STORAGE_KEY = storageKey("asset-share-token");

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

function buildApiUrlWithSession(sessionToken, scope) {
  /* v8 ignore start -- defensive: the only caller passes a non-empty token */
  if (!sessionToken) {
    return API_URL;
  }
  /* v8 ignore stop */

  const url = new URL(API_URL);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("scope", scope);
  return url.toString();
}

function buildApiUrlWithShare(shareToken, scope) {
  const url = new URL(API_URL);
  url.searchParams.set("share_token", shareToken);
  url.searchParams.set("scope", scope);
  return url.toString();
}

function buildApiUrl(scope) {
  const url = new URL(API_URL);
  url.searchParams.set("scope", scope);
  return url.toString();
}

function buildActionUrl(action, { idToken = "", sessionToken = "", shareToken = "" } = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  if (idToken) {
    url.searchParams.set("id_token", idToken);
  }
  if (sessionToken) {
    url.searchParams.set("session_token", sessionToken);
  }
  if (shareToken) {
    url.searchParams.set("share_token", shareToken);
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
    familyConfig: null,
    dataScope: "",
  }),
  actions: {
    // The first load uses the recent scope (mfcf rows for the
    // latest two months plus the monthly living-cost aggregates),
    // which is all the home screen needs. Screens that need every
    // mfcf row (cash flow, FIRE simulator) call ensureFullData()
    // to upgrade. Once full data is held, later fetches keep the
    // full scope instead of silently downgrading.
    async fetchPortfolio(scope = this.dataScope === "full" ? "full" : "recent") {
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
        ? buildApiUrlWithSession(sessionToken, scope)
        : shareToken
          ? buildApiUrlWithShare(shareToken, scope)
          : buildApiUrl(scope);
      try {
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

        // The family config (owner suffixes, birth dates, FIRE
        // assumptions) is served by the API only to authenticated
        // callers and is required before any view may compute with
        // it. It must be loaded BEFORE this.data is assigned: views
        // react to the data assignment immediately and their
        // computations read the config synchronously, so publishing
        // the data first lets a view render while the config is
        // still in flight and throw. If the config cannot be
        // loaded, fall back to the error state rather than
        // rendering numbers from wrong assumptions.
        // On a scope upgrade the config is already loaded; the
        // load-before-data invariant only binds the first load.
        if (!this.familyConfig) {
          try {
            await this.fetchFamilyConfig({ sessionToken, shareToken });
          } catch (configError) {
            this.error = configError?.message ?? "family config load failed";
            this.data = null;
            this.source = "";
            this.rawResponse = null;
            return;
          }
        }

        this.rawResponse = json;
        this.shareExpiresAt = json?._share?.expires_at ?? "";
        const payload = json?.data ?? json;
        this.dataScope = payload?.mfcfScope ?? scope;
        this.data = normalizePortfolio(payload);
        this.source = "live";
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
        this.dataScope = "full";
        this.source = "mock";
        setFamilyConfig(sampleFamilyConfig);
        this.familyConfig = sampleFamilyConfig;
      } finally {
        this.loading = false;
      }
    },

    // Upgrade a recent-scope dataset to the full mfcf history.
    // Called by the screens that need every row (cash flow, FIRE
    // simulator) when they are shown.
    async ensureFullData() {
      if (this.dataScope === "recent" && this.source === "live" && !this.loading) {
        await this.fetchPortfolio("full");
      }
    },

    // Fetch the family config with the same credentials that just
    // authenticated the portfolio data (owner session or share
    // token). Throws on any failure; the caller decides the state.
    async fetchFamilyConfig({ sessionToken = "", shareToken = "" } = {}) {
      const response = await fetch(
        buildActionUrl("family_config", { sessionToken, shareToken }),
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (json?.status === 401 || json?.status === 403) {
        throw new Error(`AUTH ${json.status}: ${json.error ?? "unauthorized"}`);
      }
      if (!json || !Array.isArray(json.ownerRules) || !json.birthDates) {
        throw new Error("family config response is invalid");
      }
      setFamilyConfig(json);
      this.familyConfig = json;
      return json;
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
