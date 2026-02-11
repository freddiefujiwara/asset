<script setup>
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1>資産可視化ダッシュボード</h1>
      <nav class="nav">
        <RouterLink to="/dashboard">Dashboard</RouterLink>
        <RouterLink to="/holdings">Holdings</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
