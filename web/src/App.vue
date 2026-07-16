<script setup>
import Login from './pages/Login.vue'
import InsufficientPointsModal from './components/InsufficientPointsModal.vue'
</script>
<template>
  <RouterView />
  <InsufficientPointsModal />
</template>