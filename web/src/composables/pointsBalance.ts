// src/composables/pointsBalance.ts
import { reactive } from 'vue'

/**
 * 跨頁面共用的點數餘額狀態。TopBar 在每個頁面都會重新掛載一次，
 * 如果餘額存在各自的本地 state，會先用 localStorage 裡登入當下的舊值墊著，
 * 造成「扣完點換頁後數字先跳回舊的」這種回朔感。改成模組層級的共用狀態，
 * 一旦查到正確值就不會再被過時的初始值蓋掉。
 */
export const pointsBalanceState = reactive({
  balance: null as number | null,
  userid: '' as string,
})

export async function refreshPointsBalance(userid: string, apiBase: string) {
  if (!userid) return
  try {
    const r = await fetch(`${apiBase}/api/users/${encodeURIComponent(userid)}/points`)
    if (!r.ok) return
    const j = await r.json()
    const balance = typeof j.balance === 'number' ? j.balance : (j.points_balance ?? null)
    if (balance !== null) {
      pointsBalanceState.balance = balance
      pointsBalanceState.userid = userid
    }
  } catch {}
}
