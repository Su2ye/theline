import Dexie, { type Table } from 'dexie'
import type { MeetMarker, PairInfo } from '../types'

class TheLineDB extends Dexie {
  pairInfo!: Table<PairInfo, string>
  markers!: Table<MeetMarker, string>

  constructor() {
    super('theline')
    this.version(1).stores({
      pairInfo: 'peerId',
      markers: 'id, createdAt',
    })
  }
}

export const db = new TheLineDB()
