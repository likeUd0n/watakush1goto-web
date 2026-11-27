import type { AiSummary, Appointment, ConditionRecord, ConsultMemo, SleepRecord, Visit } from './entities'

// バックアップの JSON。Android 版 data/Backup.kt と同じ形式で、どちらで書き出しても互いに読める

const FORMAT = 'shinsatsu-note'
const VERSION = 1

export interface BackupData {
  sleeps: SleepRecord[]
  conditions: ConditionRecord[]
  memos: ConsultMemo[]
  visits: Visit[]
  appointments: Appointment[]
  aiSummaries: AiSummary[]
}

export const emptyBackup = (): BackupData => ({
  sleeps: [],
  conditions: [],
  memos: [],
  visits: [],
  appointments: [],
  aiSummaries: [],
})

export const backupSize = (b: BackupData): number =>
  b.sleeps.length + b.conditions.length + b.memos.length + b.visits.length + b.appointments.length + b.aiSummaries.length

export class BackupFormatError extends Error {}

/** null の項目は書かない(Android 版の putOpt と同じ) */
const opt = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T

export function toJson(b: BackupData, exportedAt: number = Date.now()): string {
  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      exportedAt,
      sleep_records: b.sleeps.map((s) =>
        opt({ date: s.date, sleepMin: s.sleepMin, wakeMin: s.wakeMin, napSleepMin: s.napSleepMin, napWakeMin: s.napWakeMin, updatedAt: s.updatedAt }),
      ),
      condition_records: b.conditions.map((c) =>
        opt({ date: c.date, timeMin: c.timeMin, mind: c.mind, body: c.body, note: c.note, updatedAt: c.updatedAt }),
      ),
      consult_memos: b.memos.map((m) =>
        opt({ text: m.text, kind: m.kind, createdAt: m.createdAt, talkedAt: m.talkedAt, pinned: m.pinned }),
      ),
      visits: b.visits.map((v) => ({ date: v.date, kind: v.kind, talkedSummary: v.talkedSummary, feedback: v.feedback, createdAt: v.createdAt })),
      appointments: b.appointments.map((a) => opt({ kind: a.kind, date: a.date, timeMin: a.timeMin })),
      ai_summaries: b.aiSummaries.map((a) => ({ kind: a.kind, text: a.text, savedAt: a.savedAt })),
    },
    null,
    1,
  )
}

type Obj = Record<string, unknown>

const str = (o: Obj, k: string): string => {
  const v = o[k]
  if (typeof v !== 'string') throw new BackupFormatError('中身の形が違います')
  return v
}
const int = (o: Obj, k: string): number => {
  const v = o[k]
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new BackupFormatError('中身の形が違います')
  return Math.trunc(v)
}
const intOrNull = (o: Obj, k: string): number | null => (o[k] == null ? null : int(o, k))
const strOrNull = (o: Obj, k: string): string | null => (o[k] == null ? null : str(o, k))
/** 無ければ 0(Android 版の optLong) */
const optLong = (o: Obj, k: string): number => (typeof o[k] === 'number' ? Math.trunc(o[k] as number) : 0)
/** 無ければ ""(Android 版の optString) */
const optStr = (o: Obj, k: string): string => (o[k] == null ? '' : String(o[k]))

/** このアプリが書き出した JSON を読む。形が違えば BackupFormatError */
export function parseBackup(json: string): BackupData {
  let root: unknown
  try {
    root = JSON.parse(json)
  } catch {
    throw new BackupFormatError('JSON ではありません')
  }
  if (typeof root !== 'object' || root === null || Array.isArray(root)) throw new BackupFormatError('JSON ではありません')
  const r = root as Obj
  if (r.format !== FORMAT) throw new BackupFormatError('このアプリのバックアップではありません')
  if (typeof r.version === 'number' && r.version > VERSION) throw new BackupFormatError('新しい版のアプリで書き出したファイルです')

  function list<T>(name: string, f: (o: Obj) => T): T[] {
    const a = r[name]
    if (a == null) return []
    if (!Array.isArray(a)) throw new BackupFormatError('中身の形が違います')
    return a.map((o) => {
      if (typeof o !== 'object' || o === null) throw new BackupFormatError('中身の形が違います')
      return f(o as Obj)
    })
  }

  return {
    sleeps: list('sleep_records', (o) => ({
      date: str(o, 'date'),
      sleepMin: int(o, 'sleepMin'),
      wakeMin: int(o, 'wakeMin'),
      napSleepMin: intOrNull(o, 'napSleepMin'),
      napWakeMin: intOrNull(o, 'napWakeMin'),
      updatedAt: optLong(o, 'updatedAt'),
    })),
    conditions: list('condition_records', (o) => ({
      date: str(o, 'date'),
      timeMin: int(o, 'timeMin'),
      mind: intOrNull(o, 'mind'),
      body: intOrNull(o, 'body'),
      note: optStr(o, 'note'),
      updatedAt: optLong(o, 'updatedAt'),
    })),
    memos: list('consult_memos', (o) => ({
      text: str(o, 'text'),
      kind: strOrNull(o, 'kind'),
      createdAt: int(o, 'createdAt'),
      talkedAt: intOrNull(o, 'talkedAt'),
      pinned: o.pinned === true,
    })),
    visits: list('visits', (o) => ({
      date: str(o, 'date'),
      kind: str(o, 'kind'),
      talkedSummary: optStr(o, 'talkedSummary'),
      feedback: optStr(o, 'feedback'),
      createdAt: optLong(o, 'createdAt'),
    })),
    appointments: list('appointments', (o) => ({ kind: str(o, 'kind'), date: str(o, 'date'), timeMin: intOrNull(o, 'timeMin') })),
    aiSummaries: list('ai_summaries', (o) => ({ kind: str(o, 'kind'), text: str(o, 'text'), savedAt: optLong(o, 'savedAt') })),
  }
}

/** 読み込みで足すもの */
export type MergePlan = BackupData

/**
 * 今のデータに読み込んだものを足す計画。何度読み込んでも増えないようにする。
 * 睡眠・予定・AIの整理はキー(日付・相手)で置き換え(同じ内容なら何もしない)、
 * 調子・話すこと・診察の記録は日時＋内容が同じものを飛ばす
 */
export function planMerge(current: BackupData, incoming: BackupData): MergePlan {
  const sleepNow = new Map(current.sleeps.map((s) => [s.date, s]))
  const apptNow = new Map(current.appointments.map((a) => [a.kind, a]))
  const aiNow = new Map(current.aiSummaries.map((a) => [a.kind, a]))
  const sameSleep = (a: SleepRecord, b: SleepRecord) =>
    a.sleepMin === b.sleepMin && a.wakeMin === b.wakeMin && a.napSleepMin === b.napSleepMin && a.napWakeMin === b.napWakeMin
  const condSig = (c: ConditionRecord) => JSON.stringify([c.date, c.timeMin, c.mind, c.body, c.note])
  const memoSig = (m: ConsultMemo) => JSON.stringify([m.createdAt, m.text])
  const visitSig = (v: Visit) => JSON.stringify([v.date, v.kind, v.talkedSummary, v.feedback])

  const condSeen = new Set(current.conditions.map(condSig))
  const memoSeen = new Set(current.memos.map(memoSig))
  const visitSeen = new Set(current.visits.map(visitSig))
  const firstTime = (seen: Set<string>, sig: string) => (seen.has(sig) ? false : (seen.add(sig), true))
  return {
    sleeps: incoming.sleeps.filter((s) => {
      const now = sleepNow.get(s.date)
      return !(now && sameSleep(now, s))
    }),
    conditions: incoming.conditions.filter((c) => firstTime(condSeen, condSig(c))),
    memos: incoming.memos.filter((m) => firstTime(memoSeen, memoSig(m))),
    visits: incoming.visits.filter((v) => firstTime(visitSeen, visitSig(v))),
    appointments: incoming.appointments.filter((a) => {
      const now = apptNow.get(a.kind)
      return !(now && now.date === a.date && now.timeMin === a.timeMin)
    }),
    aiSummaries: incoming.aiSummaries.filter((a) => aiNow.get(a.kind)?.text !== a.text),
  }
}
