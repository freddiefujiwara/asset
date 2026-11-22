import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import ShareSessionCard from "./ShareSessionCard.vue";

let portfolioStore;
let writeTextMock;

vi.mock("@/stores/portfolio", () => ({
  usePortfolioStore: () => portfolioStore,
}));

const futureExpiry = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

describe("ShareSessionCard", () => {
  beforeEach(() => {
    // Vitest 5 no longer surfaces the Vite `base` as import.meta.env.BASE_URL
    // in the test environment; pin the production value explicitly.
    vi.stubEnv("BASE_URL", "/asset/");
    portfolioStore = reactive({
      issuedShare: null,
      issueShare: vi.fn(async () => {
        portfolioStore.issuedShare = { token: "tok123", expiresAt: futureExpiry() };
        return portfolioStore.issuedShare;
      }),
      revokeShare: vi.fn(async () => {
        portfolioStore.issuedShare = null;
      }),
    });
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  });

  it("shows the explanation and issue button before issuing", () => {
    const wrapper = mount(ShareSessionCard);
    expect(wrapper.text()).toContain("一時アクセスリンク");
    expect(wrapper.text()).toContain("ログイン不要で1か月間データを閲覧できるURLを発行します");
    expect(wrapper.text()).toContain("1か月間有効な閲覧用URLを発行");
    expect(wrapper.text()).not.toContain("#share=");
  });

  it("issues a share URL and shows it with its remaining time", async () => {
    const wrapper = mount(ShareSessionCard);
    const button = wrapper.findAll("button").find((b) => b.text().includes("発行"));
    await button.trigger("click");

    expect(portfolioStore.issueShare).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("/asset/balance-sheet#share=tok123");
    expect(wrapper.text()).toContain("残り約30日");
    expect(wrapper.text()).toContain("まで有効");
    expect(wrapper.text()).toContain("URLをコピー");
    expect(wrapper.text()).toContain("このURLを無効化");
  });

  it("copies the share URL to the clipboard", async () => {
    portfolioStore.issuedShare = { token: "tok123", expiresAt: futureExpiry() };
    const wrapper = mount(ShareSessionCard);
    const button = wrapper.findAll("button").find((b) => b.text() === "URLをコピー");
    await button.trigger("click");

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock.mock.calls[0][0]).toContain("/asset/balance-sheet#share=tok123");
    expect(wrapper.text()).toContain("コピーしました");
  });

  it("revokes the issued URL", async () => {
    portfolioStore.issuedShare = { token: "tok123", expiresAt: futureExpiry() };
    const wrapper = mount(ShareSessionCard);
    const button = wrapper.findAll("button").find((b) => b.text() === "このURLを無効化");
    await button.trigger("click");

    expect(portfolioStore.revokeShare).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("1か月間有効な閲覧用URLを発行");
    expect(wrapper.text()).not.toContain("#share=");
  });

  it("shows an error when issuing fails", async () => {
    portfolioStore.issueShare = vi.fn().mockRejectedValue(new Error("AUTH 403: forbidden email"));
    const wrapper = mount(ShareSessionCard);
    const button = wrapper.findAll("button").find((b) => b.text().includes("発行"));
    await button.trigger("click");

    expect(wrapper.text()).toContain("AUTH 403: forbidden email");
  });

  it("disables the issue button while issuing", async () => {
    portfolioStore.issueShare = vi.fn(() => new Promise(() => {}));
    const wrapper = mount(ShareSessionCard);
    const button = wrapper.findAll("button").find((b) => b.text().includes("発行"));
    await button.trigger("click");

    const busyButton = wrapper.findAll("button").find((b) => b.text().includes("発行中"));
    expect(busyButton).toBeTruthy();
    expect(busyButton.attributes("disabled")).toBeDefined();
  });
});
