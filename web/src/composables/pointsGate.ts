// src/composables/pointsGate.ts
import { reactive } from 'vue'

export const pointsGateState = reactive({
  show: false,
})

export function openInsufficientPointsModal() {
  pointsGateState.show = true
}

export function closeInsufficientPointsModal() {
  pointsGateState.show = false
}

/** 查詢最新餘額，>0 才算足夠。查詢失敗時放行，避免網路問題把使用者鎖在外面。 */
export async function hasEnoughPoints(userid: string, apiBase: string): Promise<boolean> {
  try {
    const r = await fetch(`${apiBase}/api/users/${encodeURIComponent(userid)}/points`)
    if (!r.ok) return true
    const j = await r.json()
    const balance = typeof j.balance === 'number' ? j.balance : (j.points_balance ?? 0)
    return balance > 0
  } catch {
    return true
  }
}
