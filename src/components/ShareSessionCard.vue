<script setup>
import { computed, ref } from "vue";
import { usePortfolioStore } from "@/stores/portfolio";
import {
  buildShareUrl,
  formatShareExpiry,
  formatShareRemaining,
  shareSecondsLeft,
} from "@/domain/share";

const portfolioStore = usePortfolioStore();

const busy = ref(false);
const errorMessage = ref("");
const copied = ref(false);

const shareUrl = computed(() => {
  if (!portfolioStore.issuedShare) {
    return "";
  }
  const base = `${window.location.origin}${import.meta.env.BASE_URL}balance-sheet`;
  return buildShareUrl(base, portfolioStore.issuedShare.token);
});

const remainingLabel = computed(() => {
  if (!portfolioStore.issuedShare) {
    return "";
  }
  return formatShareRemaining(
    shareSecondsLeft(portfolioStore.issuedShare.expiresAt, Date.now()),
  );
});

const expiryLabel = computed(() => {
  if (!portfolioStore.issuedShare) {
    return "";
  }
  return formatShareExpiry(portfolioStore.issuedShare.expiresAt);
});

const issue = async () => {
  busy.value = true;
  errorMessage.value = "";
  copied.value = false;
  try {
    await portfolioStore.issueShare();
  } catch (error) {
    errorMessage.value = error?.message ?? "発行に失敗しました";
  } finally {
    busy.value = false;
  }
};

const revoke = async () => {
  busy.value = true;
  errorMessage.value = "";
  try {
    await portfolioStore.revokeShare();
    copied.value = false;
  } catch (error) {
    errorMessage.value = error?.message ?? "無効化に失敗しました";
  } finally {
    busy.value = false;
  }
};

const copyUrl = async () => {
  const text = shareUrl.value;
  if (!text) {
    return;
  }
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "absolute";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
  copied.value = true;
};
</script>

<template>
  <section class="chart-card share-card">
    <h3 class="section-title">一時アクセスリンク</h3>
    <p class="meta">
      ログイン不要で1か月間データを閲覧できるURLを発行します。新しいURLを発行すると、前のURLは無効になります。この画面を閉じると発行したURLは再表示できません。
    </p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <template v-if="portfolioStore.issuedShare">
      <p class="meta">
        {{ remainingLabel }}<span v-if="expiryLabel">（{{ expiryLabel }} まで有効）</span>
      </p>
      <p class="share-url">{{ shareUrl }}</p>
      <div class="share-actions">
        <button class="theme-toggle" type="button" :disabled="busy" @click="copyUrl">
          {{ copied ? "コピーしました" : "URLをコピー" }}
        </button>
        <button class="theme-toggle" type="button" :disabled="busy" @click="issue">
          新しいURLを発行
        </button>
        <button class="theme-toggle" type="button" :disabled="busy" @click="revoke">
          このURLを無効化
        </button>
      </div>
    </template>
    <div v-else class="share-actions">
      <button class="theme-toggle" type="button" :disabled="busy" @click="issue">
        {{ busy ? "発行中..." : "1か月間有効な閲覧用URLを発行" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.share-card {
  margin-top: 16px;
}

.share-url {
  word-break: break-all;
  font-size: 0.85rem;
}

.share-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
</style>
