<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import type { User } from '../types/user'
import { useRouter } from 'vue-router'

/** 背景與圖標：把路徑換成你專案裡的實際檔名 */
import bg from '../assets/Menu.jpg'          // ← 圖1（背景）
import pointsIcon from '../assets/Icon_Setup.png'  // ← 圖2（點數設定/查詢）
import accountIcon from '../assets/Icon_UserAdmin.png'// ← 圖3（使用者帳號維護）

const router = useRouter()
const me: User | null = JSON.parse(localStorage.getItem('aiadvisor_user') || 'null')

// 導頁
function goPoints()   { router.push('/admin/point-setting') }
function goAccounts() { router.push('/admin/account-setting') }
</script>

<template>
  <div class="admin" :style="{ '--bg': `url(${bg})` }">
    <TopBar :user="me" />

    <!-- 右側功能 Dock -->
    <aside class="dock">
      <button class="tile" @click="goPoints">
        <img :src="pointsIcon" alt="" />
        <div class="title">使用者點數設定 / 查詢</div>
      </button>

      <button class="tile" @click="goAccounts">
        <img :src="accountIcon" alt="" />
        <div class="title">使用者帳號維護</div>
      </button>
    </aside>
  </div>
</template>

<style scoped>
:global(html, body, #app){ height:100%; margin:0; }
:global(body){ overflow:hidden; }

.admin{ position: fixed; inset:0; }

/* 背景只覆蓋 TopBar 之下 */
.admin::before{
  content:"";
  position: fixed;
  top: 46px; left:0; right:0; bottom:0;   /* ← 從 46px 開始鋪 */
  background: var(--bg, none) center right / cover no-repeat;
  z-index: 0;
}

/* 把圖傳進來（可用 CSS 變數或直接寫 URL） */
.admin{ --bg: url('../assets/ai_admin_bg.jpg'); }
/* 右側 Dock：放在背景右側黑色區 */
.dock{
  position:absolute; right:104px; top:50%; transform:translateY(-50%);
  display:grid; gap:104px;
  width: 400px;               /* 卡片寬度 */
  z-index:2;
}
.tile{
  display:grid; grid-template-columns: 88px 1fr; align-items:center; gap:18px;
  padding:18px 20px; border-radius:18px; border:1px solid rgba(255,255,255,.15);
  background: rgba(10,16,28,.55); backdrop-filter: blur(8px);
  color:#fff; text-align:left; cursor:pointer;
  box-shadow: 0 12px 30px rgba(0,0,0,.35);
  transition: transform .15s ease, box-shadow .2s ease, background .2s ease;
}
.tile:hover{ transform: translateY(-2px); background: rgba(10,16,28,.65); box-shadow:0 16px 36px rgba(0,0,0,.45); }
.tile img{ width:88px; height:88px; object-fit:contain; display:block; }
.tile .title{ font-size:18px; font-weight:700; line-height:1.3; }
</style>