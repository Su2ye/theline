// ============================================================
// 推送通知客户端服务
// 依赖：部署的推送服务器 URL（环境变量 VITE_PUSH_SERVER）
// ============================================================

const SERVER = import.meta.env.VITE_PUSH_SERVER || ''

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i)
  }
  return arr
}

// 获取服务器的 VAPID 公钥并订阅浏览器 push
export async function subscribeToPush(myPeerId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !SERVER) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    if (!registration) return false

    const { publicKey } = await fetch(`${SERVER}/api/key`).then(r => r.json())
    if (!publicKey) return false

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    await fetch(`${SERVER}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        myPeerId,
        subscription: subscription.toJSON(),
      }),
    })

    return true
  } catch (err) {
    console.warn('推送订阅失败:', err)
    return false
  }
}

// 提醒对方打开页面
export async function nudgePeer(peerId: string): Promise<boolean> {
  if (!SERVER) return false

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${SERVER}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peerId }),
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// 取消订阅
export async function unsubscribePush(myPeerId: string): Promise<void> {
  if (!SERVER) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe()
  }

  try {
    await fetch(`${SERVER}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myPeerId }),
    })
  } catch { /* ignore */ }
}
