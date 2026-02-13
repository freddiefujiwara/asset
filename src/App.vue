<script setup>
import { RouterLink, RouterView } from "vue-router";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { usePortfolioStore } from "@/stores/portfolio";

const THEME_STORAGE_KEY = "asset-theme";
const PRIVACY_STORAGE_KEY = "asset-privacy";
const ID_TOKEN_STORAGE_KEY = "asset-google-id-token";

const theme = ref("dark");
const privacyMode = ref(false);
const idToken = ref("");
const googleReady = ref(false);
const googleButtonRoot = ref(null);

const portfolioStore = usePortfolioStore();

const isDark = computed(() => theme.value === "dark");
const themeLabel = computed(() => (isDark.value ? "ライト" : "ダーク"));
const privacyLabel = computed(() => (privacyMode.value ? "金額表示" : "金額モザイク"));
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const hasGoogleClientId = computed(() => Boolean(googleClientId));
const authError = computed(() => portfolioStore.error.startsWith("AUTH "));
const hasData = computed(() => Boolean(portfolioStore.data));
const initialLoading = computed(() => portfolioStore.loading && !hasData.value);
const canUseApp = computed(() => hasData.value || Boolean(idToken.value));
const needsLogin = computed(() => !initialLoading.value && !canUseApp.value && authError.value);
const showLoginGate = computed(() => !initialLoading.value && !canUseApp.value);

const applyTheme = (nextTheme) => {
  document.documentElement.setAttribute("data-theme", nextTheme);
};

const applyPrivacy = (enabled) => {
  document.documentElement.setAttribute("data-private", enabled ? "on" : "off");
};

const toggleTheme = () => {
  theme.value = isDark.value ? "light" : "dark";
};

const togglePrivacy = () => {
  privacyMode.value = !privacyMode.value;
};

function readSavedToken() {
  idToken.value = localStorage.getItem(ID_TOKEN_STORAGE_KEY) || "";
}

function clearPortfolioState() {
  portfolioStore.data = null;
  portfolioStore.error = "";
  portfolioStore.source = "";
}

function logout() {
  localStorage.removeItem(ID_TOKEN_STORAGE_KEY);
  idToken.value = "";
  clearPortfolioState();
  portfolioStore.fetchPortfolio();
}

function handleGoogleCredential(response) {
  const credential = response?.credential;
  if (!credential) {
    return;
  }
  localStorage.setItem(ID_TOKEN_STORAGE_KEY, credential);
  idToken.value = credential;
  portfolioStore.fetchPortfolio();
}

function renderGoogleButton() {
  if (!googleReady.value || !googleButtonRoot.value) {
    return;
  }

  if (!googleClientId || !window.google?.accounts?.id) {
    return;
  }

  googleButtonRoot.value.innerHTML = "";
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleGoogleCredential,
  });
  window.google.accounts.id.renderButton(googleButtonRoot.value, {
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
  });
}

function loadGoogleScript() {
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
    renderGoogleButton();
  };
  document.head.appendChild(script);
}

onMounted(() => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    theme.value = savedTheme;
  }

  const savedPrivacy = localStorage.getItem(PRIVACY_STORAGE_KEY);
  if (savedPrivacy === "on") {
    privacyMode.value = true;
  }

  readSavedToken();
  loadGoogleScript();
  if (!portfolioStore.data && !portfolioStore.error) {
    portfolioStore.fetchPortfolio();
  }

  applyTheme(theme.value);
  applyPrivacy(privacyMode.value);
});

watch(theme, (nextTheme) => {
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
});

watch(privacyMode, (enabled) => {
  localStorage.setItem(PRIVACY_STORAGE_KEY, enabled ? "on" : "off");
  applyPrivacy(enabled);
});

watch(
  () => portfolioStore.error,
  (newError) => {
    if (newError.startsWith("AUTH ") && idToken.value) {
      logout();
    }
  },
);

watch(
  () => [googleReady.value, showLoginGate.value],
  async () => {
    await nextTick();
    if (showLoginGate.value) {
      renderGoogleButton();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1>資産可視化</h1>
      <div class="header-actions">
        <nav class="nav" aria-label="Primary">
          <RouterLink to="/balance-sheet">バランスシート</RouterLink>
          <RouterLink to="/holdings">保有資産</RouterLink>
          <RouterLink to="/family-assets">家族別</RouterLink>
          <RouterLink to="/cash-flow">キャッシュフロー</RouterLink>
        </nav>
        <div class="header-buttons">
          <button class="theme-toggle" type="button" @click="togglePrivacy">
            {{ privacyLabel }}
          </button>
          <button class="theme-toggle" type="button" @click="toggleTheme">
            {{ themeLabel }}モードへ
          </button>
          <button v-if="idToken" class="theme-toggle" type="button" @click="logout">
            ログアウト
          </button>
        </div>
      </div>
    </header>
    <main>
      <p v-if="initialLoading">読み込み中...</p>
      <section v-else-if="showLoginGate" class="table-wrap auth-gate">
        <h2 class="section-title">Googleログインが必要です</h2>
        <p class="meta">許可されたアカウントでサインインしてください。</p>
        <p v-if="authError" class="error">
          認証エラーが発生しました。別アカウントで再ログインしてください。({{ portfolioStore.error }})
        </p>
        <div ref="googleButtonRoot" class="google-login-button"></div>
        <p v-if="!hasGoogleClientId" class="error">
          VITE_GOOGLE_CLIENT_ID が未設定です。
        </p>
      </section>
      <RouterView v-else />
    </main>
  </div>
</template>
