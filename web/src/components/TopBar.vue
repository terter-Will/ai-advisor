<script setup lang="ts">
import type { User } from '../types/user';
import { onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import { featureBillingState, formattedTime } from '../composables/featureBilling'
import { pointsBalanceState, refreshPointsBalance } from '../composables/pointsBalance'

const props = defineProps<{ user: User | null }>();
const router = useRouter();

function logout() {
  localStorage.removeItem('aiadvisor_user');
  router.replace('/login');
}

const userid  = computed(() => props.user?.userid || null)
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

// 餘額是跨頁面共用的全域狀態（見 pointsBalance.ts）。
// 只有在還沒查過「這個使用者」的餘額時才墊 props 的舊值，查過一次之後就不再被新頁面的初始值蓋掉。
const balance = computed(() => {
  if (pointsBalanceState.userid === userid.value) return pointsBalanceState.balance
  return props.user?.points_balance ?? null
})

let _poll: number | null = null
onMounted(() => {
  if (userid.value) refreshPointsBalance(userid.value, API_BASE)
  // 輕量備援輪詢（每 60 秒拉一次，避免扣點事件漏掉）
  _poll = window.setInterval(() => {
    if (userid.value) refreshPointsBalance(userid.value, API_BASE)
  }, 60000)
})

onBeforeUnmount(() => {
  if (_poll) { clearInterval(_poll); _poll = null }
})

const displayBalance = computed(() => balance.value ?? 0)
</script>

<template>
  <header class="topbar">
    <div class="left"><strong>NTTDATA Taiwan - AI Advisor</strong></div>
    <div class="right">
      <span v-if="featureBillingState.running" title="功能計時中">
      ｜⏱ {{ formattedTime }}（每分扣 {{ featureBillingState.perMinute }} 點）｜
      </span>
      <span v-if="balance !== null" class="points">點數餘額：{{ displayBalance }}</span>
      <span class="user">{{ props.user?.userid }}（{{ props.user?.role }}）</span>
      <button class="logout" @click="logout">登出</button>
    </div>
  </header>
</template>

<style scoped>
.topbar { position:fixed; inset:0 0 auto 0; height:46px; display:flex; align-items:center;
  justify-content:space-between; padding:0 16px; background:#050a1d;
  color:#fff; backdrop-filter: blur(6px); z-index:10;
  outline: 1px solid #868585;  /* 外框 */
  outline-offset: -3px;          /* 往內貼齊 */}
.right{ display:flex; align-items:center; gap:14px; }
.points{ padding:4px 10px; background:#1e2b3f; border-radius:999px; }
.logout{ border:0; padding:6px 12px; border-radius:8px; cursor:pointer; }
</style>