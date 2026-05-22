import { useEffect, useRef, useState } from 'react'
import { haversineDistance } from '../utils/haversine'
import { webrtc } from '../services/webrtc'
import type { MeetMarker } from '../types'

interface Position {
  lat: number
  lng: number
  timestamp: number
}

interface Props {
  enabled: boolean
  onMeetDetected: (marker: MeetMarker) => void
}

const MEET_DISTANCE = 50 // 米
const MEET_DURATION = 15 * 60 * 1000 // 15 分钟
const BROADCAST_INTERVAL = 5000 // GPS 广播间隔 5 秒

export function useGPS({ enabled, onMeetDetected }: Props) {
  const [myPosition, setMyPosition] = useState<Position | null>(null)
  const [peerPosition, setPeerPosition] = useState<Position | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const nearSinceRef = useRef<number | null>(null)
  const meetCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastBroadcastRef = useRef<number>(0)
  const onMeetRef = useRef(onMeetDetected)
  onMeetRef.current = onMeetDetected

  // 监听对方的 GPS 位置
  useEffect(() => {
    return webrtc.onMessage((msg: unknown) => {
      const data = msg as { type: string; lat: number; lng: number; timestamp: number }
      if (data.type === 'gps-update') {
        setPeerPosition({ lat: data.lat, lng: data.lng, timestamp: data.timestamp })
      }
    })
  }, [])

  // 启动 GPS 监听
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: Position = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        }
        setMyPosition(newPos)

        // 限流广播
        const now = Date.now()
        if (now - lastBroadcastRef.current > BROADCAST_INTERVAL) {
          lastBroadcastRef.current = now
          webrtc.send({
            type: 'gps-update',
            lat: newPos.lat,
            lng: newPos.lng,
            timestamp: newPos.timestamp,
          })
        }
      },
      (err) => {
        console.warn('GPS error:', err.message)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 20000,
      },
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [enabled])

  // 计算距离
  useEffect(() => {
    if (myPosition && peerPosition) {
      const d = haversineDistance(myPosition.lat, myPosition.lng, peerPosition.lat, peerPosition.lng)
      setDistance(d)
    }
  }, [myPosition, peerPosition])

  // 见面检测：距离 < 50m 且持续 > 15 分钟
  useEffect(() => {
    if (distance === null) return

    if (distance < MEET_DISTANCE) {
      if (nearSinceRef.current === null) {
        nearSinceRef.current = Date.now()
      }

      if (!meetCheckRef.current) {
        meetCheckRef.current = setInterval(() => {
          if (nearSinceRef.current && (Date.now() - nearSinceRef.current) >= MEET_DURATION) {
            const marker: MeetMarker = {
              id: 'meet-' + Date.now(),
              createdAt: Date.now(),
              lat: myPosition?.lat ?? 0,
              lng: myPosition?.lng ?? 0,
              myNote: '',
              myPhoto: null,
              peerNote: '',
              peerPhoto: null,
            }
            onMeetRef.current(marker)
            nearSinceRef.current = null
            if (meetCheckRef.current) {
              clearInterval(meetCheckRef.current)
              meetCheckRef.current = null
            }
          }
        }, 60000)
      }
    } else {
      nearSinceRef.current = null
      if (meetCheckRef.current) {
        clearInterval(meetCheckRef.current)
        meetCheckRef.current = null
      }
    }
  }, [distance])

  return { myPosition, peerPosition, distance }
}
