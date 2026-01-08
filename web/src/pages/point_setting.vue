<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import type { User } from '../types/user'
import homeIcon from '../assets/Icon_Home.png'
import nttLogo from '../assets/GlobalLogo_NTTDATA_White.png'

/** 目前登入者（給 TopBar 顯示角色用） */
const me: User | null = JSON.parse(localStorage.getItem('aiadvisor_user') || 'null')

/** 路由、環境變數 */
const router = useRouter()
const API_BASE: string = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

/** 狀態 */
const loading = ref(false)
const toast = ref('')

/** 搜尋欄（輸入 userid） */
const searchUserId = ref('')

/** 查到的使用者（只存必要欄位） */
const targetUser = ref<{ userid: string; role: string } | null>(null)

/** 點數資訊 */
const balance = ref<number | null>(null)
const balanceUpdatedAt = ref<string | null>(null)
type HistItem = { id?: number; kind: 'DEBIT'|'CREDIT'|'REFUND'; amount: number; balance_after: number; note?: string; created_at: string }
const historyRows = ref<HistItem[]>([])

/** 調整點數表單 */
const adjAmount = ref<number | null>(null)
const adjNote = ref('')

/** 返回主選單 */
function backHome(){ router.replace('/admin') }

/** 讀取：依 userid 搜尋 → 先驗證存在 → 取餘額與歷史 */
async function onSearch(){
  if (!searchUserId.value.trim()){
    toast.value = '請輸入要查詢的帳號'
    return
  }
  loading.value = true; toast.value = ''
  targetUser.value = null
  balance.value = null; balanceUpdatedAt.value = null; historyRows.value = []
  try{
    // 1) 驗證使用者是否存在
    const u = await fetch(`${API_BASE}/api/users/${encodeURIComponent(searchUserId.value.trim())}`)
    if (!u.ok){
      toast.value = (u.status === 404) ? '查無此使用者' : '查詢失敗'
      return
    }
    const ujson = await u.json()
    targetUser.value = { userid: ujson.userid, role: ujson.role }

    // 2) 取餘額
    const r1 = await fetch(`${API_BASE}/api/users/${encodeURIComponent(targetUser.value.userid)}/points`)
    if (r1.ok){
      const j1 = await r1.json()
      balance.value = j1.balance ?? 0
      balanceUpdatedAt.value = j1.updated_at ?? null
    }else{
      toast.value = '讀取點數餘額失敗'
      return
    }

    // 3) 取歷史
    const r2 = await fetch(`${API_BASE}/api/users/${encodeURIComponent(targetUser.value.userid)}/points/history?limit=100`)
    if (r2.ok){
      const j2 = await r2.json()
      historyRows.value = Array.isArray(j2.items) ? j2.items : []
      toast.value = `已載入 ${targetUser.value.userid} 的點數資料`
    }else{
      toast.value = '讀取點數歷史失敗'
    }
  }catch(e:any){
    toast.value = `查詢失敗：${e?.message || e}`
  }finally{
    loading.value = false
  }
}

/** 調整：CREDIT / DEBIT / REFUND */
async function adjust(kind: 'CREDIT'|'DEBIT'|'REFUND'){
  if (!targetUser.value){ toast.value = '請先搜尋使用者'; return }
  if (!adjAmount.value || adjAmount.value <= 0){
    toast.value = '請輸入正整數的點數'
    return
  }
  loading.value = true; toast.value = ''
  try{
    const r = await fetch(`${API_BASE}/api/users/${encodeURIComponent(targetUser.value.userid)}/points/adjust`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        amount: adjAmount.value,
        kind,
        note: adjNote.value?.trim() || undefined
      })
    })
    if (!r.ok) throw new Error(await r.text())

    // 成功後重新載入餘額與歷史
    await onSearch()
    adjAmount.value = null
    adjNote.value = ''
    toast.value = '異動完成'
  }catch(e:any){
    toast.value = `異動失敗：${e?.message || e}`
  }finally{
    loading.value = false
  }
}

/** 顯示中文類型 */
const kindLabel = (k: HistItem['kind']) => k === 'CREDIT' ? '加點' : k === 'DEBIT' ? '扣點' : '退款'

/* ==============================
   全域離開提醒（路由守衛 + beforeunload）
   ============================== */
const confirmOnLeave = ref(true)
const LEAVE_MSG = '離開此頁可能導致操作中斷或資料未保存。確定要離開嗎？'
function beforeUnload(e: BeforeUnloadEvent){
  if (!confirmOnLeave.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave((_to, _from, next) => {
  if (!confirmOnLeave.value) return next()
  const ok = window.confirm(LEAVE_MSG)
  if (!ok) return next(false)
  next()
})
</script>

<template>
  <div class="page">
    <TopBar :user="me" />

    <section class="wrap">
      <div class="toprow">
        <img class="ntt" :src="nttLogo" alt="NTT DATA" />
        <button class="home" @click="backHome"><img :src="homeIcon" alt="" /> 返回主選單</button>
      </div>

      <h2 class="title">功能：點數設定 / 管理</h2>

      <!-- 搜尋（依 userid） -->
      <div class="search" @keyup.enter="onSearch">
        <input v-model.trim="searchUserId" type="text" placeholder="帳號搜尋…" />
        <button class="search-btn" :disabled="loading" @click="onSearch">搜尋</button>
      </div>

      <!-- 目標使用者摘要 + 餘額 -->
      <div v-if="targetUser" class="card">
        <div class="summary">
          <div><b>使用者：</b>{{ targetUser.userid }}</div>
          <div><b>角色：</b>{{ targetUser.role }}</div>
          <div><b>目前餘額：</b>{{ balance ?? '—' }}</div>
          <div v-if="balanceUpdatedAt"><b>更新時間：</b>{{ balanceUpdatedAt }}</div>
        </div>
      </div>

      <!-- 調整區塊 -->
      <div v-if="targetUser" class="actions">
        <input class="num" v-model.number="adjAmount" type="number" min="1" placeholder="點數" />
        <input class="note" v-model.trim="adjNote" placeholder="備註（可空）" />
        <button class="primary"  :disabled="loading" @click="adjust('CREDIT')">加點（CREDIT）</button>
        <button class="danger"   :disabled="loading" @click="adjust('DEBIT')">扣點（DEBIT）</button>
        <button class="secondary" :disabled="loading" @click="adjust('REFUND')">退款（REFUND）</button>
      </div>

      <!-- 歷史表格 -->
      <div v-if="targetUser" class="rfc-block" style="margin-top:12px;">
        <div class="rfc-title">最近 100 筆點數異動</div>
        <div class="rfc-scroll">
          <table class="result-table rfc-table">
            <thead>
              <tr>
                <th style="width:110px;">時間</th>
                <th style="width:80px;">類型</th>
                <th style="width:80px; text-align:right;">點數</th>
                <th style="width:110px; text-align:right;">調整後餘額</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in historyRows" :key="i">
                <td>{{ row.created_at }}</td>
                <td>{{ kindLabel(row.kind) }}</td>
                <td style="text-align:right;">{{ row.amount }}</td>
                <td style="text-align:right;">{{ row.balance_after }}</td>
                <td>{{ row.note || '—' }}</td>
              </tr>
              <tr v-if="!historyRows.length">
                <td colspan="5" style="opacity:.7;">尚無點數異動紀錄</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="toast" class="toast">{{ toast }}</p>
    </section>
  </div>
</template>

<style scoped>
/* —— 全頁與背景（從 46px 起） —— */
:global(html, body, #app){
  height:100%; margin:0;
  font-family: Arial, "Microsoft JhengHei", "微軟正黑體", Helvetica, sans-serif;
}
.page{ position:fixed; inset:0; background:#050a1d; }
.wrap{
  position:absolute; top:46px; left:0; right:0; bottom:0;
  padding:24px; color:#e6eefc; overflow:auto;
}

/* 頂列與返回 */
.toprow{ display:flex; align-items:center; justify-content:space-between; }
.ntt{ height:42px; opacity:.95; user-select:none; }
.home{
  display:flex; align-items:center; gap:8px;
  border:1px solid rgba(255,255,255,.22);
  background:transparent; color:#fff;
  padding:8px 12px; border-radius:10px; cursor:pointer;
}
.home img{ width:20px; height:20px; object-fit:contain; }

/* 標題 */
.title{ margin:16px 0 10px; font-size:18px; font-weight:700; color:#cfe2ff; }

/* 搜尋條 */
.search{ display:flex; gap:8px; margin:6px 0 12px; }
.search input{
  flex:1; height:40px; border-radius:12px;
  border:1px solid rgba(255,255,255,.2);
  background:rgba(255,255,255,.05); color:#fff; padding:0 12px; outline:none;
}
.search-btn{
  padding:0 14px; border-radius:12px; border:0;
  background:#2aa6ff; color:#0b1a2b; font-weight:700; cursor:pointer;
}

/* 卡片 */
.card{
  background: rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.18);
  border-radius:16px; padding:18px; backdrop-filter: blur(6px);
}
.summary{
  display:grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap:8px 16px;
}

/* 動作列 */
.actions{ display:flex; gap:12px; margin-top:14px; flex-wrap:wrap; }
.actions button{
  height:44px; padding:0 18px; border-radius:12px; border:0; cursor:pointer; font-weight:700;
}
.actions .num{
  width:140px; height:44px; border-radius:12px; border:1px solid rgba(255,255,255,.2);
  background:rgba(0,0,0,.2); color:#fff; padding:0 12px; outline:none;
}
.actions .note{
  width:280px; height:44px; border-radius:12px; border:1px solid rgba(255,255,255,.2);
  background:rgba(0,0,0,.2); color:#fff; padding:0 12px; outline:none;
}
.primary{ background: linear-gradient(90deg,#2aa6ff,#6bc5ff); color:#0b1a2b; }
.secondary{ background:#184a7c; color:#e6eefc; border:1px solid rgba(255,255,255,.18); }
.danger{ background:#c94141; color:#fff; }
.toast{ margin-top:10px; color:#ffd9a8; }

/* 歷史表格（沿用你 RFC 表格樣式） */
.rfc-block { margin-top: 12px; }
.rfc-title { color:#9fb0c0; font-size:14px; margin:6px 2px 8px; font-weight:600; letter-spacing:.3px; }
.rfc-scroll {
  overflow:auto; border:1px solid rgba(255,255,255,0.12);
  border-radius:12px; background:rgba(255,255,255,0.03);
}
.rfc-table {
  width:100%; min-width:720px; border-collapse:separate; border-spacing:0;
  font-family: Arial, "Microsoft JhengHei", "Noto Sans TC", sans-serif;
}
.rfc-table thead th {
  position:sticky; top:0; z-index:1;
  background:rgba(5,10,29,0.95); backdrop-filter: blur(2px);
  text-align:left; font-weight:600; padding:10px 12px; white-space:nowrap;
  border-bottom:1px solid rgba(255,255,255,0.18);
}
.rfc-table tbody td {
  padding:10px 12px;
  border-bottom:1px dashed rgba(255,255,255,0.12);
  vertical-align:top;
}
.rfc-table tbody tr:hover { background:rgba(255,255,255,0.05); }
.rfc-table tbody tr:last-child td { border-bottom:0; }
</style>
