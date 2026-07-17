<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import nttLogo from '../assets/GlobalLogo_NTTDATA_White.png'
import homeIcon from '../assets/Icon_Home.png'
import { useRouter } from 'vue-router'
import { onMounted, ref } from 'vue'
import { startBilling, useAutoStopBilling } from '../composables/featureBilling'
import { useLeaveConfirm } from '../composables/useLeaveConfirm'

type Severity = 'high' | 'medium' | 'low'
type Finding = { severity: Severity; title: string; detail: string }
type Status = 'idle' | 'scanning' | 'done' | 'error'
type RawRow = Record<string, string>
type RawData = { PRDVERS: RawRow[]; CVERS: RawRow[] }

const PRDVERS_FIELDS = ['ID', 'NAME', 'VERSION', 'VENDOR', 'DESCRIPT', 'INSTSTATUS', 'MOD_DATE', 'MOD_TIME'] as const
const PRDVERS_HEADERS: Record<string, string> = {
  ID: '系統ID', NAME: 'SAP 產品名稱', VERSION: 'SAP 版本 1', VENDOR: 'SAP 版本 2',
  DESCRIPT: 'SAP PATCH 名稱', INSTSTATUS: '安裝狀態碼', MOD_DATE: '最後系統改日期', MOD_TIME: '最後系統改時',
}
const CVERS_FIELDS = ['COMPONENT', 'RELEASE', 'EXTRELEASE', 'COMP_TYPE'] as const
const CVERS_HEADERS: Record<string, string> = {
  COMPONENT: 'SAP 組件名稱', RELEASE: 'SAP 組件版次 1', EXTRELEASE: 'SAP 組件版次 2', COMP_TYPE: '組件類別',
}

/** 統一取得目前登入者 */
function getCurrentUser() {
  const raw = localStorage.getItem('aiadvisor_user')
  if (!raw) return null
  try { const obj = JSON.parse(raw); return obj?.user ?? obj ?? null } catch { return null }
}
const me = getCurrentUser()

const router = useRouter()
const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')
function backHome(){ router.replace('/user') }

/** 進入頁面 → 開始計時（滿 60 秒扣 1 點）；離開/卸載 → 自動停止 */
onMounted(() => {
  if (me?.userid) {
    startBilling({
      userid: me.userid,
      apiBase: API_BASE,
      label: 'SAP 資安漏洞檢測', // 記錄至 points_ledger.note
      // perMinute: 1,        // 如需不同權重，在此覆寫
    })
  }
})
useAutoStopBilling()

const status  = ref<Status>('idle')
const scanId  = ref<number | null>(null)
const summary = ref('')
const findings = ref<Finding[]>([])
const errorMsg  = ref('')
const exporting = ref(false)
const rawData   = ref<RawData | null>(null)
const showRaw   = ref(false)

/** 只在檢測進行中才警告離開——這時離開會讓已花費的 RFC/AI 成本白費且看不到結果 */
useLeaveConfirm(() => status.value === 'scanning')

const SEV_LABEL: Record<Severity, string> = { high: '高風險', medium: '中風險', low: '低風險' }

async function startScan() {
  if (!me?.userid) { errorMsg.value = '找不到登入者資訊'; status.value = 'error'; return }
  status.value = 'scanning'
  errorMsg.value = ''
  try {
    const r = await fetch(`${API_BASE}/api/users/${encodeURIComponent(me.userid)}/security-scan`, { method: 'POST' })
    if (!r.ok) throw new Error(await r.text())
    const data = await r.json()
    scanId.value = data.scan_id
    summary.value = data.summary || ''
    findings.value = Array.isArray(data.findings) ? data.findings : []
    rawData.value = data.raw_data ?? null
    status.value = 'done'
  } catch (e: any) {
    errorMsg.value = e?.message || '檢測失敗，請稍後再試'
    status.value = 'error'
  }
}

async function exportWord() {
  if (!me?.userid || !scanId.value) return
  exporting.value = true
  try {
    const r = await fetch(`${API_BASE}/api/users/${encodeURIComponent(me.userid)}/security-scan/${scanId.value}/export`)
    if (!r.ok) throw new Error(await r.text())
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `security_scan_${me.userid}_${scanId.value}.docx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    errorMsg.value = e?.message || '匯出失敗'
  } finally {
    exporting.value = false
  }
}

function resetScan() {
  status.value = 'idle'
  scanId.value = null
  summary.value = ''
  findings.value = []
  errorMsg.value = ''
  rawData.value = null
  showRaw.value = false
}
</script>

<template>
  <div class="page">
    <TopBar :user="me" />

    <section class="wrap">
      <div class="toprow">
        <img class="ntt" :src="nttLogo" alt="NTT DATA" />
        <button class="home" @click="backHome"><img :src="homeIcon" alt="" /> 返回主選單</button>
      </div>

      <h2 class="title">功能：SAP 資安漏洞檢測</h2>

      <div v-if="status==='idle'" class="card">
        <p>將讀取此帳號的 SAP 系統版本資訊（PRDVERS / CVERS），交由 AI 分析是否有已知資安疑慮。</p>
        <button class="primary" @click="startScan">開始檢測</button>
      </div>

      <div v-else-if="status==='scanning'" class="card scanning">
        <div class="spinner"></div>
        <p>讀取 SAP 系統資訊並交由 AI 分析中，請稍候…</p>
      </div>

      <div v-else-if="status==='error'" class="card">
        <p class="err">{{ errorMsg }}</p>
        <button class="secondary" @click="resetScan">重新檢測</button>
      </div>

      <div v-else-if="status==='done'" class="card">
        <div class="section-title">摘要</div>
        <p>{{ summary }}</p>

        <div class="section-title" style="margin-top:16px;">發現項目</div>
        <p v-if="findings.length===0" class="ok">未發現需留意的項目。</p>
        <div v-else class="findings">
          <div v-for="(f, i) in findings" :key="i" class="finding" :class="'sev-'+f.severity">
            <span class="badge">{{ SEV_LABEL[f.severity] ?? f.severity }}</span>
            <div>
              <div class="f-title">{{ f.title }}</div>
              <div class="f-detail">{{ f.detail }}</div>
            </div>
          </div>
        </div>

        <button v-if="rawData" class="raw-toggle" @click="showRaw = !showRaw">
          <span>查看原始資料（PRDVERS {{ rawData.PRDVERS.length }} 筆・CVERS {{ rawData.CVERS.length }} 筆）</span>
          <span class="chevron" :class="{ open: showRaw }">▾</span>
        </button>

        <div v-if="rawData && showRaw" class="raw-block">
          <div class="raw-title">PRDVERS（產品版本）</div>
          <div class="raw-scroll">
            <table class="raw-table">
              <thead>
                <tr><th v-for="k in PRDVERS_FIELDS" :key="k">{{ PRDVERS_HEADERS[k] }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in rawData.PRDVERS" :key="i">
                  <td v-for="k in PRDVERS_FIELDS" :key="k">{{ row[k] || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="raw-title" style="margin-top:14px;">CVERS（軟體元件版本）</div>
          <div class="raw-scroll">
            <table class="raw-table">
              <thead>
                <tr><th v-for="k in CVERS_FIELDS" :key="k">{{ CVERS_HEADERS[k] }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in rawData.CVERS" :key="i">
                  <td v-for="k in CVERS_FIELDS" :key="k">{{ row[k] || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="actions">
          <button class="secondary" :disabled="exporting" @click="exportWord">{{ exporting ? '匯出中…' : '匯出 Word' }}</button>
          <button class="ghost" @click="resetScan">重新檢測</button>
        </div>
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
.section-title{ color:#cfe2ff; font-size:14px; font-weight:700; margin-bottom:8px; }
.ok{ color:#8fe3b0; }
.err{ color:#ff9d9d; margin-bottom:12px; }

.primary{
  margin-top:12px;
  background: linear-gradient(90deg,#2aa6ff,#6bc5ff); color:#0b1a2b;
  border:0; border-radius:12px; padding:10px 20px; font-weight:700; cursor:pointer;
}
.secondary{
  background:#184a7c; color:#e6eefc; border:1px solid rgba(255,255,255,.18);
  border-radius:12px; padding:8px 16px; cursor:pointer;
}
.ghost{
  background:transparent; color:#8fb8e6; border:1px solid rgba(255,255,255,.22);
  border-radius:12px; padding:8px 16px; cursor:pointer;
}

.scanning{ display:flex; align-items:center; gap:14px; }
.spinner{
  width:22px; height:22px; border-radius:50%;
  border:3px solid rgba(255,255,255,.18); border-top-color:#6bc5ff;
  animation: spin 0.8s linear infinite; flex-shrink:0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.findings{ display:flex; flex-direction:column; gap:8px; }
.finding{
  display:flex; gap:10px; align-items:flex-start;
  border-left:3px solid; padding:8px 10px; border-radius:0;
}
.finding.sev-high{ border-color:#e2554f; background:rgba(226,85,79,.08); }
.finding.sev-medium{ border-color:#e0a63c; background:rgba(224,166,60,.08); }
.finding.sev-low{ border-color:#6bc5ff; background:rgba(107,197,255,.08); }
.badge{
  font-size:11px; padding:2px 8px; border-radius:10px; flex-shrink:0; font-weight:700;
}
.sev-high .badge{ background:#e2554f; color:#fff; }
.sev-medium .badge{ background:#e0a63c; color:#3a2a00; }
.sev-low .badge{ background:#6bc5ff; color:#0b1a2b; }
.f-title{ font-weight:700; color:#e6eefc; }
.f-detail{ font-size:13px; color:#cdd7ea; margin-top:2px; }

.actions{ display:flex; gap:10px; margin-top:16px; }

.raw-toggle{
  width:100%; display:flex; align-items:center; justify-content:space-between;
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.18);
  border-radius:12px; padding:10px 14px; color:#8fb8e6; font-size:13px;
  cursor:pointer; margin-top:16px;
}
.chevron{ transition: transform .15s ease; }
.chevron.open{ transform: rotate(180deg); }

.raw-block{ margin-top:12px; }
.raw-title{ color:#9fb0c0; font-size:12px; font-weight:600; margin:0 2px 6px; }
.raw-scroll{
  overflow:auto; max-height:220px;
  border:1px solid rgba(255,255,255,.12); border-radius:10px; background:rgba(255,255,255,.03);
}
.raw-table{ width:100%; min-width:480px; border-collapse:separate; border-spacing:0; font-size:12px; }
.raw-table thead th{
  position:sticky; top:0; background:rgba(5,10,29,.95);
  text-align:left; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,.18);
  color:#cfe2ff; white-space:nowrap;
}
.raw-table tbody td{
  padding:7px 10px; border-bottom:1px dashed rgba(255,255,255,.12); color:#e6eefc; white-space:nowrap;
}
.raw-table tbody tr:last-child td{ border-bottom:0; }
</style>
