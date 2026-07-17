// src/composables/featureBilling.ts
import { reactive, computed, onBeforeUnmount } from 'vue'
import { openInsufficientPointsModal } from './pointsGate'
import { refreshPointsBalance } from './pointsBalance'

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
        if (resp.ok) {
          // 扣點成功後即時刷新共用的全域餘額狀態，TopBar 不管掛在哪個頁面都會同步
          await refreshPointsBalance(featureBillingState.userid, featureBillingState.apiBase)
        } else if (resp.status === 402) {
          // 點數不足：不要繼續空轉重試，直接停止計時並提示使用者
          stopBilling()
          openInsufficientPointsModal()
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
