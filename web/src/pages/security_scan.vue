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

/** 功能頁：掛上全域離開提醒 */
useLeaveConfirm()

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
</style>
