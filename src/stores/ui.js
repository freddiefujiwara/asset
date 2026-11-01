import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useUiStore = defineStore("ui", () => {
  const privacyMode = ref(localStorage.getItem("asset-privacy") === "on");
  // While share mode is active, privacy masking is suspended so the viewer
  // sees the numbers; the stored preference itself is left untouched.
  const privacySuspended = ref(false);

  const applyPrivacy = () => {
    const enabled = privacyMode.value && !privacySuspended.value;
    document.documentElement.setAttribute("data-private", enabled ? "on" : "off");
  };

  watch(privacyMode, (enabled) => {
    localStorage.setItem("asset-privacy", enabled ? "on" : "off");
    applyPrivacy();
  });

  const setPrivacySuspended = (suspended) => {
    privacySuspended.value = suspended;
    applyPrivacy();
  };

  const togglePrivacy = () => {
    privacyMode.value = !privacyMode.value;
  };

  return {
    privacyMode,
    privacySuspended,
    setPrivacySuspended,
    togglePrivacy,
  };
});
