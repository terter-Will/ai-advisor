// src/composables/featureBilling.ts
import { reactive, computed, onBeforeUnmount } from 'vue'

const DEFAULT_PER_MINUTE = 1

type StartOptions = {
  userid: string
  apiBase: string
  label?: string
  perMinute?: number
}

export const featureBillingState = reactive({
  running: false,
  seconds: 0,
  perMinute: DEFAULT_PER_MINUTE,
  label: '',
  userid: '',
  apiBase: '',
  _timer: null as number | null,
})

export const formattedTime = computed(() => {
  const s = featureBillingState.seconds
  const mm = Math.floor(s / 60).toString().padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
})

/** 扣點後主動刷新餘額並廣播給整個 App（TopBar 會聽這個事件） */
async function _refreshAndBroadcastBalance() {
  try {
    const r = await fetch(
      `${featureBillingState.apiBase}/api/users/${encodeURIComponent(featureBillingState.userid)}/points`
    )
    if (!r.ok) return
    const j = await r.json() // 內含 balance / updated_at / points_balance 等欄位 :contentReference[oaicite:1]{index=1}
    window.dispatchEvent(new CustomEvent('points:updated', { detail: j }))
  } catch {}
}

export function startBilling(opts: StartOptions) {
  if (featureBillingState.running) return
  featureBillingState.running  = true
  featureBillingState.seconds  = 0
  featureBillingState.userid   = opts.userid
  featureBillingState.apiBase  = opts.apiBase
  featureBillingState.label    = opts.label ?? '功能使用計時扣點'
  featureBillingState.perMinute = opts.perMinute ?? DEFAULT_PER_MINUTE

  featureBillingState._timer = window.setInterval(async () => {
    featureBillingState.seconds += 1
    if (featureBillingState.seconds % 60 === 0) {
      try {
        const resp = await fetch(
          `${featureBillingState.apiBase}/api/users/${encodeURIComponent(featureBillingState.userid)}/points/adjust`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'DEBIT',
              amount: featureBillingState.perMinute,
              note: `${featureBillingState.label}（自動每分鐘扣點）`,
            }),
          }
        )
        // 後端會更新餘額並回傳最新 points_balance（或用上面的 /points 再查一次）。:contentReference[oaicite:2]{index=2}
        if (resp.ok) {
          await _refreshAndBroadcastBalance() // ← 扣點成功後即時刷新餘額並廣播
        }
      } catch (e) {
        console.warn('auto debit failed', e)
      }
    }
  }, 1000)
}

export function stopBilling() {
  if (featureBillingState._timer) {
    clearInterval(featureBillingState._timer)
    featureBillingState._timer = null
  }
  featureBillingState.running = false
  featureBillingState.seconds = 0
  featureBillingState.userid  = ''
  featureBillingState.label   = ''
}

export function useAutoStopBilling() {
  onBeforeUnmount(stopBilling)
}
