// src/composables/useLeaveConfirm.ts
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

export function useLeaveConfirm(defaultOn = true, msg = '離開此頁可能造成操作中斷或資料未保存。確定要離開嗎？') {
  const enabled = ref(!!defaultOn)

  function beforeUnload(e: BeforeUnloadEvent) {
    if (!enabled.value) return
    e.preventDefault()
    e.returnValue = '' // 讓瀏覽器顯示自帶提示
  }

  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

  onBeforeRouteLeave((_to, _from, next) => {
    if (!enabled.value) return next()
    const ok = window.confirm(msg)
    next(ok ? true : false)
  })

  return { enabled } // 可在頁面中切換 enabled.value = false 來暫時關閉
}