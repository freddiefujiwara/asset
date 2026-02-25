<script setup>
import { RouterLink, RouterView } from "vue-router";
import { storeToRefs } from "pinia";
import { useAppShellViewModel } from "@/features/app/useAppShellViewModel";
import { useFireSimulatorStore } from "@/stores/fireSimulator";

const {
  portfolioStore,
  themeLabel,
  privacyLabel,
  hasGoogleClientId,
  authError,
  initialLoading,
  showLoginGate,
  googleScriptError,
  googleButtonRoot,
  idToken,
  togglePrivacy,
  toggleTheme,
  logout,
} = useAppShellViewModel();

const fireSimulatorStore = useFireSimulatorStore();
const { externalSimulatorUrl } = storeToRefs(fireSimulatorStore);
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1>資産可視化</h1>
      <div class="header-actions">
        <nav class="nav" aria-label="Primary">
          <RouterLink to="/balance-sheet">バランスシート</RouterLink>
          <RouterLink to="/cash-flow">キャッシュフロー</RouterLink>
          <a :href="externalSimulatorUrl" target="_blank" rel="noopener noreferrer">
            FIRE
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="margin-left: 2px; vertical-align: middle; opacity: 0.8;"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
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
        <p v-if="googleScriptError" class="error">
          Googleログインスクリプトの読み込みに失敗しました。広告ブロック等を解除して再読み込みしてください。
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
