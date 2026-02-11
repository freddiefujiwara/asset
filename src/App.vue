<script setup>
import { RouterLink, RouterView } from "vue-router";
import { computed, onMounted, ref, watch } from "vue";

const STORAGE_KEY = "asset-theme";
const theme = ref("dark");

const isDark = computed(() => theme.value === "dark");
const themeLabel = computed(() => (isDark.value ? "ライト" : "ダーク"));

const applyTheme = (nextTheme) => {
  document.documentElement.setAttribute("data-theme", nextTheme);
};

const toggleTheme = () => {
  theme.value = isDark.value ? "light" : "dark";
};

onMounted(() => {
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    theme.value = savedTheme;
  }
  applyTheme(theme.value);
});

watch(theme, (nextTheme) => {
  localStorage.setItem(STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
});
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1>資産可視化ダッシュボード</h1>
      <div class="header-actions">
        <nav class="nav" aria-label="Primary">
          <RouterLink to="/dashboard">Dashboard</RouterLink>
          <RouterLink to="/holdings">Holdings</RouterLink>
        </nav>
        <button class="theme-toggle" type="button" @click="toggleTheme">
          {{ themeLabel }}モードへ
        </button>
      </div>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
