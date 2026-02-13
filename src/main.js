import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Dashboard from "./views/Dashboard.vue";
import Holdings from "./views/Holdings.vue";
import FamilyAssets from "./views/FamilyAssets.vue";
import CashFlow from "./views/CashFlow.vue";
import "./style.css";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/balance-sheet" },
    { path: "/balance-sheet", component: Dashboard },
    { path: "/dashboard", redirect: "/balance-sheet" },
    { path: "/holdings", component: Holdings },
    { path: "/family-assets", component: FamilyAssets },
    { path: "/cash-flow", component: CashFlow },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
