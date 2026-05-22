import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  gpsActive: boolean
  connected: boolean
  distance: number | null
}

export default function StatusBar({ gpsActive, connected, distance }: Props) {
  const items = [
    {
      key: 'gps',
      label: 'GPS',
      active: gpsActive,
      activeText: '定位中',
      idleText: '未定位',
    },
    {
      key: 'p2p',
      label: '连接',
      active: connected,
      activeText: '已连接',
      idleText: '未连接',
    },
  ]

  if (distance !== null) {
    const distText = distance < 1000
      ? `${Math.round(distance)} 米`
      : `${(distance / 1000).toFixed(1)} 公里`
    items.push({
      key: 'dist',
      label: '距离',
      active: true,
      activeText: distText,
      idleText: '',
    })
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex justify-center gap-2 pt-3 px-4">
      <AnimatePresence>
        {items.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
              backdrop-blur-md border
              ${item.active
                ? 'bg-white/10 border-white/15 text-white/70'
                : 'bg-white/5 border-white/5 text-white/30'
              }
            `}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                item.active ? 'bg-green-400' : 'bg-white/20'
              }`}
            />
            <span className="opacity-50">{item.label}</span>
            <span>{item.active ? item.activeText : item.idleText}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
