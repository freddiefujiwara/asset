import { nextTick, onMounted, watch } from "vue";

export function useInitialHashRestore({ route, router, loading, isReady }) {
  let pendingInitialHash = "";
  let restoredInitialHash = false;

  function scrollToPendingHash() {
    if (!pendingInitialHash) {
      return;
    }

    const target = document.querySelector(pendingInitialHash);
    if (target) {
      target.scrollIntoView({ block: "start" });
    }
  }

  async function restoreInitialHashIfReady() {
    if (restoredInitialHash || !pendingInitialHash || loading.value || !isReady.value) {
      return;
    }

    restoredInitialHash = true;
    await nextTick();
    await router.replace({ path: route.path, hash: pendingInitialHash });
    await nextTick();
    scrollToPendingHash();
  }

  onMounted(async () => {
    if (route.hash) {
      pendingInitialHash = route.hash;
      await router.replace({ path: route.path, hash: "" });
    }

    restoreInitialHashIfReady();
  });

  watch([loading, isReady], () => {
    restoreInitialHashIfReady();
  });
}
