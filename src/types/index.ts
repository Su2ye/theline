export interface PairInfo {
  peerId: string
  webRTCCredentials: string | null
  lastConnectedAt: number | null
  pairCreatedAt: number
}

export interface MeetMarker {
  id: string
  createdAt: number
  lat: number
  lng: number
  myNote: string
  myPhoto: string | null
  peerNote: string
  peerPhoto: string | null
}

export type LineState = 'normal' | 'warning' | 'critical' | 'disconnected'

export interface LineStats {
  pairStartDate: number
  totalDays: number
  lastMeetDate: number | null
  daysSinceLastMeet: number | null
  meetCount: number
  placesCount: number
  recentMeetDates: number[]
  lineState: LineState
}
