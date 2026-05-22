import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { MeetMarker } from '../types'

interface Props {
  markers: MeetMarker[]
  visible: boolean
  onClose: () => void
  onMarkerClick: (marker: MeetMarker) => void
}

export default function MeetMap({ markers, visible, onClose, onMarkerClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible || !containerRef.current) return

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        attributionControl: false,
        zoomControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current)
    }

    const map = mapRef.current

    // Fit bounds
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    } else {
      map.setView([39.9042, 116.4074], 12)
    }

    // Clear old markers
    map.eachLayer(layer => {
      if (layer instanceof L.Marker) map.removeLayer(layer)
    })

    // Add markers with click handler
    for (const m of markers) {
      const date = new Date(m.createdAt).toLocaleDateString('zh-CN')
      const hasNote = m.myNote || m.peerNote

      L.marker([m.lat, m.lng])
        .addTo(map)
        .bindPopup(
          `<div style="font-size:14px;text-align:center;cursor:pointer">
            <div style="color:#888;font-size:12px">${date}</div>
            ${hasNote ? '<div style="margin-top:2px">点击查看详情</div>' : ''}
          </div>`,
        )
        .on('click', () => onMarkerClick(m))
    }

    timerRef.current = setTimeout(() => map.invalidateSize(), 100)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible, markers, onMarkerClick])

  if (!visible) return null

  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-30 flex justify-between items-center px-5 pt-4">
        <span className="text-white/70 text-sm font-medium">我们去过的地方</span>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors"
        >
          ✕
        </button>
      </div>
      <div ref={containerRef} className="flex-1 m-4 mt-12 rounded-xl overflow-hidden" />
    </div>
  )
}
