import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import { useUiStore } from "./ui";

describe("ui store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.removeAttribute("data-private");
  });

  it("initializes with privacyMode from localStorage (off by default)", () => {
    const ui = useUiStore();
    expect(ui.privacyMode).toBe(false);
  });

  it("initializes with privacyMode from localStorage (on)", () => {
    localStorage.setItem("asset-privacy", "on");
    const ui = useUiStore();
    expect(ui.privacyMode).toBe(true);
  });

  it("toggles privacyMode", async () => {
    const ui = useUiStore();
    expect(ui.privacyMode).toBe(false);
    ui.togglePrivacy();
    expect(ui.privacyMode).toBe(true);

    await nextTick();
    expect(localStorage.getItem("asset-privacy")).toBe("on");
    expect(document.documentElement.getAttribute("data-private")).toBe("on");

    ui.togglePrivacy();
    expect(ui.privacyMode).toBe(false);

    await nextTick();
    expect(localStorage.getItem("asset-privacy")).toBe("off");
    expect(document.documentElement.getAttribute("data-private")).toBe("off");
  });

  it("suspends privacy while share mode is active", async () => {
    localStorage.setItem("asset-privacy", "on");
    const ui = useUiStore();
    expect(ui.privacyMode).toBe(true);

    ui.setPrivacySuspended(true);
    await nextTick();
    expect(ui.privacySuspended).toBe(true);
    expect(document.documentElement.getAttribute("data-private")).toBe("off");
    // The stored preference itself is not rewritten by suspension.
    expect(localStorage.getItem("asset-privacy")).toBe("on");

    ui.setPrivacySuspended(false);
    await nextTick();
    expect(document.documentElement.getAttribute("data-private")).toBe("on");
  });

  it("keeps data-private off when suspended while privacy is off", async () => {
    const ui = useUiStore();
    expect(ui.privacyMode).toBe(false);

    ui.setPrivacySuspended(true);
    await nextTick();
    expect(document.documentElement.getAttribute("data-private")).toBe("off");

    ui.setPrivacySuspended(false);
    await nextTick();
    expect(document.documentElement.getAttribute("data-private")).toBe("off");
  });
});
