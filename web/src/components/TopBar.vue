<script setup lang="ts">
import type { User } from '../types/user';
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { featureBillingState, formattedTime } from '../composables/featureBilling'

const props = defineProps<{ user: User | null }>();
const router = useRouter();

function logout() {
  localStorage.removeItem('aiadvisor_user');
  router.replace('/login');
}

/** 內部持有的餘額，預設吃 props，再隨事件/輪詢更新 */
const balance = ref<number | null>(props.user?.points_balance ?? null)
const userid  = computed(() => props.user?.userid || null)
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

async function refreshBalanceOnce() {
  if (!userid.value) return
  try {
    const r = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userid.value)}/points`)
    if (!r.ok) return
    const j = await r.json() // j.balance / j.points_balance 都可用 :contentReference[oaicite:3]{index=3}
    balance.value = typeof j.balance === 'number' ? j.balance : (j.points_balance ?? balance.value)
  } catch {}
}

function onPointsUpdated(e: CustomEvent) {
  const j: any = e.detail || {}
  if (typeof j.balance === 'number') balance.value = j.balance
  else if (typeof j.points_balance === 'number') balance.value = j.points_balance
}

let _poll: number | null = null
onMounted(() => {
  // 事件訂閱：扣點成功後的即時更新
  window.addEventListener('points:updated', onPointsUpdated as EventListener)

  // 初次載入拉一次
  refreshBalanceOnce()

  // 輕量備援輪詢（每 60 秒拉一次，避免事件漏掉）
  _poll = window.setInterval(refreshBalanceOnce, 60000)
})

onBeforeUnmount(() => {
  window.removeEventListener('points:updated', onPointsUpdated as EventListener)
  if (_poll) { clearInterval(_poll); _poll = null }
})

const displayBalance = computed(() => balance.value ?? props.user?.points_balance ?? 0)
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