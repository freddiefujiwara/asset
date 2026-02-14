import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Dashboard from "./views/Dashboard.vue";
import CashFlow from "./views/CashFlow.vue";
import FireSimulator from "./views/FireSimulator.vue";
import "./style.css";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/balance-sheet" },
    { path: "/balance-sheet", component: Dashboard },
    { path: "/holdings", redirect: "/balance-sheet" },
    { path: "/cash-flow", component: CashFlow },
    { path: "/fire", component: FireSimulator },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
