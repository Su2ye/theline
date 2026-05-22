import express from 'express'
import cors from 'cors'
import webpush from 'web-push'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const PORT = process.env.PORT || 3001
const DATA_FILE = process.env.DATA_FILE || './subscriptions.json'

// ============================================================
// VAPID 密钥管理（首次自动生成，后续从环境变量读取）
// ============================================================

function loadOrGenerateVapidKeys() {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY

  if (pub && priv) return { publicKey: pub, privateKey: priv }

  // 尝试从文件读取
  if (existsSync('./vapid.json')) {
    return JSON.parse(readFileSync('./vapid.json', 'utf-8'))
  }

  // 首次运行，自动生成
  const keys = webpush.generateVAPIDKeys()
  writeFileSync('./vapid.json', JSON.stringify(keys, null, 2))
  console.log('>>> 首次运行，已生成 VAPID 密钥并保存到 vapid.json')
  console.log('>>> 请将以下内容添加到 .env 文件以保持密钥稳定：')
  console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
  return keys
}

const vapidKeys = loadOrGenerateVapidKeys()
const vapidEmail = process.env.VAPID_EMAIL || 'theline@example.com'

webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidKeys.publicKey, vapidKeys.privateKey)

// ============================================================
// 数据持久化（简单 JSON 文件，单机部署够用）
// ============================================================

function loadSubscriptions() {
  if (!existsSync(DATA_FILE)) return {}
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveSubscriptions(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

// ============================================================
// Express 服务器
// ============================================================

const app = express()
app.use(cors())
app.use(express.json())

// 获取公钥（客户端订阅时需要）
app.get('/api/key', (_req, res) => {
  res.json({ publicKey: vapidKeys.publicKey })
})

// 健康检查
app.get('/api/health', (_req, res) => {
  const subs = loadSubscriptions()
  res.json({ ok: true, peers: Object.keys(subs).length })
})

// 订阅：配对后客户端调用，存储 push subscription
app.post('/api/subscribe', (req, res) => {
  const { myPeerId, subscription } = req.body
  if (!myPeerId || !subscription) {
    return res.status(400).json({ error: '缺少 myPeerId 或 subscription' })
  }

  const subs = loadSubscriptions()
  subs[myPeerId] = subscription
  saveSubscriptions(subs)

  console.log(`订阅: ${myPeerId}`)
  res.json({ ok: true })
})

// 提醒：一方点击按钮后，服务器推送给另一方
app.post('/api/notify', (req, res) => {
  const { peerId } = req.body
  if (!peerId) {
    return res.status(400).json({ error: '缺少 peerId' })
  }

  const subs = loadSubscriptions()
  const sub = subs[peerId]

  if (!sub) {
    return res.status(404).json({ error: '对方尚未订阅推送' })
  }

  webpush.sendNotification(sub, JSON.stringify({
    title: '这条线',
    body: '对方在想你，打开页面看看吧',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'theline-nudge',
    requireInteraction: true,
    data: { url: '/' },
  })).then(() => {
    console.log(`推送已发送: ${peerId}`)
    res.json({ ok: true })
  }).catch(err => {
    console.error('推送失败:', err.statusCode, err.body)
    // 如果订阅过期，删除它
    if (err.statusCode === 410 || err.statusCode === 404) {
      delete subs[peerId]
      saveSubscriptions(subs)
    }
    res.status(500).json({ error: '推送发送失败' })
  })
})

// 取消订阅
app.post('/api/unsubscribe', (req, res) => {
  const { myPeerId } = req.body
  const subs = loadSubscriptions()
  delete subs[myPeerId]
  saveSubscriptions(subs)
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`TheLine 推送服务器已启动，端口 ${PORT}`)
  console.log(`VAPID 公钥: ${vapidKeys.publicKey.slice(0, 20)}...`)
})
