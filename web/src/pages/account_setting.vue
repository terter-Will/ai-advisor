<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import type { User } from '../types/user'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import homeIcon from '../assets/Icon_Home.png'
import nttLogo from '../assets/GlobalLogo_NTTDATA_White.png'

// === 全域離開提醒（路由守衛 + beforeunload）===
// 貼在 <script setup lang="ts"> 區塊的最後面；不影響原有功能。
// 說明：任何時候離開此頁（換路由、上一頁、重新整理、關頁），都會跳出確認。

import { ref as __ref, onMounted as __onMounted, onBeforeUnmount as __onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave as __onBeforeRouteLeave } from 'vue-router'

// 可動態開關（預設啟用全域提醒）。若某段流程想暫時關閉：__confirmOnLeave.value = false
const __confirmOnLeave = __ref(true)

const __LEAVE_MESSAGE = '離開此頁可能導致操作中斷或資料未保存。確定要離開嗎？'

// SPA 重新整理 / 關頁 提醒（瀏覽器原生提示，文字不可自訂）
function __beforeUnload(e: BeforeUnloadEvent) {
  if (!__confirmOnLeave.value) return
  e.preventDefault()
  e.returnValue = '' // 設置任意字串可觸發提示（實際顯示內容由瀏覽器決定）
}
__onMounted(() => window.addEventListener('beforeunload', __beforeUnload))
__onBeforeUnmount(() => window.removeEventListener('beforeunload', __beforeUnload))

// 路由切換（包含按「上一頁」、跳其他頁）提示
__onBeforeRouteLeave((_to, _from, next) => {
  if (!__confirmOnLeave.value) return next()
  const ok = window.confirm(__LEAVE_MESSAGE)
  if (!ok) return next(false)
  next()
})

type Mode = 'create' | 'update' | 'delete' | 'test'
const router = useRouter()
const me: User | null = JSON.parse(localStorage.getItem('aiadvisor_user') || 'null')


const mode = ref<Mode>('create')
const searchUserId = ref<string>('')

const form = ref({
  userid:   '',
  password: '',   // 直接顯示（admin 用）
  sapconn:  '',   // 連線說明
  sapaddr:  '',   // 主機
  sapins:   '',   // 事例號碼 2 碼
  sapid:    '',   // 系統 ID 3 碼
  sapclnt:  '',   // Client 3 碼
  saprouter:'',   // Router（可空）
  sapusr:   '',   // SAP Logon user
  sappw:    '',   // SAP Logon 密碼（直接顯示）
})

const title = computed(() => {
  switch (mode.value) {
    case 'create': return '功能：新增帳號'
    case 'update': return '功能：修改帳號'
    case 'delete': return '功能：帳號刪除'
    case 'test':   return '功能：SAP 連線測試'
  }
})

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')
const loading = ref(false)
const toast = ref('')

// 保留「查詢到的原始資料」快照，用來比對只送有變更的欄位
const loadedUser = ref<any | null>(null)
const clone = <T>(x:T):T => JSON.parse(JSON.stringify(x))

function normStr(v: any){ return (v ?? '').toString().trim() }
function toSid(v: any){ const s = normStr(v).toUpperCase(); return s || undefined }
function to2(v: any){ const s = normStr(v); return s ? s.padStart(2,'0').slice(-2) : undefined }
function to3(v: any){ const s = normStr(v); return s ? s.padStart(3,'0').slice(-3) : undefined }

function resetForm() {
  form.value = { userid:'', password:'', sapconn:'', sapaddr:'', sapins:'', sapid:'', sapclnt:'', saprouter:'', sapusr:'', sappw:'' }
}

function setMode(m: Mode) {
  mode.value = m
  toast.value = ''
  if (m === 'create') { resetForm(); searchUserId.value='' ; loadedUser.value=null }
}

async function search() {
  if (!searchUserId.value) { toast.value = '請輸入要查詢的帳號'; return }
  loading.value = true; toast.value = ''
  try {
    const r = await fetch(`${API_BASE}/api/users/${encodeURIComponent(searchUserId.value)}`)
    if (!r.ok) {
      toast.value = (r.status === 404) ? '查無此使用者' : '查詢失敗'
      resetForm(); loadedUser.value = null
      return
    }
    const data = await r.json()
    loadedUser.value = clone(data)

    form.value.userid   = data.userid   ?? ''
    form.value.password = data.password ?? ''     // 顯示 user 密碼
    form.value.sapconn  = data.sapconn  ?? ''
    form.value.sapaddr  = data.sapaddr  ?? ''
    form.value.sapins   = data.sapins   ?? ''
    form.value.sapid    = data.sapid    ?? ''
    form.value.sapclnt  = data.sapclnt  ?? ''
    form.value.saprouter= data.saprouter?? ''
    form.value.sapusr   = data.sapusr   ?? ''
    form.value.sappw    = data.sappw    ?? ''     // 顯示 SAP 密碼
    toast.value = '已載入帳號資料'
  } catch {
    toast.value = '查詢失敗'; resetForm(); loadedUser.value=null
  } finally { loading.value = false }
}

function buildUpdatePayload(){
  if(!loadedUser.value) return null
  const curr = {
    password: normStr(form.value.password) || undefined,
    sapconn:  normStr(form.value.sapconn)  || undefined,
    sapaddr:  normStr(form.value.sapaddr)  || undefined,
    sapins:   to2(form.value.sapins),
    sapid:    toSid(form.value.sapid),
    sapclnt:  to3(form.value.sapclnt),
    saprouter:normStr(form.value.saprouter) || undefined,
    sapusr:   normStr(form.value.sapusr)   || undefined,
    sappw:    normStr(form.value.sappw)    || undefined,
  }
  const diff: any = {}
  for (const k of Object.keys(curr)){
    const now = (curr as any)[k]
    const old = normStr(loadedUser.value[k])
    const nowStr = now === undefined ? '' : String(now)
    if (nowStr !== old) diff[k] = now
  }
  return diff
}

async function onCreate(){
  if (!form.value.userid || !form.value.password){
    toast.value='請輸入帳號與密碼'; return
  }
  loading.value = true; toast.value=''
  try{
    const r = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        userid:   normStr(form.value.userid),
        password: normStr(form.value.password),
        role:     'user',
        sapconn:  normStr(form.value.sapconn)  || undefined,
        sapaddr:  normStr(form.value.sapaddr)  || undefined,
        sapins:   to2(form.value.sapins),
        sapid:    toSid(form.value.sapid),
        sapclnt:  to3(form.value.sapclnt),
        saprouter:normStr(form.value.saprouter)|| undefined,
        sapusr:   normStr(form.value.sapusr)   || undefined,
        sappw:    normStr(form.value.sappw)    || undefined,
      })
    })
    if (!r.ok){
      if (r.status === 409) throw new Error('帳號已存在')
      throw new Error(await r.text())
    }
    toast.value = '新增完成'
    resetForm(); loadedUser.value=null
  }catch(e:any){
    toast.value = `新增失敗：${e?.message || ''}`
  }finally{ loading.value=false }
}

async function onUpdate(){
  if (!form.value.userid){ toast.value='請先載入或輸入帳號'; return }
  if (!loadedUser.value){ toast.value='請先用搜尋載入帳號'; return }

  const payload = buildUpdatePayload()
  if (!payload || Object.keys(payload).length === 0){
    toast.value = '沒有變更內容'; return
  }

  loading.value = true; toast.value=''
  try{
    const r = await fetch(`${API_BASE}/api/users/${encodeURIComponent(form.value.userid)}`, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    })
    if (!r.ok) throw new Error(await r.text())
    const updated = await r.json()
    loadedUser.value = clone(updated)
    toast.value = '儲存完成'
  }catch(e:any){
    toast.value = `儲存失敗：${e?.message || ''}`
  }finally{ loading.value=false }
}

async function onDelete(){
  if (!form.value.userid){ toast.value='請先載入或輸入帳號'; return }
  if (!confirm(`確定刪除「${form.value.userid}」嗎？`)) return
  loading.value = true; toast.value=''
  try{
    const r = await fetch(`${API_BASE}/api/users/${encodeURIComponent(form.value.userid)}`, {
      method: 'DELETE'
    })
    if (!r.ok) throw new Error(await r.text())
    toast.value = '刪除完成'
    resetForm(); searchUserId.value=''; loadedUser.value=null
  }catch(e:any){
    toast.value = `刪除失敗：${e?.message || ''}`
  }finally{ loading.value=false }
}

// ====== 新增：RFC 表格顯示所需的型別、欄位與表頭定義 ======
type TableKind = 'PRDVERS' | 'CVERS'

// PRDVERS 欄位與表頭（順序固定）
const PRDVERS_FIELDS = [
  'ID', 'NAME', 'VERSION', 'VENDOR',
  'DESCRIPT', 'INSTSTATUS', 'MOD_DATE', 'MOD_TIME'
] as const
const PRDVERS_HEADERS: Record<(typeof PRDVERS_FIELDS)[number], string> = {
  ID:    '系統ID',
  NAME:  'SAP 產品名稱',
  VERSION:  'SAP 版本 1',
  VENDOR:  'SAP 版本 2',
  DESCRIPT: 'SAP PATCH 名稱',
  INSTSTATUS:  '安裝狀態碼',
  MOD_DATE:   '最後系統改日期',
  MOD_TIME:   '最後系統改時'
}

// CVERS 欄位與表頭（順序固定）
const CVERS_FIELDS = ['COMPONENT', 'RELEASE', 'EXTRELEASE', 'COMP_TYPE'] as const
const CVERS_HEADERS: Record<(typeof CVERS_FIELDS)[number], string> = {
  COMPONENT:  'SAP 組件名稱',
  RELEASE:    'SAP 組件版次 1',
  EXTRELEASE: 'SAP 組件版次 2',
  COMP_TYPE:  '組件類別'
}

// 讓 TS 知道每種 table 對應哪一組欄位與表頭（避免 hdrMap[k] 型別報錯）
const KEYS: Record<TableKind, readonly string[]> = {
  PRDVERS: PRDVERS_FIELDS,
  CVERS:   CVERS_FIELDS,
}
const HEADERS: Record<TableKind, Record<string, string>> = {
  PRDVERS: PRDVERS_HEADERS as Record<string, string>,
  CVERS:   CVERS_HEADERS  as Record<string, string>,
}

// ====== 新增：RFC 讀取結果的狀態（只顯示，不入庫） ======
const rfcTitle = ref<TableKind | ''>('')
const rfcKeys  = ref<string[]>([])
const rfcHdrs  = ref<string[]>([])
const rfcRows  = ref<Record<string, string>[]>([])

// 兼容你目前 form 可能是 ref 或 reactive 的存取
function getUserId(): string {
  // @ts-ignore
  return (form?.value?.userid ?? form?.userid ?? '') as string
}

// ====== 新增：呼叫後端 sap-read，讀取 PRDVERS / CVERS 並顯示 ======
async function runSapRead(kind: TableKind) {
  const userid = getUserId()
  if (!userid) { toast.value = '請先以「帳號搜尋」載入要測試的使用者'; return }

  loading.value = true
  toast.value = ''
  rfcTitle.value = ''; rfcKeys.value = []; rfcHdrs.value = []; rfcRows.value = []

  try {
    const keys   = KEYS[kind]
    const hdrMap = HEADERS[kind]
    const fields = (keys as string[]).join(',')

    const url = `${API_BASE}/api/users/${encodeURIComponent(userid)}/sap-read` +
                `?table=${kind}&rows=500&fields=${encodeURIComponent(fields)}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(await r.text())
    const data = await r.json()

    const rows = Array.isArray(data.rows) ? data.rows : []
    rfcRows.value = rows.map((row: any) => {
      const obj: Record<string,string> = {}
      ;(keys as string[]).forEach(k => obj[k] = (row?.[k] ?? '').toString().trim())
      return obj
    })
    rfcKeys.value = [...(keys as string[])]
    rfcHdrs.value = (keys as string[]).map(k => hdrMap[k] ?? k)
    rfcTitle.value = kind
    toast.value = `已讀取 ${kind}：${rfcRows.value.length} 筆`
  } catch (e:any) {
    toast.value = `讀取失敗：${e.message || e}`
  } finally {
    loading.value = false
  }
}

function backHome(){ router.replace('/admin') }
</script>

<template>
  <div class="page">
    <TopBar :user="me" />

    <section class="wrap">
      <div class="toprow">
        <img class="ntt" :src="nttLogo" alt="NTT DATA" />
        <button class="home" @click="backHome"><img :src="homeIcon" alt="" /> 返回主選單</button>
      </div>

      <h2 class="title">{{ title }}</h2>

      <nav class="tabs">
        <button :class="{active: mode==='create'}" @click="setMode('create')">新增使用者</button>
        <button :class="{active: mode==='update'}" @click="setMode('update')">修改使用者</button>
        <button :class="{active: mode==='delete'}" @click="setMode('delete')">刪除使用者</button>
        <button :class="{active: mode==='test'}"   @click="setMode('test')">SAP 連線測試</button>
      </nav>

      <div v-if="mode!=='create'" class="search" @keyup.enter="search">
        <input v-model.trim="searchUserId" type="text" placeholder="帳號搜尋…" />
        <button class="search-btn" :disabled="loading" @click="search">搜尋</button>
      </div>

      <div class="card">
        <fieldset :disabled="mode==='test'" class="ro-when-test">
          <div class="form-grid">
            <label>使用者帳號：</label>
            <input v-model.trim="form.userid" :readonly="mode!=='create'" placeholder="輸入使用者帳號" />

            <label>使用者密碼：</label>
            <input v-model="form.password" type="text" placeholder="登入密碼" />

            <label>SAP 連線說明：</label>
            <input v-model="form.sapconn" placeholder="例如 PRD-ACME" />

            <label>SAP 主機 IP：</label>
            <input v-model="form.sapaddr" placeholder="例如 10.1.2.3 或 hostname" />

            <label>SAP 事例號碼：</label>
            <input v-model="form.sapins" maxlength="2" placeholder="例如 00" />

            <label>SAP 系統 ID：</label>
            <input v-model="form.sapid" maxlength="3" placeholder="例如 PRD（3 碼）" />

            <label>SAP Client：</label>
            <input v-model="form.sapclnt" maxlength="3" placeholder="例如 100（3 碼）" />

            <label>SAP Router：</label>
            <input v-model="form.saprouter" placeholder="/H/1.2.3.4/S/3299/W/pass...（可空）" />

            <label>SAP 連線帳號：</label>
            <input v-model="form.sapusr" placeholder="SAP Logon user" />

            <label>SAP 連線密碼：</label>
            <input v-model="form.sappw" type="text" placeholder="SAP Logon password" />
          </div>
        </fieldset>
      </div>

      <div class="actions">
        <template v-if="mode==='create'">
          <button class="primary" :disabled="loading" @click="onCreate">存檔</button>
          <button :disabled="loading" @click="resetForm">取消</button>
        </template>

        <template v-else-if="mode==='update'">
          <button class="primary" :disabled="loading" @click="onUpdate">存檔</button>
          <button :disabled="loading" @click="resetForm">取消</button>
        </template>

        <template v-else-if="mode==='delete'">
          <button class="danger"  :disabled="loading" @click="onDelete">刪除</button>
          <button :disabled="loading" @click="resetForm">取消</button>
        </template>

        <template v-else>
          <button
          class="btn btn-primary"
          :disabled="loading || !form?.userid && !form.userid"
          @click="runSapRead('PRDVERS')"
          >
          讀取 SAP Table [PRDVERS]
          </button>
          <button
            class="btn btn-primary"
            :disabled="loading || !form?.userid && !form.userid"
            @click="runSapRead('CVERS')"
          >
          讀取 SAP Table [CVERS]
          </button>
        </template>
      </div>
      <div v-if="rfcKeys.length" class="rfc-block" style="margin-top: 12px;">
        <div class="rfc-title">
          已讀取 {{ rfcTitle }}（{{ rfcRows.length }} 筆）
        </div>

        <div class="rfc-scroll">
         <table class="result-table rfc-table">
           <thead>
              <tr>
                <th v-for="(h, i) in rfcHdrs" :key="i">{{ h }}</th>
              </tr>
           </thead>
            <tbody>
              <tr v-for="(row, rIdx) in rfcRows" :key="rIdx">
                <td v-for="k in rfcKeys" :key="k">{{ row[k] ?? '—' }}</td>
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

/* 頂列 */
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

/* 分頁 */
.tabs{ display:flex; gap:8px; margin:6px 0 14px; flex-wrap:wrap; }
.tabs > button{
  border:1px solid rgba(255,255,255,.22);
  background:rgba(255,255,255,.04);
  color:#fff; padding:8px 12px; border-radius:10px; cursor:pointer;
}
.tabs > button.active{ background:#1f3b66; border-color:#7fb6ff; }

/* 搜尋 */
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

/* 表單卡片 */
.card{
  background: rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.18);
  border-radius:16px; padding:18px; backdrop-filter: blur(6px);
}
.form-grid{
  display:grid; grid-template-columns: 160px 1fr;
  gap:12px 14px;
}
.form-grid label{ align-self:center; color:#cdd7ea; }
.form-grid input{
  height:40px; border-radius:12px;
  border:1px solid rgba(255,255,255,.2);
  background:rgba(0,0,0,.2); color:#fff; padding:0 12px; outline:none;
}
.form-grid input:focus{
  border-color:#7dc8ff; box-shadow:0 0 0 3px rgba(125,200,255,.18);
}

/* 動作 */
.actions{ display:flex; gap:14px; margin-top:16px; flex-wrap:wrap; }
.actions button{
  height:44px; padding:0 18px; border-radius:12px; border:0; cursor:pointer; font-weight:700;
}
.primary{ background: linear-gradient(90deg,#2aa6ff,#6bc5ff); color:#0b1a2b; }
.secondary{ background:#184a7c; color:#e6eefc; border:1px solid rgba(255,255,255,.18); }
.danger{ background:#c94141; color:#fff; }
.toast{ margin-top:10px; color:#ffd9a8; }

/* 捲軸 */
.wrap::-webkit-scrollbar{ width:10px; }
.wrap::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.12); border-radius:8px; }

/* --- RFC 結果表格樣式，只影響 rfc-* 這些類別 --- */

.rfc-block { margin-top: 12px; }

.rfc-title {
  color: #9fb0c0;
  font-size: 14px;
  margin: 6px 2px 8px;
  font-weight: 600;
  letter-spacing: .3px;
}

.rfc-scroll {
  overflow: auto;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  background: rgba(255,255,255,0.03);
}

/* 表格本體：加分隔線、固定表頭、可水平捲動 */
.rfc-table {
  width: 100%;
  min-width: 720px;                /* 欄位多時避免擠在一起 */
  border-collapse: separate;
  border-spacing: 0;
  font-family: Arial, "Microsoft JhengHei", "Noto Sans TC", sans-serif;
}

.rfc-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(5, 10, 29, 0.95); /* 和你的深色主題一致 */
  backdrop-filter: blur(2px);
  text-align: left;
  font-weight: 600;
  padding: 10px 12px;
  white-space: nowrap;
  border-bottom: 1px solid rgba(255,255,255,0.18);
}

.rfc-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px dashed rgba(255,255,255,0.12); /* 列與列的分隔線 */
  vertical-align: top;
}

.rfc-table tbody tr:hover {
  background: rgba(255,255,255,0.05); /* hover 提示 */
}

.rfc-table tbody tr:last-child td {
  border-bottom: 0;
}
</style>