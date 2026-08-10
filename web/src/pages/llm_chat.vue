<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import nttLogo from '../assets/GlobalLogo_NTTDATA_White.png'
import homeIcon from '../assets/Icon_Home.png'
import { useRouter } from 'vue-router'
import { nextTick, onMounted, ref } from 'vue'
import { startBilling, useAutoStopBilling } from '../composables/featureBilling'
import { useLeaveConfirm } from '../composables/useLeaveConfirm'

type Role = 'user' | 'assistant'
type Msg = { role: Role; content: string }

function getCurrentUser() {
  const raw = localStorage.getItem('aiadvisor_user')
  if (!raw) return null
  try { const obj = JSON.parse(raw); return obj?.user ?? obj ?? null } catch { return null }
}
const me = getCurrentUser()

const router = useRouter()
const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')
function backHome(){ router.replace('/user') }

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

const messages = ref<Msg[]>([])
const input = ref('')
const sending = ref(false)
const errorMsg = ref('')
const scrollBox = ref<HTMLElement | null>(null)

/** 對話中有內容才警告離開——避免問到一半白白流失 */
useLeaveConfirm(() => messages.value.length > 0)

async function scrollToBottom() {
  await nextTick()
  if (scrollBox.value) scrollBox.value.scrollTop = scrollBox.value.scrollHeight
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value || !me?.userid) return

  messages.value.push({ role: 'user', content: text })
  messages.value.push({ role: 'assistant', content: '' })
  input.value = ''
  sending.value = true
  errorMsg.value = ''
  scrollToBottom()

  try {
    const resp = await fetch(`${API_BASE}/api/users/${encodeURIComponent(me.userid)}/llm-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      }),
    })
    if (!resp.ok || !resp.body) throw new Error(await resp.text())

    const reader = resp.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let rawAll = ''
    let sawSSE = false
    let gotContent = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunkText = decoder.decode(value, { stream: true })
      rawAll += chunkText
      buffer += chunkText

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        sawSSE = true
        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue
        try {
          const json = JSON.parse(dataStr)
          if (json.error) { errorMsg.value = typeof json.error === 'string' ? json.error : JSON.stringify(json.error); continue }
          const delta = json?.choices?.[0]?.delta?.content
          if (delta) {
            messages.value[messages.value.length - 1].content += delta
            gotContent = true
            scrollToBottom()
          }
        } catch { /* 忽略無法解析的心跳/雜訊行 */ }
      }
    }

    // Open WebUI 這個模型的 pipeline 有時不會真的逐字串流，而是直接回一整包完整 JSON（非 SSE）
    if (!sawSSE && !gotContent) {
      try {
        const whole = JSON.parse(rawAll)
        const content = whole?.choices?.[0]?.message?.content
        if (content) {
          messages.value[messages.value.length - 1].content = content
        } else if (whole?.error) {
          errorMsg.value = typeof whole.error === 'string' ? whole.error : JSON.stringify(whole.error)
        }
      } catch { /* 不是合法 JSON 也不是 SSE，放棄解析 */ }
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '對話失敗，請稍後再試'
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

/** 把答案文字裡的 [1][2] 引用標記切成獨立片段，畫面上改用小標籤呈現 */
type Segment = { text: string; cite?: string }
function splitContent(content: string): Segment[] {
  const parts: Segment[] = []
  const re = /\[(\d{1,2})\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    if (m.index > last) parts.push({ text: content.slice(last, m.index) })
    parts.push({ text: '', cite: m[1] })
    last = m.index + m[0].length
  }
  if (last < content.length) parts.push({ text: content.slice(last) })
  return parts
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

      <h2 class="title">功能：AI Advisor 對話</h2>

      <div class="chat-card">
        <div class="messages" ref="scrollBox">
          <p v-if="messages.length===0" class="hint">直接輸入問題，AI 會依據 SAP 知識庫回答。</p>
          <div v-for="(m, i) in messages" :key="i" class="bubble-row" :class="m.role">
            <div class="bubble">
              <template v-if="m.content">
                <template v-for="(seg, si) in splitContent(m.content)" :key="si">
                  <span v-if="seg.cite" class="cite-badge" :title="'引用來源 ' + seg.cite">{{ seg.cite }}</span>
                  <template v-else>{{ seg.text }}</template>
                </template>
              </template>
              <template v-else-if="sending && i===messages.length-1">思考中…</template>
            </div>
          </div>
        </div>

        <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

        <div class="input-row">
          <textarea
            v-model="input"
            class="input"
            rows="2"
            placeholder="輸入問題，Enter 送出，Shift+Enter 換行"
            :disabled="sending"
            @keydown="onKeydown"
          ></textarea>
          <button class="primary" :disabled="sending || !input.trim()" @click="send">送出</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page{ position:fixed; inset:0; background:#050a1d; }
.wrap{
  position:absolute; top:46px; left:0; right:0; bottom:0;
  padding:24px; color:#e6eefc;
  font-family: Arial, "Microsoft JhengHei", "微軟正黑體", sans-serif;
  display:flex; flex-direction:column;
}
.toprow{ display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
.ntt{ height:42px; opacity:.95; user-select:none; }
.home{
  display:flex; align-items:center; gap:8px;
  border:1px solid rgba(255,255,255,.22);
  background:transparent; color:#fff;
  padding:8px 12px; border-radius:10px; cursor:pointer;
}
.home img{ width:20px; height:20px; object-fit:contain; }
.title{ margin:16px 0 10px; font-size:18px; font-weight:700; color:#cfe2ff; flex-shrink:0; }

.chat-card{
  flex:1; min-height:0;
  background: rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.18);
  border-radius:16px; padding:18px; backdrop-filter: blur(6px);
  display:flex; flex-direction:column; gap:12px;
}

.messages{
  flex:1; min-height:0; overflow-y:auto;
  display:flex; flex-direction:column; gap:10px;
  padding-right:4px;
}
.hint{ color:#8fb8e6; font-size:14px; }

.bubble-row{ display:flex; }
.bubble-row.user{ justify-content:flex-end; }
.bubble-row.assistant{ justify-content:flex-start; }
.bubble{
  max-width:72%; padding:10px 14px; border-radius:14px;
  white-space:pre-wrap; word-break:break-word; line-height:1.5; font-size:14px;
}
.bubble-row.user .bubble{ background: linear-gradient(90deg,#2aa6ff,#6bc5ff); color:#0b1a2b; border-bottom-right-radius:4px; }
.bubble-row.assistant .bubble{ background: rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14); border-bottom-left-radius:4px; }

.cite-badge{
  display:inline-flex; align-items:center; justify-content:center;
  min-width:15px; height:15px; padding:0 3px;
  background: rgba(107,197,255,.25); border:1px solid rgba(107,197,255,.5);
  border-radius:8px; font-size:10px; font-weight:700; color:#bfe4ff;
  vertical-align:middle; margin:0 1px; cursor:default;
}

.err{ color:#ff9d9d; font-size:13px; margin:0; }

.input-row{ display:flex; gap:10px; flex-shrink:0; }
.input{
  flex:1; resize:none;
  background: rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.22);
  border-radius:12px; padding:10px 12px; color:#e6eefc; font-size:14px;
  font-family: inherit;
}
.input:focus{ outline:none; border-color:#6bc5ff; }
.primary{
  background: linear-gradient(90deg,#2aa6ff,#6bc5ff); color:#0b1a2b;
  border:0; border-radius:12px; padding:0 22px; font-weight:700; cursor:pointer;
}
.primary:disabled{ opacity:.5; cursor:not-allowed; }
</style>
