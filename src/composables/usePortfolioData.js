import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { usePortfolioStore } from "@/stores/portfolio";

export function usePortfolioData() {
  const store = usePortfolioStore();
  const { data, loading, error, source } = storeToRefs(store);

  onMounted(() => {
    if (!data.value && !loading.value && !error.value) {
      store.fetchPortfolio();
    }
  });

  return {
    store,
    data,
    loading,
    error,
    source,
  };
}
