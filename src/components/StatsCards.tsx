import type { LineStats } from '../types'

interface Props {
  stats: LineStats
}

const cardColors = [
  { bg: 'from-amber-500/10 to-orange-500/5', border: 'border-amber-500/20', text: 'text-amber-200' },
  { bg: 'from-rose-500/10 to-pink-500/5', border: 'border-rose-500/20', text: 'text-rose-200' },
  { bg: 'from-violet-500/10 to-purple-500/5', border: 'border-violet-500/20', text: 'text-violet-200' },
  { bg: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-500/20', text: 'text-emerald-200' },
]

export default function StatsCards({ stats }: Props) {

  const items = [
    { label: '在一起', value: stats.totalDays, unit: '天' },
    {
      label: '上次见面',
      value: stats.daysSinceLastMeet === null ? '--' : stats.daysSinceLastMeet === 0 ? '今天' : stats.daysSinceLastMeet,
      unit: stats.daysSinceLastMeet ? '天前' : '',
    },
    { label: '见面次数', value: stats.meetCount, unit: '次' },
    { label: '去过的地方', value: stats.placesCount, unit: '个' },
  ]

  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 z-10">
      <div className="flex gap-2.5">
        {items.map((item, i) => {
          const c = cardColors[i]
          return (
            <div
              key={item.label}
              className={`
                flex-1 bg-gradient-to-b ${c.bg}
                backdrop-blur-xl rounded-2xl px-3 py-4
                border ${c.border}
                flex flex-col items-center gap-1.5
              `}
            >
              <div className="text-[10px] text-white/30 uppercase tracking-wider">
                {item.label}
              </div>
              <div className={`text-xl font-bold tracking-tight tabular-nums ${c.text}`}>
                {item.value}
                {item.unit && (
                  <span className="text-[11px] font-normal text-white/30 ml-0.5">{item.unit}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
