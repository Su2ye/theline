import { useState } from 'react'
import { motion } from 'framer-motion'
import { webrtc } from '../services/webrtc'

interface Props {
  onPaired: () => void
}

export default function PairPage({ onPaired }: Props) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [offerText, setOfferText] = useState('')
  const [answerText, setAnswerText] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      const offer = await webrtc.createOffer()
      setOfferText(offer)
      setMode('create')
      await copyToClipboard(offer)
    } catch {
      setError('生成配对码失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handlePasteOffer = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setOfferText(text)
    } catch {
      // Allow manual paste
    }
  }

  const handleAcceptOffer = async () => {
    setLoading(true)
    setError('')
    try {
      const answer = await webrtc.acceptOffer(offerText)
      setAnswerText(answer)
      setMode('join')
      await copyToClipboard(answer)
      setTimeout(() => onPaired(), 1000)
    } catch {
      setError('配对码无效，请检查是否正确粘贴')
    } finally {
      setLoading(false)
    }
  }

  const handleCompletePairing = async () => {
    setLoading(true)
    setError('')
    try {
      await webrtc.completePairing(answerText)
      onPaired()
    } catch {
      setError('回复码无效，请检查是否正确粘贴')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="text-5xl mb-4">━</div>
        <h1 className="text-2xl font-semibold tracking-wide mb-1">这条线</h1>
        <p className="text-white/30 text-sm">连接你和你最在乎的人</p>
      </motion.div>

      {error && (
        <div className="w-full max-w-xs mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {mode === 'choose' && (
        <motion.div
          className="flex flex-col gap-4 w-full max-w-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-4 bg-white text-black rounded-2xl font-semibold text-lg hover:bg-white/90 transition-colors active:scale-95 disabled:opacity-50"
          >
            {loading ? '生成中…' : '创建配对'}
          </button>
          <button
            onClick={() => setMode('join')}
            disabled={loading}
            className="w-full py-4 bg-white/10 rounded-2xl font-semibold text-lg hover:bg-white/15 transition-colors active:scale-95"
          >
            加入配对
          </button>
        </motion.div>
      )}

      {mode === 'create' && (
        <motion.div
          className="w-full max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-white/50 text-sm mb-4">
            配对码已生成并复制到剪贴板。通过微信发给对方。
          </p>
          <div className="bg-white/5 rounded-xl p-4 mb-4 text-left max-h-32 overflow-y-auto">
            <code className="text-xs text-white/60 break-all">{offerText}</code>
          </div>
          <button
            onClick={() => copyToClipboard(offerText)}
            className="w-full py-3 bg-white/10 rounded-xl text-sm mb-4 hover:bg-white/15 transition-colors"
          >
            {copied ? '已复制 ✓' : '重新复制'}
          </button>
          <div className="text-white/20 text-xs mb-3">
            等待对方完成配对后，粘贴对方的回复码：
          </div>
          <textarea
            placeholder="在这里粘贴对方的回复…"
            className="w-full bg-white/5 rounded-xl p-3 text-white/80 text-sm resize-none h-24 focus:outline-none focus:ring-1 focus:ring-white/20 placeholder-white/20"
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
          />
          {answerText && !loading && (
            <button
              onClick={handleCompletePairing}
              className="w-full mt-3 py-4 bg-white text-black rounded-2xl font-semibold text-lg hover:bg-white/90 transition-colors active:scale-95"
            >
              完成配对
            </button>
          )}
        </motion.div>
      )}

      {mode === 'join' && (
        <motion.div
          className="w-full max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-white/50 text-sm mb-4">
            粘贴对方发来的配对码：
          </p>
          <button
            onClick={handlePasteOffer}
            className="w-full py-2 bg-white/10 rounded-xl text-sm mb-3 hover:bg-white/15 transition-colors"
          >
            从剪贴板粘贴
          </button>
          <textarea
            placeholder="或在这里手动粘贴…"
            value={offerText}
            onChange={e => setOfferText(e.target.value)}
            className="w-full bg-white/5 rounded-xl p-3 text-white/80 text-sm resize-none h-24 mb-4 focus:outline-none focus:ring-1 focus:ring-white/20 placeholder-white/20"
          />
          <button
            onClick={handleAcceptOffer}
            disabled={!offerText.trim() || loading}
            className="w-full py-4 bg-white text-black rounded-2xl font-semibold text-lg hover:bg-white/90 transition-colors active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          >
            {loading ? '验证中…' : '接受配对'}
          </button>
          {answerText && (
            <motion.div className="mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-white/50 text-sm mb-3">
                回复码已生成并复制。发回给对方即可完成配对。
              </p>
              <div className="bg-white/5 rounded-xl p-4 mb-3 text-left max-h-32 overflow-y-auto">
                <code className="text-xs text-white/60 break-all">{answerText}</code>
              </div>
              <button
                onClick={() => copyToClipboard(answerText)}
                className="w-full py-3 bg-white/10 rounded-xl text-sm hover:bg-white/15 transition-colors"
              >
                {copied ? '已复制 ✓' : '重新复制'}
              </button>
            </motion.div>
          )}
        </motion.div>
      )}

      {mode !== 'choose' && (
        <button
          onClick={() => { setMode('choose'); setError('') }}
          className="mt-8 text-white/30 text-sm hover:text-white/50 transition-colors"
        >
          ← 返回
        </button>
      )}
    </div>
  )
}
