import type { Appointment, ConditionRecord, SleepRecord } from '../data/entities'
import { daysBetweenCount, today as todayKey } from './date'

// 時間の書式と、記録からの計算。画面にもAIに渡す文にも使う（Android 版 domain/Format.kt と同じ）

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 0:00 からの分 → 07:05 */
export function hm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

/** 分 → 6時間6分 */
export const durJ = (min: number): string => `${Math.floor(min / 60)}時間${min % 60}分`

/** 分 → 6h06(週の行の平均睡眠) */
export const durShort = (min: number): string => `${Math.floor(min / 60)}h${pad2(min % 60)}`

/** a から b まで(日をまたいでもよい)の分 */
export const diffMin = (a: number, b: number): number => ((((b - a) % 1440) + 1440) % 1440)

export const nightMin = (r: SleepRecord): number => diffMin(r.sleepMin, r.wakeMin)
export const napMin = (r: SleepRecord): number =>
  r.napSleepMin != null && r.napWakeMin != null ? diffMin(r.napSleepMin, r.napWakeMin) : 0
export const totalMin = (r: SleepRecord): number => nightMin(r) + napMin(r)

const average = (xs: number[]): number | null => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** その日のココロ(またはカラダ)の平均。記録が無ければ null */
export const avgMind = (rs: ConditionRecord[]): number | null =>
  average(rs.map((r) => r.mind).filter((v): v is number => v != null))
export const avgBody = (rs: ConditionRecord[]): number | null =>
  average(rs.map((r) => r.body).filter((v): v is number => v != null))

/** 平均を1〜5に丸める(Kotlin の roundToInt と同じく .5 は切り上げ) */
export const level = (v: number): number => Math.min(5, Math.max(1, Math.round(v)))

const LEVEL_WORDS = ['とてもつらい', 'つらい', 'ふつう', '少し楽', '楽']

/** ココロ・カラダの段階(1〜5)を言葉にする */
export const levelWord = (lv: number): string => LEVEL_WORDS[Math.min(5, Math.max(1, lv)) - 1]

/** 予定まであと何日(当日 0、過ぎていれば負) */
export const daysLeft = (a: Appointment, t: string): number => daysBetweenCount(t, a.date)

/** あと12日 / 今日 / 記録待ち */
export function leftText(a: Appointment, t: string): string {
  const left = daysLeft(a, t)
  if (left > 0) return `あと${left}日`
  if (left === 0) return '今日'
  return '記録待ち'
}

/**
 * 記録タブの通知バナーに出す相手。予定日当日か、過ぎて未記録の予定があり、
 * 選んでいる日が「今日」か「その予定日」のときだけ出す
 */
export function dueKinds(
  selected: string,
  t: string,
  kinds: string[],
  appointments: Record<string, Appointment>,
): string[] {
  return kinds.filter((k) => {
    const a = appointments[k]
    if (!a) return false
    return daysLeft(a, t) <= 0 && (selected === t || selected === a.date)
  })
}

/** いまの時刻(0:00 からの分) */
export function nowMin(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes()
}

export { todayKey }
