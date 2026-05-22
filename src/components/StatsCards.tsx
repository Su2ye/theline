import { motion } from 'framer-motion'
import type { LineStats } from '../types'

interface Props {
  stats: LineStats
}

function daysSinceText(stats: LineStats): string {
  if (stats.daysSinceLastMeet === null) return '还没有见过面'
  if (stats.daysSinceLastMeet === 0) return '今天见面了'
  return `${stats.daysSinceLastMeet} 天前`
}

const card = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

export default function StatsCards({ stats }: Props) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-8 flex flex-col gap-3">
      <motion.div
        className="flex gap-3"
        initial="initial"
        animate="animate"
        transition={{ staggerChildren: 0.08 }}
      >
        <motion.div
          variants={card}
          className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/8"
        >
          <div className="text-xs text-white/40 mb-1">在一起</div>
          <div className="text-2xl font-semibold tracking-tight">
            {stats.totalDays} <span className="text-sm text-white/50 font-normal">天</span>
          </div>
        </motion.div>

        <motion.div
          variants={card}
          className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/8"
        >
          <div className="text-xs text-white/40 mb-1">上次见面</div>
          <div className="text-xl font-semibold tracking-tight">
            {daysSinceText(stats)}
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        className="flex gap-3"
        initial="initial"
        animate="animate"
        transition={{ staggerChildren: 0.08, delayChildren: 0.1 }}
      >
        <motion.div
          variants={card}
          className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/8"
        >
          <div className="text-xs text-white/40 mb-1">见面次数</div>
          <div className="text-2xl font-semibold tracking-tight">
            {stats.meetCount} <span className="text-sm text-white/50 font-normal">次</span>
          </div>
        </motion.div>

        <motion.div
          variants={card}
          className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/8"
        >
          <div className="text-xs text-white/40 mb-1">去过的地方</div>
          <div className="text-2xl font-semibold tracking-tight">
            {stats.placesCount} <span className="text-sm text-white/50 font-normal">个</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
