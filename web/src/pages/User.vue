<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import type { User } from '../types/user'
import { useRouter } from 'vue-router'

/** 背景與圖標：把路徑換成你專案裡的實際檔名 */
import bg from '../assets/Menu.jpg'          // ← 圖1（背景）
import securityIcon from '../assets/security_scan.png'  // ← 圖2（資安漏洞檢測）
import performanceIcon from '../assets/Performance.png'// ← 圖3（系統效能檢測）
import abapIcon from '../assets/ABAP_test.png'// ← 圖4（客製程式效能檢測）
import ppIcon from '../assets/Icon_pp.png'
import llmIcon from '../assets/Icon_llm.png'

const router = useRouter()
const me: User | null = JSON.parse(localStorage.getItem('aiadvisor_user') || 'null')

// 導頁
function goSecurity()   { router.push('/user/security-scan') }
function goPerformance() { router.push('/user/performance') }
function goABAP() { router.push('/user/abap-test') }
function goPP() { router.push('/user/purchase-predict') }
function goLLM() { window.open('http://172.16.188.175:3000/', '_blank') }
</script>

<template>
  <div class="user" :style="{ '--bg': `url(${bg})` }">
    <TopBar :user="me" />

    <aside class="dock">
      <button class="tile" @click="goSecurity">
        <img :src="securityIcon" alt="" />
        <div class="title">SAP 資安漏洞檢測</div>
      </button>

      <button class="tile" @click="goPerformance">
        <img :src="performanceIcon" alt="" />
        <div class="title">SAP 系統效能檢測</div>
      </button>

      <button class="tile" @click="goABAP">
        <img :src="abapIcon" alt="" />
        <div class="title">SAP 客製程式效能檢測</div>
      </button>

      <button class="tile" @click="goPP">
        <img :src="ppIcon" alt="" />
        <div class="title">銷售預測</div>
      </button>

      <button class="tile" @click="goLLM">
        <img :src="llmIcon" alt="" />
        <div class="title">AI Advisor</div>
      </button>
    </aside>
  </div>
</template>

<style scoped>
:global(html, body, #app){ height:100%; margin:0; }
:global(body){ overflow:hidden; }

.user{ position: fixed; inset:0; }

/* 背景只覆蓋 TopBar 之下 */
.user::before{
  content:"";
  position: fixed;
  top: 46px; left:0; right:0; bottom:0;   /* ← 從 46px 開始鋪 */
  background: var(--bg, none) center right / cover no-repeat;
  z-index: 0;
}

/* 把圖傳進來（可用 CSS 變數或直接寫 URL） */
.user{ --bg: url('../assets/ai_admin_bg.jpg'); }

/* 右側 Dock：設定固定高度並平均分配剩餘空間 */
.dock{
  position: absolute; 
  right: 144px; 
  top: 50%; 
  transform: translateY(-50%);
  display: flex; 
  flex-direction: column;
  justify-content: space-evenly;  /* ★ 核心修改：讓這 5 塊均分垂直空間 */
  width: 350px; 
  height: calc(100vh - 120px);    /* ★ 核心修改：指定佔據螢幕高度，扣掉 TopBar 留白 */
  z-index: 2;
}

.tile{
  display:grid; grid-template-columns: 88px 1fr; align-items:center; gap:18px;
  padding:4px 8px; border-radius:18px; border:1px solid rgba(255,255,255,.15);
  background: rgba(10,16,28,.55); backdrop-filter: blur(8px);
  color:#fff; text-align:left; cursor:pointer;
  box-shadow: 0 12px 30px rgba(0,0,0,.35);
  transition: transform .15s ease, box-shadow .2s ease, background .2s ease;
}
.tile:hover{ transform: translateY(-2px); background: rgba(10,16,28,.65); box-shadow:0 16px 36px rgba(0,0,0,.45); }
.tile img{ width:88px; height:88px; object-fit:contain; display:block; }
.tile .title{ font-size:18px; font-weight:700; line-height:1.3; }
</style>