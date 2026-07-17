// src/composables/versionCheck.ts
import { reactive } from 'vue'

export const versionCheckState = reactive({
  newVersionAvailable: false,
})

let bootstrapHtml: string | null = null
let started = false

async function checkVersion() {
  try {
    const r = await fetch('/index.html', { cache: 'no-store' })
    if (!r.ok) return
    const html = await r.text()
    if (bootstrapHtml === null) {
      bootstrapHtml = html
      return
    }
    if (html !== bootstrapHtml) {
      versionCheckState.newVersionAvailable = true
    }
  } catch {}
}

/** 定期 + 分頁重新變成可見時檢查有沒有新版本部署上去 */
export function startVersionCheck(intervalMs = 5 * 60 * 1000) {
  if (started) return
  started = true
  checkVersion()
  window.setInterval(checkVersion, intervalMs)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkVersion()
  })
}

export function reloadForNewVersion() {
  window.location.reload()
}
