import { nextTick, onMounted, watch } from "vue";

/**
 * Restore location hash after first data render.
 */
export function useInitialHashRestore({ route, router, loading, isReady }) {
  let pendingInitialHash = "";
  let restoredInitialHash = false;

  /**
   * Scroll to pending hash target when element exists.
   */
  function scrollToPendingHash() {
    if (!pendingInitialHash) {
      return;
    }

    const target = document.querySelector(pendingInitialHash);
    if (target) {
      target.scrollIntoView({ block: "start" });
    }
  }

  /**
   * Wait for view readiness and then restore hash.
   */
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
    // Share links carry their token in the hash (#share=...); that fragment
    // belongs to the portfolio store, so never stash/strip/restore it here.
    if (route.hash && !route.hash.startsWith("#share=")) {
      pendingInitialHash = route.hash;
      await router.replace({ path: route.path, hash: "" });
    }

    restoreInitialHashIfReady();
  });

  watch([loading, isReady], () => {
    restoreInitialHashIfReady();
  });
}
