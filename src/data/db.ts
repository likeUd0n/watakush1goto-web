import Dexie, { type EntityTable } from 'dexie'
import type { AiSummary, Appointment, ConditionRecord, ConsultMemo, SleepRecord, Visit } from './entities'

// IndexedDB の表。名前と項目は Android 版の Room の表と同じにする

export class AppDb extends Dexie {
  sleep_records!: EntityTable<SleepRecord, 'date'>
  condition_records!: EntityTable<ConditionRecord, 'id'>
  consult_memos!: EntityTable<ConsultMemo, 'id'>
  visits!: EntityTable<Visit, 'id'>
  appointments!: EntityTable<Appointment, 'kind'>
  ai_summaries!: EntityTable<AiSummary, 'kind'>

  constructor(name = 'watakush1goto') {
    super(name)
    this.version(1).stores({
      sleep_records: 'date',
      condition_records: '++id, date',
      consult_memos: '++id',
      visits: '++id, date',
      appointments: 'kind',
      ai_summaries: 'kind',
    })
  }
}
