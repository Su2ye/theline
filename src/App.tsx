import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LineCanvas from './components/LineCanvas'
import StatsCards from './components/StatsCards'
import PairPage from './components/PairPage'
import StatusBar from './components/StatusBar'
import type { MeetMarker, LineStats, LineState } from './types'
import { db } from './db'
import { webrtc } from './services/webrtc'
import { useGPS } from './hooks/useGPS'
import { useVisibility } from './hooks/useVisibility'
import { useWakeLock } from './hooks/useWakeLock'
import { subscribeToPush, nudgePeer } from './services/notify'

const MeetMap = lazy(() => import('./components/MeetMap'))
const MeetDetail = lazy(() => import('./components/MeetDetail'))

function getDayDiff(ts: number | null): number | null {
  if (!ts) return null
  return Math.ceil((Date.now() - ts) / (1000 * 60 * 60 * 24))
}

function deriveLineState(days: number | null): LineState {
  if (days === null) return 'normal'
  if (days > 60) return 'disconnected'
  if (days > 30) return 'critical'
  if (days > 14) return 'warning'
  return 'normal'
}

type Page = 'main' | 'pair'

export default function App() {
  const [page, setPage] = useState<Page>('main')
  const [paired, setPaired] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<MeetMarker | null>(null)
  const [markers, setMarkers] = useState<MeetMarker[]>([])
  const [pullOffset, setPullOffset] = useState(0)
  const [pullStartY, setPullStartY] = useState<number | null>(null)
  const [pairCreatedAt, setPairCreatedAt] = useState<number>()
  const [gpsActive, setGpsActive] = useState(false)
  const [connected, setConnected] = useState(false)
  const [nudgeResult, setNudgeResult] = useState<'idle' | 'sending' | 'sent'>('idle')
  const peerIdRef = useRef('')

  const wakeLock = useWakeLock()

  // 页面切到后台时暂停 GPS
  useVisibility({
    onHide: () => {
      setGpsActive(false)
      wakeLock.release()
    },
    onShow: () => {
      if (paired) setGpsActive(true)
    },
  })

  // 启动时加载配对信息和标记
  useEffect(() => {
    db.pairInfo.toArray().then(info => {
      if (info.length > 0) {
        const p = info[0]
        setPaired(true)
        setPairCreatedAt(p.pairCreatedAt)
        setGpsActive(true)
        peerIdRef.current = p.peerId
      }
    })
    db.markers.toArray().then(saved => {
      if (saved.length > 0) setMarkers(saved)
    })
  }, [])

  // 监听 WebRTC 连接状态
  useEffect(() => {
    return webrtc.onConnectionChange((state: boolean) => {
      setConnected(state)
    })
  }, [])

  // 已配对 + GPS 激活时，启用屏幕常亮
  useEffect(() => {
    if (paired && gpsActive) {
      wakeLock.request()
    } else {
      wakeLock.release()
    }
  }, [paired, gpsActive, wakeLock])

  const statsWithState = useMemo<LineStats>(() => {
    if (!paired) return {
      pairStartDate: Date.now(), totalDays: 0, lastMeetDate: null,
      daysSinceLastMeet: null, meetCount: 0, placesCount: 0,
      recentMeetDates: [], lineState: 'normal',
    }
    const sorted = [...markers].sort((a, b) => b.createdAt - a.createdAt)
    const now = Date.now()
    const recentDates = sorted.filter(m => m.createdAt > now - 30 * 24 * 60 * 60 * 1000).map(m => m.createdAt)
    const lastMeet = sorted[0]?.createdAt ?? null
    const daysSince = getDayDiff(lastMeet)
    const uniquePlaces = new Set(sorted.map(m => `${m.lat.toFixed(4)},${m.lng.toFixed(4)}`))
    return {
      pairStartDate: pairCreatedAt ?? sorted[sorted.length - 1]?.createdAt ?? now,
      totalDays: pairCreatedAt ? getDayDiff(pairCreatedAt) ?? 0 : 0,
      lastMeetDate: lastMeet,
      daysSinceLastMeet: daysSince,
      meetCount: markers.length,
      placesCount: uniquePlaces.size,
      recentMeetDates: recentDates,
      lineState: deriveLineState(daysSince),
    }
  }, [paired, markers, pairCreatedAt])

  // 见面检测回调
  const handleMeetDetected = useCallback((marker: MeetMarker) => {
    setMarkers(prev => {
      if (prev.find(m => m.id === marker.id)) return prev
      return [...prev, marker]
    })
    db.markers.put(marker)
    webrtc.send({ type: 'marker-sync', marker })
  }, [])

  // GPS 追踪
  const { distance } = useGPS({ enabled: gpsActive, onMeetDetected: handleMeetDetected })

  // WebRTC 消息监听
  useEffect(() => {
    return webrtc.onMessage((msg: unknown) => {
      const data = msg as { type: string; marker?: MeetMarker }
      if (data.type === 'marker-sync' && data.marker) {
        setMarkers(prev => {
          const exists = prev.find(m => m.id === data.marker!.id)
          if (exists) {
            return prev.map(m => m.id === data.marker!.id
              ? { ...m, peerNote: data.marker!.peerNote, peerPhoto: data.marker!.peerPhoto }
              : m)
          }
          db.markers.put(data.marker!)
          return [...prev, data.marker!]
        })
      }
    })
  }, [])

  const handlePaired = useCallback(async () => {
    setPaired(true)
    setGpsActive(true)
    setPage('main')

    subscribeToPush(peerIdRef.current)
  }, [])

  const updateMarker = useCallback((field: 'myNote' | 'myPhoto', value: string) => {
    if (!selectedMarker) return
    const updated = { ...selectedMarker, [field]: value }
    setMarkers(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelectedMarker(updated)
    db.markers.put(updated)
    webrtc.send({ type: 'marker-sync', marker: updated })
  }, [selectedMarker])

  // 下拉手势
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return
    setPullStartY(e.touches[0].clientY)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY === null) return
    const dy = e.touches[0].clientY - pullStartY
    if (dy > 0) setPullOffset(dy)
  }, [pullStartY])

  const handleTouchEnd = useCallback(() => {
    if (pullOffset > 120) setShowMap(true)
    setPullOffset(0)
    setPullStartY(null)
  }, [pullOffset])

  return (
    <div
      className="h-full w-full relative bg-[#0f0f0f] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 状态栏 + 提醒按钮 */}
      {page === 'main' && paired && (
        <>
          <StatusBar gpsActive={gpsActive} connected={connected} distance={distance} />
          <button
            onClick={async () => {
              setNudgeResult('sending')
              const ok = await nudgePeer(peerIdRef.current)
              setNudgeResult(ok ? 'sent' : 'idle')
              setTimeout(() => setNudgeResult('idle'), 3000)
            }}
            disabled={nudgeResult === 'sending'}
            className="absolute top-14 right-4 z-20 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 text-white/50 text-xs border border-white/10 hover:bg-white/15 hover:text-white/70 transition-colors disabled:opacity-30"
          >
            {nudgeResult === 'sending' ? '发送中…' : nudgeResult === 'sent' ? '已提醒' : '提醒对方'}
          </button>
        </>
      )}

      {/* 配对按钮 */}
      {!paired && page === 'main' && (
        <button
          onClick={() => setPage('pair')}
          className="absolute top-5 right-5 z-20 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 text-white/70 text-sm border border-white/10 hover:bg-white/15 transition-colors"
        >
          配对
        </button>
      )}

      <AnimatePresence mode="wait">
        {page === 'pair' ? (
          <motion.div
            key="pair"
            className="h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PairPage onPaired={handlePaired} />
            <button
              onClick={() => setPage('main')}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-sm hover:text-white/50 transition-colors"
            >
              返回主页
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="main"
            className="h-full relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute top-0 left-0 right-0 h-[55%]">
              <LineCanvas stats={statsWithState} pullOffset={pullOffset} />
            </div>

            {pullOffset > 0 && (
              <div
                className="absolute top-8 left-1/2 -translate-x-1/2 text-white/30 text-xs transition-opacity"
                style={{ opacity: Math.min(pullOffset / 120, 1) }}
              >
                {pullOffset > 120 ? '松手查看地图' : '下拉查看地图'}
              </div>
            )}

            <StatsCards stats={statsWithState} />

            {showMap && (
              <Suspense fallback={null}>
                <MeetMap
                  markers={markers}
                  visible={showMap}
                  onClose={() => setShowMap(false)}
                  onMarkerClick={(m) => {
                    setSelectedMarker(m)
                    setShowMap(false)
                  }}
                />
              </Suspense>
            )}

            {selectedMarker && (
              <Suspense fallback={null}>
                <MeetDetail
                  marker={selectedMarker}
                  onClose={() => setSelectedMarker(null)}
                  onSaveNote={(note) => updateMarker('myNote', note)}
                  onSavePhoto={(photo) => updateMarker('myPhoto', photo)}
                />
              </Suspense>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
