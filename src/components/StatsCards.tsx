import { useState } from 'react'
import type { LineStats } from '../types'

interface Props {
  stats: LineStats
  paired: boolean
  onChangeDate: (date: number) => void
}

const cardColors = [
  { bg: 'from-amber-500/10 to-orange-500/5', border: 'border-amber-500/20', text: 'text-amber-200' },
  { bg: 'from-rose-500/10 to-pink-500/5', border: 'border-rose-500/20', text: 'text-rose-200' },
  { bg: 'from-violet-500/10 to-purple-500/5', border: 'border-violet-500/20', text: 'text-violet-200' },
  { bg: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-500/20', text: 'text-emerald-200' },
]

export default function StatsCards({ stats, paired, onChangeDate }: Props) {
  const [editing, setEditing] = useState(false)

  const items = [
    { label: '在一起', value: stats.totalDays, unit: '天', editable: true },
    {
      label: '上次见面',
      value: stats.daysSinceLastMeet === null ? '--' : stats.daysSinceLastMeet === 0 ? '今天' : stats.daysSinceLastMeet,
      unit: stats.daysSinceLastMeet ? '天前' : '',
      editable: false,
    },
    { label: '见面次数', value: stats.meetCount, unit: '次', editable: false },
    { label: '去过的地方', value: stats.placesCount, unit: '个', editable: false },
  ]

  return (
    <>
      <div className="absolute bottom-0 left-0 right-0 px-4 z-10 safe-bottom" style={{ paddingBottom: `calc(24px + env(safe-area-inset-bottom, 0px))` }}>
        <div className="flex gap-2.5">
          {items.map((item, i) => {
            const c = cardColors[i]
            return (
              <button
                key={item.label}
                onClick={() => { if (item.editable && paired) setEditing(true) }}
                disabled={!item.editable || !paired}
                className={`
                  flex-1 bg-gradient-to-b ${c.bg}
                  backdrop-blur-xl rounded-2xl px-3 py-4
                  border ${c.border}
                  flex flex-col items-center gap-1.5
                  ${item.editable && paired ? 'active:scale-95 cursor-pointer' : 'cursor-default'}
                `}
              >
                <div className="text-[10px] text-white/30 uppercase tracking-wider">
                  {item.label}{item.editable && paired ? ' ▾' : ''}
                </div>
                <div className={`text-xl font-bold tracking-tight tabular-nums ${c.text}`}>
                  {item.value}
                  {item.unit && (
                    <span className="text-[11px] font-normal text-white/30 ml-0.5">{item.unit}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {editing && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div className="w-full max-w-xs bg-[#1c1c1e] rounded-t-3xl p-6 safe-bottom" onClick={e => e.stopPropagation()}>
            <h3 className="text-white/80 text-center mb-4">在一起的纪念日</h3>
            <input
              type="date"
              defaultValue={new Date(stats.pairStartDate).toISOString().slice(0, 10)}
              className="w-full bg-white/10 rounded-xl p-3 text-white text-center text-lg mb-4 focus:outline-none"
              onChange={e => {
                const d = new Date(e.target.value).getTime()
                if (d) onChangeDate(d)
              }}
            />
            <button
              onClick={() => setEditing(false)}
              className="w-full py-3 bg-white/10 rounded-xl text-white/60 text-sm"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  )
}
