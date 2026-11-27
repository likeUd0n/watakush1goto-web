// 日付は "YYYY-MM-DD" の文字列のまま扱う。計算は UTC の Date で行い、時差でずれないようにする

const WEEKDAYS = '月火水木金土日'

const toUtc = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const fromUtc = (d: Date): string => d.toISOString().slice(0, 10)

export const dateKey = (y: number, m: number, d: number): string => fromUtc(new Date(Date.UTC(y, m - 1, d)))

/** 端末の時刻での今日 */
export function today(now: Date = new Date()): string {
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** その時刻(ミリ秒)の、端末の時刻での日付 */
export function dateOfMillis(ms: number): string {
  return today(new Date(ms))
}

export const addDays = (key: string, n: number): string => {
  const d = toUtc(key)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUtc(d)
}

/** a から b まで何日か */
export const daysBetweenCount = (a: string, b: string): number => Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86400000)

export const year = (key: string): number => Number(key.slice(0, 4))
export const month = (key: string): number => Number(key.slice(5, 7))
export const day = (key: string): number => Number(key.slice(8, 10))

/** 曜日の番号(月 1 〜 日 7) */
export const isoWeekday = (key: string): number => ((toUtc(key).getUTCDay() + 6) % 7) + 1

/** 曜日1文字(日曜は「日」) */
export const weekdayJ = (key: string): string => WEEKDAYS[isoWeekday(key) - 1]

/** 11/13 */
export const md = (key: string): string => `${month(key)}/${day(key)}`

/** 11/13(金) */
export const mdw = (key: string): string => `${md(key)}(${weekdayJ(key)})`

/** 期間 [from, to] の日付(古い順) */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** 直近30日(今日を含む) */
export const last30 = (t: string): string[] => daysBetween(addDays(t, -29), t)

/**
 * 前回の記録の翌日から今日まで。前回が無ければ直近30日。
 * 前回が今日なら今日だけ(グラフが空にならないように)
 */
export function daysSince(lastVisitDate: string | null | undefined, t: string): string[] {
  if (lastVisitDate == null) return last30(t)
  const ds = daysBetween(addDays(lastVisitDate, 1), t)
  return ds.length > 0 ? ds : [t]
}

/** その月の日付(1日〜末日) */
export function monthDays(y: number, m: number): string[] {
  const first = dateKey(y, m, 1)
  const last = fromUtc(new Date(Date.UTC(y, m, 0)))
  return daysBetween(first, last)
}

/** その週の月曜 */
export const monday = (key: string): string => addDays(key, -(isoWeekday(key) - 1))
