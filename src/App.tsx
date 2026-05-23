import { useState } from 'react'
import LineCanvas from './components/LineCanvas'
import StatsCards from './components/StatsCards'
import type { LineStats } from './types'

const stats: LineStats = {
  pairStartDate: Date.now() - 433 * 24 * 60 * 60 * 1000,
  totalDays: 433,
  lastMeetDate: Date.now() - 12 * 24 * 60 * 60 * 1000,
  daysSinceLastMeet: 12,
  meetCount: 7,
  placesCount: 5,
  recentMeetDates: [
    Date.now() - 12 * 24 * 60 * 60 * 1000,
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ],
  lineState: 'normal',
}

export default function App() {
  const [show, setShow] = useState(true)
  return (
    <div className="h-full w-full relative bg-[#0f0f0f] overflow-hidden">
      {show ? (
        <>
          <div className="absolute top-0 left-0 right-0 h-[55%]">
            <LineCanvas stats={stats} />
          </div>
          <StatsCards stats={stats} />
          <button
            onClick={() => setShow(false)}
            className="absolute top-5 right-5 z-20 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 text-white/70 text-sm border border-white/10"
          >
            配对
          </button>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-white/40">
          页面已切换
        </div>
      )}
    </div>
  )
}
