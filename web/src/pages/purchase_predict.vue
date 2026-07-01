<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import nttLogo from '../assets/GlobalLogo_NTTDATA_White.png'
import homeIcon from '../assets/Icon_Home.png'
import { useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { startBilling, useAutoStopBilling } from '../composables/featureBilling'
import {useLeaveConfirm} from '../composables/useLeaveConfirm'

/** 統一取得目前登入者 */
function getCurrentUser() {
  const raw = localStorage.getItem('aiadvisor_user')
  if (!raw) return null
  try { const obj = JSON.parse(raw); return obj?.user ?? obj ?? null } catch { return null }
}
const me = getCurrentUser()

const router = useRouter()
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'
function backHome(){ router.replace('/user') }

/** 功能頁：掛上全域離開提醒 */
useLeaveConfirm()

/** 進入頁面 → 開始計時（滿 60 秒扣 1 點）；離開/卸載 → 自動停止 */
onMounted(() => {
  if (me?.userid) {
    startBilling({
      userid: me.userid,
      apiBase: API_BASE,
      label: '銷售訂單', // 記錄至 points_ledger.note
      // perMinute: 1,        // 如需不同權重，在此覆寫
    })
  }
})
useAutoStopBilling()
</script>

<template>
  <div class="page">
    <TopBar :user="me" />

    <section class="wrap">
      <div class="toprow">
        <img class="ntt" :src="nttLogo" alt="NTT DATA" />
        <button class="home" @click="backHome"><img :src="homeIcon" alt="" /> 返回主選單</button>
      </div>

      <h2 class="title">功能：銷售訂單（測試中）</h2>

      <div class="card">
        <p>此頁一進入開始計時，每滿 60 秒扣 1 點。TopBar 會顯示計時 mm:ss 與「每分扣 N 點」。</p>
        <p>之後可在此接：RFC 讀 xxxxx → 產生 .txt → 呼叫 AI → 顯示 & 匯出 Word。</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page{ position:fixed; inset:0; background:#050a1d; }
.wrap{
  position:absolute; top:46px; left:0; right:0; bottom:0;
  padding:24px; color:#e6eefc; overflow:auto;
  font-family: Arial, "Microsoft JhengHei", "微軟正黑體", sans-serif;
}
.toprow{ display:flex; align-items:center; justify-content:space-between; }
.ntt{ height:42px; opacity:.95; user-select:none; }
.home{
  display:flex; align-items:center; gap:8px;
  border:1px solid rgba(255,255,255,.22);
  background:transparent; color:#fff;
  padding:8px 12px; border-radius:10px; cursor:pointer;
}
.home img{ width:20px; height:20px; object-fit:contain; }
.title{ margin:16px 0 10px; font-size:18px; font-weight:700; color:#cfe2ff; }
.card{
  background: rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.18);
  border-radius:16px; padding:18px; backdrop-filter: blur(6px);
}
</style>
