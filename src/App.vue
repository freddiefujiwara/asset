<script setup>
import { RouterLink, RouterView } from "vue-router";
import { useAppShellViewModel } from "@/features/app/useAppShellViewModel";
import ExternalLinkIcon from "@/components/ExternalLinkIcon.vue";

const {
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
} = useAppShellViewModel();
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1>資産可視化</h1>
      <div class="header-actions">
        <nav class="nav" aria-label="Primary">
          <RouterLink to="/">ホーム</RouterLink>
          <RouterLink to="/balance-sheet">バランスシート</RouterLink>
          <RouterLink to="/cash-flow">キャッシュフロー</RouterLink>
          <RouterLink v-if="!portfolioStore.shareMode" to="/progress">FIRE進捗</RouterLink>
          <RouterLink v-if="isFireEnabled" to="/fire">FIRE</RouterLink>
          <span v-else class="is-disabled" title="APIから正常にデータを取得した後に利用可能です">
            FIRE
            <ExternalLinkIcon />
          </span>
        </nav>
        <div class="header-buttons">
          <button v-if="!portfolioStore.shareMode" class="theme-toggle" type="button" @click="togglePrivacy">
            {{ privacyLabel }}
          </button>
          <button class="theme-toggle" type="button" @click="toggleTheme">
            {{ themeLabel }}
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
      <section v-else-if="showShareExpired" class="table-wrap auth-gate">
        <h2 class="section-title">閲覧用リンクの有効期限が切れています</h2>
        <p class="meta">このリンクは発行から1か月間だけ有効です。発行者に再発行を依頼してください。</p>
      </section>
      <template v-else>
        <p v-if="portfolioStore.shareMode" class="meta">
          一時リンクで表示中です<template v-if="shareExpiresLabel">（{{ shareExpiresLabel }} まで有効）</template>
        </p>
        <RouterView />
      </template>
    </main>
  </div>
</template>
