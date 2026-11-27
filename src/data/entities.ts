// 日付は "YYYY-MM-DD"、時刻は 0:00 からの分(0〜1439)で持つ。相手は "doc"(診察)/"coun"(カウンセリング)
// 形は Android 版の data/Entities.kt と同じ（バックアップの JSON をそのまま行き来させるため）

/** 睡眠(1日1件)。日付は起きた日。二度寝・昼寝は無ければ null */
export interface SleepRecord {
  date: string
  sleepMin: number
  wakeMin: number
  napSleepMin: number | null
  napWakeMin: number | null
  updatedAt: number
}

/** 調子(1日に何件でも)。ココロ・カラダは 1(つらい)〜5(楽)。選ばなければ null */
export interface ConditionRecord {
  id?: number
  date: string
  timeMin: number
  mind: number | null
  body: number | null
  note: string
  updatedAt: number
}

/** 話すこと。talkedAt が null なら未相談、入っていれば「話したこと」。pinned は本人が相手や必須を固定指定した印 */
export interface ConsultMemo {
  id?: number
  text: string
  kind: string | null
  createdAt: number
  talkedAt: number | null
  pinned: boolean
}

/** 診察・カウンセリングの記録 */
export interface Visit {
  id?: number
  date: string
  kind: string
  talkedSummary: string
  feedback: string
  createdAt: number
}

/** 次の予定(相手ごとに最大1件) */
export interface Appointment {
  kind: string
  date: string
  timeMin: number | null
}

/** AIの整理(相手ごとに0〜1件) */
export interface AiSummary {
  kind: string
  text: string
  savedAt: number
}

export const DOC = 'doc'
export const COUN = 'coun'

export function kindLabel(kind: string | null | undefined): string {
  if (kind === DOC) return '診察'
  if (kind === COUN) return 'カウンセリング'
  return '未分類'
}

/** 画面が使うデータ一式。記録は個人の数年分でも小さいので、まとめて持つ */
export interface AppData {
  sleeps: Record<string, SleepRecord>
  conditions: Record<string, ConditionRecord[]>
  /** 未相談の話すこと(新しい順) */
  memos: ConsultMemo[]
  /** 話したこと(話した日の新しい順) */
  talked: ConsultMemo[]
  /** 診察・カウンセリングの記録(新しい順) */
  visits: Visit[]
  appointments: Record<string, Appointment>
  aiSummaries: Record<string, AiSummary>
}

export const emptyData = (): AppData => ({
  sleeps: {},
  conditions: {},
  memos: [],
  talked: [],
  visits: [],
  appointments: {},
  aiSummaries: {},
})

/** その相手の最新の記録 */
export const lastVisit = (data: AppData, kind: string): Visit | undefined => data.visits.find((v) => v.kind === kind)

export const conditionsOn = (data: AppData, date: string): ConditionRecord[] => data.conditions[date] ?? []
