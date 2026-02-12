<script setup>
import { RouterLink, RouterView } from "vue-router";
import { computed, onMounted, ref, watch } from "vue";

const THEME_STORAGE_KEY = "asset-theme";
const PRIVACY_STORAGE_KEY = "asset-privacy";

const theme = ref("dark");
const privacyMode = ref(false);

const isDark = computed(() => theme.value === "dark");
const themeLabel = computed(() => (isDark.value ? "ライト" : "ダーク"));
const privacyLabel = computed(() => (privacyMode.value ? "金額表示" : "金額モザイク"));

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

onMounted(() => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    theme.value = savedTheme;
  }

  const savedPrivacy = localStorage.getItem(PRIVACY_STORAGE_KEY);
  if (savedPrivacy === "on") {
    privacyMode.value = true;
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
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1>資産可視化ダッシュボード</h1>
      <div class="header-actions">
        <nav class="nav" aria-label="Primary">
          <RouterLink to="/dashboard">ダッシュボード</RouterLink>
          <RouterLink to="/holdings">保有資産</RouterLink>
          <RouterLink to="/family-assets">家族別</RouterLink>
        </nav>
        <div class="header-buttons">
          <button class="theme-toggle" type="button" @click="togglePrivacy">
            {{ privacyLabel }}
          </button>
          <button class="theme-toggle" type="button" @click="toggleTheme">
            {{ themeLabel }}モードへ
          </button>
        </div>
      </div>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
