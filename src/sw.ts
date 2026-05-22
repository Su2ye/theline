// ============================================================
// TheLine 自定义 Service Worker
// 处理：推送通知 + 通知点击 + 资源预缓存
// ============================================================

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope

// workbox 预缓存（由 vite-plugin-pwa 注入）
declare const __WB_MANIFEST: Array<{ url: string; revision: string | null }>

import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
clientsClaim()

// ============================================================
// 推送事件
// ============================================================

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload = event.data.json()
    event.waitUntil(
      self.registration.showNotification(payload.title || '这条线', {
        body: payload.body || '',
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-192.png',
        tag: payload.tag || 'theline',
        requireInteraction: payload.requireInteraction ?? true,
        data: payload.data || {},
      })
    )
  } catch {
    // 纯文本通知
    event.waitUntil(
      self.registration.showNotification('这条线', {
        body: event.data.text(),
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        requireInteraction: true,
      })
    )
  }
})

// ============================================================
// 通知点击 → 打开主页面
// ============================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // 如果已有打开的窗口，聚焦它
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        return
      }
      // 否则打开新窗口
      self.clients.openWindow(self.location.origin)
    })
  )
})
