import { db } from '../db'

const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 2,
}

interface SignalMessage {
  v: 1
  kind: 'offer' | 'answer'
  sdp: string
  peerId: string
}

type MessageHandler = (msg: unknown) => void
type ConnectionHandler = (connected: boolean) => void

class WebRTCService {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private peerId = ''
  private otherPeerId = ''
  private handlers: MessageHandler[] = []
  private connHandlers: ConnectionHandler[] = []

  private generatePeerId(): string {
    return 'peer-' + crypto.randomUUID().slice(0, 8)
  }

  private encodeSignal(kind: 'offer' | 'answer', sdp: string): string {
    return JSON.stringify({
      v: 1,
      kind,
      sdp,
      peerId: this.peerId,
    } satisfies SignalMessage)
  }

  private decodeSignal(text: string): SignalMessage | null {
    try {
      const msg = JSON.parse(text)
      if (msg.v === 1 && (msg.kind === 'offer' || msg.kind === 'answer') && msg.sdp && msg.peerId) {
        return msg
      }
      return null
    } catch {
      return null
    }
  }

  private get localSDP(): string {
    return JSON.stringify(this.pc!.localDescription!.toJSON())
  }

  private waitForICE(): Promise<void> {
    return new Promise<void>(resolve => {
      const pc = this.pc!
      if (pc.iceGatheringState === 'complete') { resolve(); return }
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') resolve()
      }
      // 超时 8 秒，确保大部分 candidate 已收集
      setTimeout(resolve, 8000)
    })
  }

  async createOffer(): Promise<string> {
    this.peerId = this.generatePeerId()
    this.initPC(true)

    const offer = await this.pc!.createOffer()
    await this.pc!.setLocalDescription(offer)
    await this.waitForICE()

    return this.encodeSignal('offer', this.localSDP)
  }

  async acceptOffer(signalText: string): Promise<string> {
    const msg = this.decodeSignal(signalText)
    if (!msg || msg.kind !== 'offer') throw new Error('无效的配对码')

    this.peerId = this.generatePeerId()
    this.otherPeerId = msg.peerId
    this.initPC(false)

    const offerDesc = new RTCSessionDescription(JSON.parse(msg.sdp))
    await this.pc!.setRemoteDescription(offerDesc)

    const answer = await this.pc!.createAnswer()
    await this.pc!.setLocalDescription(answer)
    await this.waitForICE()

    return this.encodeSignal('answer', this.localSDP)
  }

  async completePairing(signalText: string): Promise<void> {
    const msg = this.decodeSignal(signalText)
    if (!msg || msg.kind !== 'answer') throw new Error('无效的回复码')

    this.otherPeerId = msg.peerId
    const answerDesc = new RTCSessionDescription(JSON.parse(msg.sdp))
    await this.pc!.setRemoteDescription(answerDesc)
  }

  private keepAliveTimer: ReturnType<typeof setInterval> | null = null

  private initPC(isOfferer: boolean) {
    this.pc?.close()
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null }
    this.pc = new RTCPeerConnection(PEER_CONFIG)

    this.pc.onicecandidate = (e) => { void e }

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState
      if (state === 'disconnected' || state === 'failed') {
        this.connHandlers.forEach(h => h(false))
      }
    }

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState
      if (state === 'connected') {
        this.connHandlers.forEach(h => h(true))
        this.startKeepAlive()
      }
      if (state === 'disconnected' || state === 'failed') {
        this.connHandlers.forEach(h => h(false))
        if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null }
      }
    }

    this.pc.ondatachannel = (e) => {
      this.dc = e.channel
      this.setupDataChannel()
    }

    if (isOfferer) {
      this.dc = this.pc.createDataChannel('theline')
      this.setupDataChannel()
    }
  }

  private startKeepAlive() {
    if (this.keepAliveTimer) return
    this.keepAliveTimer = setInterval(() => {
      if (this.dc?.readyState === 'open') {
        this.dc.send(JSON.stringify({ type: 'ping' }))
      } else {
        if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null }
      }
    }, 15000)
  }

  private setupDataChannel() {
    if (!this.dc) return

    this.dc.onopen = async () => {
      const existing = await db.pairInfo.get(this.otherPeerId)
      await db.pairInfo.put({
        peerId: this.otherPeerId,
        myPeerId: this.peerId,
        webRTCCredentials: JSON.stringify({
          localDesc: this.pc!.localDescription?.toJSON(),
          remoteDesc: this.pc!.remoteDescription?.toJSON(),
        }),
        lastConnectedAt: Date.now(),
        pairCreatedAt: existing?.pairCreatedAt ?? Date.now(),
      })
      this.connHandlers.forEach(h => h(true))
    }

    this.dc.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        this.handlers.forEach(h => h(data))
      } catch { /* ignore */ }
    }

    this.dc.onclose = () => {
      this.connHandlers.forEach(h => h(false))
    }
  }

  waitForConnection(): Promise<void> {
    if (this.dc?.readyState === 'open') return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('连接超时'))
      }, 30000)
      const cleanup = this.onConnectionChange((connected) => {
        if (connected) { clearTimeout(timeout); cleanup(); resolve() }
      })
    })
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler)
    return () => { this.handlers = this.handlers.filter(h => h !== handler) }
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connHandlers.push(handler)
    return () => { this.connHandlers = this.connHandlers.filter(h => h !== handler) }
  }

  send(data: unknown) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(data))
    }
  }

  getPeerId(): string { return this.peerId }
  getOtherPeerId(): string { return this.otherPeerId }
  setPeerIds(me: string, other: string) { this.peerId = me; this.otherPeerId = other }

  private get signalURL(): string {
    const base = typeof window !== 'undefined' ? (import.meta as any)?.env?.VITE_PUSH_SERVER || '' : ''
    return base
  }

  async sendSignal(to: string, kind: 'offer' | 'answer', sdp: string): Promise<void> {
    if (!this.signalURL) throw new Error('信令服务器未配置')
    await fetch(`${this.signalURL}/api/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, kind, sdp }),
    })
  }

  async pollSignal(forPeerId: string): Promise<{ kind: 'offer' | 'answer'; sdp: string } | null> {
    if (!this.signalURL) return null
    try {
      const res = await fetch(`${this.signalURL}/api/signal/${forPeerId}`)
      const data = await res.json()
      return data
    } catch {
      return null
    }
  }

  async reconnectAsOfferer(): Promise<boolean> {
    if (!this.otherPeerId) return false
    try {
      this.peerId = this.generatePeerId()
      this.initPC(true)
      const offer = await this.pc!.createOffer()
      await this.pc!.setLocalDescription(offer)
      await this.waitForICE()
      await this.sendSignal(this.otherPeerId, 'offer', this.localSDP)

      // 轮询等 answer
      for (let i = 0; i < 30; i++) {
        const msg = await this.pollSignal(this.peerId)
        if (msg?.kind === 'answer') {
          const desc = new RTCSessionDescription(JSON.parse(msg.sdp))
          await this.pc!.setRemoteDescription(desc)
          return true
        }
        await new Promise(r => setTimeout(r, 2000))
      }
      return false
    } catch {
      return false
    }
  }

  async reconnectAsAnswerer(): Promise<boolean> {
    if (!this.otherPeerId) return false
    try {
      // 等待对方的 offer
      const msg = await this.pollSignal(this.peerId)
      if (!msg || msg.kind !== 'offer') return false

      this.peerId = this.generatePeerId()
      this.initPC(false)
      const offerDesc = new RTCSessionDescription(JSON.parse(msg.sdp))
      await this.pc!.setRemoteDescription(offerDesc)
      const answer = await this.pc!.createAnswer()
      await this.pc!.setLocalDescription(answer)
      await this.waitForICE()
      await this.sendSignal(this.otherPeerId, 'answer', this.localSDP)
      return true
    } catch {
      return false
    }
  }

  disconnect() {
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null }
    this.dc?.close()
    this.pc?.close()
    this.pc = null
    this.dc = null
    this.peerId = ''
    this.otherPeerId = ''
    this.connHandlers.forEach(h => h(false))
  }
}

export const webrtc = new WebRTCService()
