import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MeetMarker } from '../types'

interface Props {
  marker: MeetMarker | null
  onClose: () => void
  onSaveNote: (note: string) => void
  onSavePhoto: (photo: string) => void
}

export default function MeetDetail({ marker, onClose, onSaveNote, onSavePhoto }: Props) {
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    setNote(marker?.myNote ?? '')
    setPhoto(marker?.myPhoto ?? null)
  }, [marker?.id, marker?.myNote, marker?.myPhoto])

  if (!marker) return null

  const date = new Date(marker.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const hasBothPhotos = marker.myPhoto && marker.peerPhoto

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPhoto(dataUrl)
      onSavePhoto(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-h-[80vh] bg-[#1c1c1e] rounded-t-3xl p-6 overflow-y-auto"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
        >
          {/* 日期 */}
          <div className="text-center mb-6">
            <div className="text-white/40 text-sm">{date}</div>
            <div className="text-white/20 text-xs mt-1">
              {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
            </div>
          </div>

          {/* 照片区域 */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* 我的照片 */}
            <div className="aspect-square bg-white/5 rounded-xl overflow-hidden relative group">
              {photo ? (
                <img
                  src={photo}
                  className={`w-full h-full object-cover ${!hasBothPhotos ? 'blur-xl scale-110' : ''}`}
                  alt="我的照片"
                />
              ) : (
                <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-1 text-white/30 hover:text-white/50 transition-colors">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="text-xs">添加照片</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                </label>
              )}
              <div className="absolute bottom-2 left-2 text-xs text-white/60 bg-black/40 px-2 py-0.5 rounded-full">
                我
              </div>
            </div>

            {/* 对方的照片 */}
            <div className="aspect-square bg-white/5 rounded-xl overflow-hidden relative">
              {marker.peerPhoto ? (
                <img
                  src={marker.peerPhoto}
                  className={`w-full h-full object-cover ${!hasBothPhotos ? 'blur-2xl scale-110' : ''}`}
                  alt="对方的照片"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-1">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="text-xs">等待对方上传</span>
                </div>
              )}
              <div className="absolute bottom-2 right-2 text-xs text-white/60 bg-black/40 px-2 py-0.5 rounded-full">
                对方
              </div>
            </div>
          </div>

          {/* 解锁提示 */}
          {!hasBothPhotos && (marker.myPhoto || marker.peerPhoto) && (
            <div className="text-center text-white/30 text-xs mb-4">
              双方都上传照片后，照片才会变清晰
            </div>
          )}

          {/* 我的留言 */}
          <div className="mb-4">
            <label className="text-white/40 text-xs mb-2 block">我的留言</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              onBlur={() => onSaveNote(note)}
              placeholder="写点什么..."
              className="w-full bg-white/5 rounded-xl p-3 text-white/80 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-white/20 placeholder-white/20"
            />
          </div>

          {/* 对方的留言 */}
          {marker.peerNote && (
            <div className="mb-4">
              <label className="text-white/40 text-xs mb-2 block">对方的留言</label>
              <div className="w-full bg-white/5 rounded-xl p-3 text-white/60 text-sm italic">
                {marker.peerNote}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 bg-white/10 rounded-xl text-white/60 text-sm font-medium hover:bg-white/15 transition-colors"
          >
            关闭
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
