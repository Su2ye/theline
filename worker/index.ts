import { Hono } from 'hono'
import { cors } from 'hono/cors'
import webpush from 'web-push'

interface Env {
  SUBSCRIPTIONS: KVNamespace
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_EMAIL: string
}

const app = new Hono()
app.use('/*', cors())

// GET /api/key
app.get('/api/key', (c) => {
  const pubKey = (c.env as Env).VAPID_PUBLIC_KEY
  if (!pubKey) return c.json({ error: 'VAPID 公钥未配置' }, 500)
  return c.json({ publicKey: pubKey })
})

// GET /api/health
app.get('/api/health', async (c) => {
  const keys = await (c.env as Env).SUBSCRIPTIONS.list()
  return c.json({ ok: true, peers: keys.keys.length })
})

// POST /api/subscribe
app.post('/api/subscribe', async (c) => {
  const { myPeerId, subscription } = await c.req.json()
  if (!myPeerId || !subscription) {
    return c.json({ error: '缺少 myPeerId 或 subscription' }, 400)
  }
  await (c.env as Env).SUBSCRIPTIONS.put(myPeerId, JSON.stringify(subscription))
  return c.json({ ok: true })
})

// POST /api/notify
app.post('/api/notify', async (c) => {
  const { peerId } = await c.req.json()
  if (!peerId) return c.json({ error: '缺少 peerId' }, 400)

  const env = c.env as Env
  const raw = await env.SUBSCRIPTIONS.get(peerId)
  if (!raw) return c.json({ error: '对方尚未订阅推送' }, 404)

  const subscription = JSON.parse(raw)

  webpush.setVapidDetails(
    `mailto:${env.VAPID_EMAIL || 'theline@example.com'}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  )

  try {
    await webpush.sendNotification(subscription, JSON.stringify({
      title: '这条线',
      body: '对方在想你，打开页面看看吧',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'theline-nudge',
      requireInteraction: true,
      data: { url: '/' },
    }))
    return c.json({ ok: true })
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await env.SUBSCRIPTIONS.delete(peerId)
    }
    return c.json({ error: '推送发送失败' }, 500)
  }
})

// POST /api/unsubscribe
app.post('/api/unsubscribe', async (c) => {
  const { myPeerId } = await c.req.json()
  await (c.env as Env).SUBSCRIPTIONS.delete(myPeerId)
  return c.json({ ok: true })
})

// ============================================================
// 信令中继（自动重连用）
// ============================================================

// POST /api/signal — 发送信令消息给指定 peer
app.post('/api/signal', async (c) => {
  const { to, kind, sdp } = await c.req.json()
  if (!to || !kind || !sdp) {
    return c.json({ error: '缺少参数' }, 400)
  }
  const env = c.env as Env
  await env.SUBSCRIPTIONS.put(`signal:${to}`, JSON.stringify({ kind, sdp }), { expirationTtl: 60 })
  return c.json({ ok: true })
})

// GET /api/signal/:peerId — 拉取给自己的信令消息
app.get('/api/signal/:peerId', async (c) => {
  const peerId = c.req.param('peerId')
  const env = c.env as Env
  const raw = await env.SUBSCRIPTIONS.get(`signal:${peerId}`)
  if (!raw) return c.json(null)
  await env.SUBSCRIPTIONS.delete(`signal:${peerId}`)
  return c.json(JSON.parse(raw))
})

export default app
