import { reactive } from "vue";

const tickerMap = reactive({});
const fetchingSet = new Set();
const queue = [];
let isProcessing = false;

async function processQueue() {
  if (queue.length === 0) {
    isProcessing = false;
    return;
  }
  isProcessing = true;
  const name = queue.shift();

  try {
    const prompt = `'${name}の証券取引所における普通株のティッカーを、Yahoo Finance形式（例: 9984.T）で1つだけ**ティッカーのみ**出力してください'`;
    const url = `https://script.google.com/macros/s/AKfycbzCuadMRvTEB_iNYUV6TdvGQjjN8ntmJr-2YzLY71h7y-hyIiBCz5eBzvAR9N-wgTX02w/exec?p=${encodeURIComponent(
      prompt
    )}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.answer && String(data.answer).trim()) {
      tickerMap[name] = String(data.answer).trim();
    }
  } catch (e) {
    console.error(`Failed to fetch ticker for ${name}:`, e);
  } finally {
    fetchingSet.delete(name);
    // Sequential processing with a small delay to avoid overwhelming
    setTimeout(processQueue, 200);
  }
}

/**
 * Composable for fetching Yahoo Finance tickers for stock names.
 * Features:
 * - Reactive map for tickers
 * - Sequential background fetching
 * - Global cache within the session
 */
export function useYahooFinanceTicker() {
  function requestTicker(name) {
    if (
      !name ||
      tickerMap[name] ||
      fetchingSet.has(name) ||
      queue.includes(name)
    ) {
      return;
    }
    fetchingSet.add(name);
    queue.push(name);
    if (!isProcessing) {
      processQueue();
    }
  }

  return {
    tickerMap,
    requestTicker,
  };
}
