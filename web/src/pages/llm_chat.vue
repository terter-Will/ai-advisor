<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import nttLogo from '../assets/GlobalLogo_NTTDATA_White.png'
import homeIcon from '../assets/Icon_Home.png'
import { useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { startBilling, useAutoStopBilling } from '../composables/featureBilling'

function getCurrentUser() {
  const raw = localStorage.getItem('aiadvisor_user')
  if (!raw) return null
  try { const obj = JSON.parse(raw); return obj?.user ?? obj ?? null } catch { return null }
}
const me = getCurrentUser()

const router = useRouter()
const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')
const OWU_URL = import.meta.env.VITE_OWU_URL as string
function backHome(){ router.replace('/user') }

// Open WebUI 本身會即時把每則對話存進使用者自己的帳號，
// 離開這個頁面不會遺失任何東西，不需要額外的離開警告。
onMounted(() => {
  if (me?.userid) {
    startBilling({
      userid: me.userid,
      apiBase: API_BASE,
      label: 'AI Advisor 對話',
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

      <div class="frame-card">
        <iframe class="owu-frame" :src="OWU_URL" title="AI Advisor 對話" allow="microphone"></iframe>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page{ position:fixed; inset:0; background:#050a1d; }
.wrap{
  position:absolute; top:46px; left:0; right:0; bottom:0;
  padding:16px; color:#e6eefc;
  font-family: Arial, "Microsoft JhengHei", "微軟正黑體", sans-serif;
  display:flex; flex-direction:column;
}
.toprow{ display:flex; align-items:center; justify-content:space-between; flex-shrink:0; margin-bottom:12px; }
.ntt{ height:42px; opacity:.95; user-select:none; }
.home{
  display:flex; align-items:center; gap:8px;
  border:1px solid rgba(255,255,255,.22);
  background:transparent; color:#fff;
  padding:8px 12px; border-radius:10px; cursor:pointer;
}
.home img{ width:20px; height:20px; object-fit:contain; }

.frame-card{
  flex:1; min-height:0;
  background: rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.18);
  border-radius:16px; overflow:hidden;
}
.owu-frame{ width:100%; height:100%; border:0; display:block; }
</style>
