import { db } from '../db'

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.nextcloud.com:3478' },
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

  private initPC(isOfferer: boolean) {
    this.pc?.close()
    this.pc = new RTCPeerConnection(STUN_SERVERS)

    this.pc.onicecandidate = (e) => {
      void e
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

  private setupDataChannel() {
    if (!this.dc) return

    this.dc.onopen = async () => {
      const existing = await db.pairInfo.get(this.otherPeerId)
      await db.pairInfo.put({
        peerId: this.otherPeerId,
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

  disconnect() {
    this.dc?.close()
    this.pc?.close()
    this.pc = null
    this.dc = null
  }
}

export const webrtc = new WebRTCService()
