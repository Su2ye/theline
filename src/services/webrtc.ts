import { db } from '../db'

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
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

  async createOffer(): Promise<string> {
    this.peerId = this.generatePeerId()
    this.initPC(true)

    const offer = await this.pc!.createOffer()
    await this.pc!.setLocalDescription(offer)

    // Wait for ICE gathering to complete
    await new Promise<void>(resolve => {
      this.pc!.onicegatheringstatechange = () => {
        if (this.pc!.iceGatheringState === 'complete') resolve()
      }
      // Timeout after 5 seconds
      setTimeout(resolve, 5000)
    })

    return this.encodeSignal('offer', JSON.stringify(this.pc!.localDescription!.toJSON()))
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

    await new Promise<void>(resolve => {
      this.pc!.onicegatheringstatechange = () => {
        if (this.pc!.iceGatheringState === 'complete') resolve()
      }
      setTimeout(resolve, 5000)
    })

    return this.encodeSignal('answer', JSON.stringify(this.pc!.localDescription!.toJSON()))
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
