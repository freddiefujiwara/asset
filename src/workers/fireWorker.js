import { simulateFire } from "../domain/fire.js";

self.onmessage = (e) => {
  const params = e.data;
  try {
    const result = simulateFire(params);
    self.postMessage({ type: "success", result });
  } catch (error) {
    self.postMessage({ type: "error", error: error.message });
  }
};
