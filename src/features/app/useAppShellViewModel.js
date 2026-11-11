import { computed, nextTick, onMounted, ref, watch } from "vue";
import { usePortfolioStore } from "@/stores/portfolio";
import { useUiStore } from "@/stores/ui";
import { formatShareExpiry } from "@/domain/share";

const THEME_STORAGE_KEY = "asset-theme";
const SESSION_TOKEN_STORAGE_KEY = "asset-session-token";
const LEGACY_ID_TOKEN_STORAGE_KEY = "asset-google-id-token";

/**
 * Manage app shell state for auth, theme, and privacy.
 * The idToken ref holds the 30-day owner session token exchanged at
 * sign-in (not the 1-hour Google ID token, which is never stored).
 */
export function useAppShellViewModel() {
  const theme = ref("dark");
  const idToken = ref("");
  const googleReady = ref(false);
  const googleScriptError = ref(false);
  const googleButtonRoot = ref(null);

  const portfolioStore = usePortfolioStore();
  const uiStore = useUiStore();

  const isDark = computed(() => theme.value === "dark");
  const themeLabel = computed(() => (isDark.value ? "☀️ ライト" : "🌙 ダーク"));
  const privacyLabel = computed(() => (uiStore.privacyMode ? "金額表示" : "金額モザイク"));
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const hasGoogleClientId = computed(() => Boolean(googleClientId));
  const authError = computed(() => portfolioStore.error.startsWith("AUTH "));
  const hasData = computed(() => Boolean(portfolioStore.data));
  const initialLoading = computed(() => portfolioStore.loading && !hasData.value);
  const canUseApp = computed(() => hasData.value || Boolean(idToken.value));
  const showLoginGate = computed(() => !initialLoading.value && !idToken.value && !portfolioStore.shareMode && (portfolioStore.source !== "live" || !hasData.value));
  const showShareExpired = computed(() => portfolioStore.shareMode && !initialLoading.value && !hasData.value);
  const shareExpiresLabel = computed(() => formatShareExpiry(portfolioStore.shareExpiresAt));
  const isFireEnabled = computed(() => {
    return Boolean(idToken.value) && portfolioStore.source === "live" && !portfolioStore.rawResponse?.error;
  });

  /**
   * Apply theme to document root.
   */
  const applyTheme = (nextTheme) => {
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  /**
   * Toggle between dark and light theme.
   */
  const toggleTheme = () => {
    theme.value = isDark.value ? "light" : "dark";
  };

  /**
   * Toggle privacy mode in UI store.
   */
  const togglePrivacy = () => {
    uiStore.togglePrivacy();
  };

  /**
   * Read the owner session token from local storage, dropping any
   * legacy stored Google ID token left by the old scheme.
   */
  const readSavedToken = () => {
    localStorage.removeItem(LEGACY_ID_TOKEN_STORAGE_KEY);
    idToken.value = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || "";
  };

  /**
   * Clear portfolio state before refetch.
   */
  const clearPortfolioState = () => {
    portfolioStore.data = null;
    portfolioStore.error = "";
    portfolioStore.source = "";
  };

  /**
   * Log out (revoking the owner session) and refresh data without it.
   */
  const logout = () => {
    portfolioStore.revokeSession();
    idToken.value = "";
    clearPortfolioState();
    portfolioStore.fetchPortfolio();
  };

  /**
   * Exchange the Google credential for a 30-day owner session, then
   * fetch live data with it.
   */
  const handleGoogleCredential = async (response) => {
    const credential = response?.credential;
    if (!credential) return;
    const sessionToken = await portfolioStore.exchangeSession(credential);
    if (!sessionToken) return;
    idToken.value = sessionToken;
    portfolioStore.fetchPortfolio();
  };

  /**
   * Render Google sign-in button.
   */
  const renderGoogleButton = () => {
    if (!googleReady.value || !googleButtonRoot.value) return;
    if (!googleClientId || !window.google?.accounts?.id) return;

    googleButtonRoot.value.innerHTML = "";
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(googleButtonRoot.value, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
    });
  };

  /**
   * Load Google login script once.
   */
  const loadGoogleScript = () => {
    if (window.google?.accounts?.id) {
      googleReady.value = true;
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleReady.value = true;
    };
    script.onerror = () => {
      googleScriptError.value = true;
    };
    document.head.appendChild(script);
  };

  onMounted(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      theme.value = savedTheme;
    }

    readSavedToken();
    loadGoogleScript();

    if (!portfolioStore.data && !portfolioStore.error) {
      portfolioStore.fetchPortfolio();
    }

    applyTheme(theme.value);
    document.documentElement.setAttribute("data-private", uiStore.privacyMode ? "on" : "off");
  });

  watch(theme, (nextTheme) => {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  });

  watch(
    () => portfolioStore.error,
    (newError) => {
      if (newError.startsWith("AUTH ") && idToken.value) {
        logout();
      }
    },
  );

  // Share-mode viewers see the numbers: suspend privacy masking while active.
  watch(
    () => portfolioStore.shareMode,
    (shareMode) => {
      uiStore.setPrivacySuspended(shareMode);
    },
    { immediate: true },
  );

  watch(
    () => [googleReady.value, showLoginGate.value],
    async () => {
      await nextTick();
      if (showLoginGate.value) renderGoogleButton();
    },
    { immediate: true },
  );

  return {
    portfolioStore,
    themeLabel,
    privacyLabel,
    hasGoogleClientId,
    authError,
    initialLoading,
    showLoginGate,
    showShareExpired,
    shareExpiresLabel,
    isFireEnabled,
    googleScriptError,
    googleButtonRoot,
    idToken,
    togglePrivacy,
    toggleTheme,
    logout,
  };
}
