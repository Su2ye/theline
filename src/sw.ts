/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope
declare const __WB_MANIFEST: Array<{ url: string; revision: string | null }>

import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
clientsClaim()

const BASE = self.registration.scope

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload = event.data.json()
    event.waitUntil(
      self.registration.showNotification(payload.title || '这条线', {
        body: payload.body || '',
        icon: `${BASE}icon-192.png`,
        badge: `${BASE}icon-192.png`,
        tag: payload.tag || 'theline',
        requireInteraction: payload.requireInteraction ?? true,
        data: payload.data || {},
      })
    )
  } catch {
    event.waitUntil(
      self.registration.showNotification('这条线', {
        body: event.data.text(),
        icon: `${BASE}icon-192.png`,
        badge: `${BASE}icon-192.png`,
        requireInteraction: true,
      })
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); return }
      self.clients.openWindow(BASE)
    })
  )
})
