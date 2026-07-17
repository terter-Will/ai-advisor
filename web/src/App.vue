<script setup>
import Login from './pages/Login.vue'
import InsufficientPointsModal from './components/InsufficientPointsModal.vue'
import NewVersionBanner from './components/NewVersionBanner.vue'
import { onMounted } from 'vue'
import { startVersionCheck } from './composables/versionCheck'

onMounted(startVersionCheck)
</script>
<template>
  <RouterView />
  <InsufficientPointsModal />
  <NewVersionBanner />
</template>