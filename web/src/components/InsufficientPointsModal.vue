<script setup lang="ts">
import { useRouter } from 'vue-router'
import { pointsGateState, closeInsufficientPointsModal } from '../composables/pointsGate'

const router = useRouter()

function backHome() {
  closeInsufficientPointsModal()
  let role = 'user'
  try { role = (JSON.parse(localStorage.getItem('aiadvisor_user') || '{}')?.role) || 'user' } catch {}
  router.replace(role === 'admin' ? '/admin' : '/user')
}
</script>

<template>
  <div v-if="pointsGateState.show" class="overlay" @click.self="closeInsufficientPointsModal">
    <div class="modal">
      <div class="title">點數不足</div>
      <p>目前點數餘額不足，請聯繫管理員儲值後再使用此功能。</p>
      <button class="primary" @click="backHome">返回主選單</button>
    </div>
  </div>
</template>

<style scoped>
.overlay{
  position:fixed; inset:0; background:rgba(0,0,0,.55);
  display:flex; align-items:center; justify-content:center; z-index:200;
}
.modal{
  background:#0d1730; border:1px solid rgba(255,255,255,.18); border-radius:16px;
  padding:24px; max-width:360px; color:#e6eefc; text-align:center;
  font-family: Arial, "Microsoft JhengHei", "微軟正黑體", sans-serif;
}
.title{ font-size:18px; font-weight:700; color:#ff9d9d; margin-bottom:10px; }
p{ margin:0; color:#cdd7ea; line-height:1.6; }
.primary{
  margin-top:16px; background: linear-gradient(90deg,#2aa6ff,#6bc5ff); color:#0b1a2b;
  border:0; border-radius:12px; padding:10px 20px; font-weight:700; cursor:pointer;
}
</style>
