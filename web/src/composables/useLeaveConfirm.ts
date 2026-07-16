// src/composables/useLeaveConfirm.ts
import { onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

/**
 * 只在「離開當下真的會造成損失」時才警告：
 * - 有非同步作業正在跑（例如檢測進行中）
 * - 有未存檔的表單異動
 * 由呼叫端傳入 shouldWarn()，回傳當下是否該警告；預設一律警告（相容舊行為）。
 */
export function useLeaveConfirm(
  shouldWarn: () => boolean = () => true,
  msg = '離開此頁可能造成操作中斷或資料未保存。確定要離開嗎？'
) {
  function beforeUnload(e: BeforeUnloadEvent) {
    if (!shouldWarn()) return
    e.preventDefault()
    e.returnValue = '' // 讓瀏覽器顯示自帶提示
  }

  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

  onBeforeRouteLeave((_to, _from, next) => {
    if (!shouldWarn()) return next()
    const ok = window.confirm(msg)
    next(ok ? true : false)
  })
}
