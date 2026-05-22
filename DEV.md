# TheLine 开发文档

## 架构概览

应用运行在单个 HTML 页面上，有两个视图（主页和配对页），通过 React 状态切换，不使用路由库。所有数据存储在 IndexedDB 中，P2P 通信通过 WebRTC Data Channel。

## 信令流程（剪贴板方案）

```
小明（创建配对）                    小红（加入配对）
    │                                  │
    │ 1. 生成 offer JSON               │
    │ 2. 复制到剪贴板 ──→ 微信 ──→     │
    │                                  │ 3. 粘贴 offer
    │                                  │ 4. 生成 answer JSON
    │                                  │ 5. 复制到剪贴板
    │           ←── 微信 ←──           │
    │ 6. 粘贴 answer                   │
    │ 7. 连接建立 ✓                    │
    │                                  │
    │ ←── WebRTC Data Channel ──→      │
    │    （之后直接 P2P 通信）          │
```

## 数据模型

### 配对信息（pairInfo 表）

```ts
{
  peerId: string          // 对方唯一标识
  webRTCCredentials: string | null  // 重连凭证
  lastConnectedAt: number | null    // 上次连接时间
  pairCreatedAt: number            // 配对创建时间
}
```

### 见面标记（markers 表）

```ts
{
  id: string              // 时间戳生成
  createdAt: number
  lat: number             // 纬度
  lng: number             // 经度
  myNote: string          // 我的留言
  myPhoto: string | null  // 我的照片（base64）
  peerNote: string        // 对方的留言
  peerPhoto: string | null // 对方的照片（base64）
}
```

## 线段状态机

| 状态 | 条件 | 视觉效果 |
|---|---|---|
| normal | 上次见面 < 14 天 | 全色、全粗细、呼吸感 |
| warning | 14-30 天 | 变暗、抖动、变细 |
| critical | 30-60 天 | 很细、很暗 |
| disconnected | > 60 天或超过阈值 | 灰色、如发丝 |

重新联系后，从任意状态渐变回 normal。

## 线段动画实现

- 使用 Canvas 2D + requestAnimationFrame
- 贝塞尔曲线从左到右，用 80 段折线逼近
- 每段用 2D 噪声函数添加有机摆动
- 颜色：从配对日期哈希出基础色相，随时间缓慢偏移（0.3°/天）
- 粗细：最近 30 天见面次数越多越粗（1px - 8px）
- 端点发光的圆点

## GPS 见面检测逻辑

1. `navigator.geolocation.watchPosition()` 前台持续获取位置
2. 每 30 秒取双方最新坐标
3. 用半正矢公式计算距离
4. 距离 < 50 米且持续 > 15 分钟 → 自动生成见面标记
5. 通过 Data Channel 同步给对方

## 照片模糊解锁机制

- A 上传照片 → B 看到模糊版本（CSS blur + scale）
- B 上传照片 → 双方都看到清晰版本
- 只有双方都上传后，照片才对两人完全可见
- 存储为 base64，通过 Data Channel 同步

## 关键设计决策

1. **不用路由库** — 只有两个视图，React 状态切换足够
2. **不用 react-leaflet** — 直接调用 Leaflet API，更轻量
3. **不用复杂状态管理** — 组件本地 state + useMemo 足够
4. **照片用 base64** — 避免需要服务器存储，但会增大 IndexedDB 占用
5. **剪贴板信令** — 配对只需做一次，不需要信令服务器

## 后台运行限制

PWA 与原生 App 的一个根本差异：

| 场景 | 行为 |
|---|---|
| 页面在前台 | GPS、WebRTC、动画全部正常运行 |
| 页面切到后台（iOS Safari） | 几秒后 JS 暂停，GPS 停止，WebRTC 断开 |
| 页面切到后台（Android Chrome） | 定时器被严重节流（~1次/分钟），GPS 不可靠 |
| PWA 添加到主屏幕后切后台 | 同上，PWA 不获得原生后台权限 |

### 实际影响

- **见面检测**：只在页面前台运行时有效。两人见面时打开页面即可触发检测，不需要提前开着
- **线段状态**：基于已保存的见面标记计算，可以在没有网络时独立查看
- **数据同步**：需要双方同时在线。离线期间的变更会在下次双方同时在线时同步

### 如果未来需要后台运行

可行的路径：
1. **转变为原生 App**（React Native / Capacitor）— 获得后台 GPS 权限
2. **添加推送服务器**（最小后端）— 已实现，见下方
3. **Web Periodic Background Sync** — 实验性 API，iOS 不支持
4. **接受现状** — 见面时打开，日常看线不需要后台

## 推送服务器

### 架构

```
A 点「提醒对方」 → 客户端 POST /api/notify → 推送服务器 → Web Push → B 的手机通知 → B 点通知 → 打开页面
```

- **服务器** — Express + web-push，部署在 `server/` 目录
- **客户端** — `src/services/notify.ts`，管理订阅和触发推送
- **Service Worker** — `src/sw.ts`，处理 push 事件和通知点击
- **数据仍然走 WebRTC P2P** — 服务器只转发一条通知，不接触任何用户数据

### 服务器接口

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | /api/key | 返回 VAPID 公钥（客户端订阅需要） |
| POST | /api/subscribe | 客户端上传 push subscription，key 为 myPeerId |
| POST | /api/notify | 向指定 peerId 发送推送通知 |
| POST | /api/unsubscribe | 删除订阅 |
| GET | /api/health | 健康检查，返回当前订阅数 |

### 部署

```bash
cd server
npm install
npm run dev     # 本地运行（端口 3001）

# 部署到 Vercel/Railway/Render 等免费平台
# 环境变量：
#   VAPID_PUBLIC_KEY  - VAPID 公钥
#   VAPID_PRIVATE_KEY - VAPID 私钥
#   VAPID_EMAIL       - 联系邮箱
#   PORT              - 端口（平台自动设置）
#   DATA_FILE         - 订阅数据文件路径（需持久化存储）
```

### 客户端配置

在项目根目录 `.env` 文件中设置服务器地址：

```
VITE_PUSH_SERVER=https://your-push-server.com
```

### 数据存储

服务器仅存储浏览器推送订阅信息（PushSubscription JSON），不存储任何用户内容。每条记录格式：

```json
{
  "peerId-abc123": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": { "p256dh": "...", "auth": "..." }
  }
}
```

存储在 `subscriptions.json` 文件中。对于生产环境，建议换用 SQLite 或 Redis。
