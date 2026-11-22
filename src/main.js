import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import { isStagingBuild, showStagingBanner } from "./staging-banner.js";
import Home from "./views/Home.vue";
import BalanceSheet from "./views/BalanceSheet.vue";
import CashFlow from "./views/CashFlow.vue";
import FireSimulator from "./views/FireSimulator.vue";
import FireProgress from "./views/FireProgress.vue";
import "./style.css";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // 既定の着地先はホーム（アプリのルートそのもの）。/home というパスは作らない。
    { path: "/", component: Home },
    { path: "/balance-sheet", component: BalanceSheet },
    { path: "/holdings", redirect: "/balance-sheet" },
    { path: "/cash-flow", component: CashFlow },
    { path: "/progress", component: FireProgress },
    { path: "/fire", component: FireSimulator },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
if (isStagingBuild()) {
  showStagingBanner();
}
