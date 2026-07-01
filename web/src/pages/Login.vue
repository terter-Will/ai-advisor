<script setup>
import bgUrl from '../assets/NTTD-HOMEPAGE.png';
import nttLogo from '../assets/GlobalLogo_NTTDATA_White.png';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const username = ref('');
const password = ref('');
const showPwd  = ref(false);
const loading  = ref(false);
const errorMsg = ref('');

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')

async function submit() {
  errorMsg.value = ''
  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid: username.value, password: password.value })
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.detail || `登入失敗 (${res.status})`)
    }
    const data = await res.json()
    localStorage.setItem('aiadvisor_user', JSON.stringify(data.user))

    // 依角色導頁
    if (data.user.role === 'admin') router.replace('/admin')
    else router.replace('/user')
  } catch (e) {
    errorMsg.value = String(e.message || e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page" :style="{ '--bg': `url(${bgUrl})` }">
    <img class="brand" :src="nttLogo" alt="NTT DATA" />
    <section class="card">
        <div class="mark" aria-label="AI Advisor">
            <svg viewBox="0 0 800 120" class="mark-svg" role="img">
                <!-- 文字水平置中：x=50% + text-anchor=middle -->
                <text x="50%" y="85" text-anchor="middle"
                    font-size="50" font-weight="700" font-family="Arial"
                    fill="#ffffff" filter="url(#glow)" letter-spacing="2">
                NTTDATA Taiwan - AI Advisor
                </text>
            </svg>
        </div>

      <form class="form" @submit.prevent="submit">
        <label>
          <span></span>
          <input v-model.trim="username" type="text" autocomplete="username" placeholder="輸入帳號" required />
        </label><br><br><br>

        <label>
          <span></span>
          <div class="pwd">
            <input v-model="password" :type="showPwd ? 'text' : 'password'"
                   autocomplete="current-password" placeholder="輸入密碼" required />
            <button type="button" class="eye" @click="showPwd = !showPwd">{{ showPwd ? '隱藏' : '顯示' }}</button>
          </div>
        </label><br>

        <button type="submit" class="submit" :disabled="loading">
          {{ loading ? '登入中…' : '登入' }}
        </button>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      </form>
    </section>
  </div>
</template>

<style scoped>
/* 讓背景真的填滿整個視窗，並拿掉預設邊距／捲動 */
:global(html, body, #app) {
  height: 100%;
  margin: 0;
  overflow: hidden;       /* 不要捲動條 */
}
:global(*), :global(*::before), :global(*::after) { box-sizing: border-box; }

/* 背景全螢幕鋪滿，沒有任何邊界 */
.login-page {
  --bg: none;
  position: fixed;        /* 直接貼住視窗 */
  inset: 0;               /* top/right/bottom/left 全 0 */
  display: flex;
  justify-content: left-end;/* 卡片置中（要靠右就改成 flex-end） */
  padding-left: 50px;
  align-items: center;
  color: #fff;
}
.login-page::before {
  content: "";
  position: absolute; inset: 0;
  background-image: var(--bg);
  background-size: cover;         /* 充滿視窗（可能略裁切，沒有黑邊） */
  background-position: center;
  filter: brightness(0.55) saturate(1.05);
}
.login-page::after {
  content: "";
  position: absolute; inset: 0;
  /* 你可以調整漸層，這裡讓中央較亮、四周暗角 */
  background: radial-gradient(1200px 800px at 50% 60%,
              rgba(0,0,0,0.12), rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.78));
  pointer-events: none;
}

/* 左上 NTT DATA logo */
.brand {
  position: absolute;
  top: 24px; left: 24px;
  width: 220px;   /* 固定桌機尺寸，不做手機縮放 */
  opacity: .95;
  z-index: 2;
  user-select: none;
}

/* 登入卡片（桌機固定寬度） */
.card {
  position: relative;
  z-index: 2;
  width: 560px;                 /* 固定桌機寬度 */
  padding: 28px 36px 32px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.18);
  box-shadow: 0 15px 40px rgba(0,0,0,.35);
  backdrop-filter: blur(10px);
  border-radius: 18px;
}

.mark { margin-bottom: 10px; display: grid; place-items: start; }
.mark-svg { width: 100%; height: 80px; }

.form input { width: 100%; }
.pwd { position: relative; }
.pwd input { padding-right: 76px; }      /* 預留右側「顯示」按鈕空間 */
.eye {                                    /* 既有樣式略，確保在輸入框內右側 */
  position: absolute; top: 50%; right: 10px; transform: translateY(-50%);
  border: 0; padding: 6px 10px; border-radius: 8px; font-size: 12px;
  background: #fff; color: #0b1a2b; cursor: pointer;
}

input {
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(0,0,0,0.2);
  color: #fff;
  outline: none;
  transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
}
input::placeholder { color: rgba(255,255,255,0.6); }
input:focus {
  border-color: rgba(125,200,255,.9);
  background: rgba(0,0,0,0.25);
  box-shadow: 0 0 0 4px rgba(125,200,255,.18);
}

.pwd { position: relative; }
.eye {
  position: absolute; top: 50%; right: 8px; transform: translateY(-50%);
  border: 0; padding: 6px 10px; border-radius: 8px;
  font-size: 12px; line-height: 1; color: #0b1a2b; background: #fff; cursor: pointer;
}

.submit {
  margin-top: 5px; height: 46px; width: 20%; border: 0; border-radius: 12px;
  font-weight: 700; letter-spacing: .5px;
  background: linear-gradient(90deg, #2aa6ff, #6bc5ff);
  color: #0b1a2b; cursor: pointer; box-shadow: 0 10px 24px rgba(42,166,255,.35);
}
.submit:hover { filter: brightness(1.05); }
.submit:active { transform: translateY(1px); }
</style>