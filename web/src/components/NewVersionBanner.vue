<script setup lang="ts">
import { versionCheckState, reloadForNewVersion } from '../composables/versionCheck'
</script>

<template>
  <div v-if="versionCheckState.newVersionAvailable" class="banner">
    <span>有新版本可用</span>
    <button @click="reloadForNewVersion">重新整理</button>
  </div>
</template>

<style scoped>
.banner{
  position:fixed; left:50%; bottom:20px; transform:translateX(-50%);
  display:flex; align-items:center; gap:12px;
  background:#0d1730; border:1px solid rgba(255,255,255,.22); border-radius:12px;
  padding:10px 16px; color:#e6eefc; font-size:13px; z-index:300;
  box-shadow:0 8px 24px rgba(0,0,0,.35);
  font-family: Arial, "Microsoft JhengHei", "微軟正黑體", sans-serif;
}
.banner button{
  background: linear-gradient(90deg,#2aa6ff,#6bc5ff); color:#0b1a2b;
  border:0; border-radius:10px; padding:6px 14px; font-weight:700; cursor:pointer;
}
</style>
