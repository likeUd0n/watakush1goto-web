import { useEffect, useState } from 'preact/hooks'
import { BackupFormatError, parseBackup, toJson } from './data/backup'
import { AppDb } from './data/db'
import type { AppData, Appointment, ConditionRecord, ConsultMemo, SleepRecord } from './data/entities'
import { Repository } from './data/repository'
import { loadSettings, saveSettings, type AppSettings } from './data/settings'
import { parseAiAnswer } from './domain/aiPrompt'
import { looksLikeCrisis } from './domain/crisis'
import { today } from './domain/date'

// 画面が使う状態と操作（Android 版 ui/AppViewModel.kt にあたる）

/** 下に出すお知らせ。undo があれば「元に戻す」を付ける */
export interface Toast {
  id: number
  message: string
  undo?: () => Promise<unknown>
}

interface State {
  data: AppData | null
  settings: AppSettings
  toast: Toast | null
  /** 相談窓口のシートを出すか */
  crisis: boolean
  /** 記録タブで選んでいる日(サブ画面から戻っても保つ) */
  selectedDate: string
  /** 診察タブのモード("prep" = 準備 / "show" = 見せる) */
  visitMode: 'prep' | 'show'
}

export const repo = new Repository(new AppDb())

let state: State = {
  data: null,
  settings: loadSettings(),
  toast: null,
  crisis: false,
  selectedDate: today(),
  visitMode: 'prep',
}
const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const getState = () => state

export function useApp(): State {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return state
}

export async function refresh() {
  set({ data: await repo.load() })
}

let toastSeq = 0
export function toast(message: string, undo?: () => Promise<unknown>) {
  set({ toast: { id: ++toastSeq, message, undo } })
}
export const dismissToast = (id: number) => {
  if (state.toast?.id === id) set({ toast: null })
}
export async function runUndo(t: Toast) {
  dismissToast(t.id)
  await t.undo?.()
  await refresh()
}

export const setSelectedDate = (d: string) => set({ selectedDate: d })
export const setVisitMode = (m: 'prep' | 'show') => set({ visitMode: m })
export const dismissCrisis = () => set({ crisis: false })

/** 危機を示す語があれば相談窓口を出す。出したら true */
function checkCrisis(text: string): boolean {
  if (!looksLikeCrisis(text)) return false
  set({ crisis: true })
  return true
}

function updateSettings(patch: Partial<AppSettings>) {
  const s = { ...state.settings, ...patch }
  saveSettings(s)
  set({ settings: s })
}

// ---- 睡眠 ----
export async function saveSleep(r: SleepRecord) {
  await repo.saveSleep(r)
  await refresh()
  toast('保存しました')
}

export async function deleteSleep(date: string) {
  const old = await repo.deleteSleep(date)
  await refresh()
  if (old) toast('削除しました', () => repo.restoreSleep(old))
}

// ---- 調子 ----
/** すべて空なら何も増やさない */
export async function saveCondition(
  editing: ConditionRecord | null,
  date: string,
  timeMin: number,
  mind: number | null,
  body: number | null,
  note: string,
) {
  const text = note.trim()
  if (!editing && mind == null && body == null && text === '') return
  if (editing) await repo.updateCondition({ ...editing, mind, body, note: text })
  else await repo.addCondition({ date, timeMin, mind, body, note: text, updatedAt: Date.now() })
  await refresh()
  checkCrisis(text)
  toast('保存しました')
}

export async function deleteCondition(r: ConditionRecord) {
  await repo.deleteCondition(r)
  await refresh()
  toast('削除しました', () => repo.restoreCondition(r))
}

// ---- 話すこと ----
export async function addMemo(text: string, kind: string | null, pinned: boolean) {
  const t = text.trim()
  if (t === '') return
  await repo.addMemo(t, kind, pinned)
  await refresh()
  if (!checkCrisis(t)) toast('話すことに追加しました')
}

export async function updateMemo(m: ConsultMemo, text: string, kind: string | null, pinned: boolean) {
  const t = text.trim()
  if (t === '' || (t === m.text && kind === m.kind && pinned === m.pinned)) return
  await repo.updateMemo({ ...m, text: t, kind, pinned })
  await refresh()
  if (!checkCrisis(t)) toast('直しました')
}

export async function deleteMemo(m: ConsultMemo) {
  await repo.deleteMemo(m)
  await refresh()
  toast('消しました', () => repo.restoreMemo(m))
}

export async function returnTalked(m: ConsultMemo) {
  await repo.returnTalked(m)
  await refresh()
  toast('話すことへ戻しました')
}

// ---- 診察・カウンセリング ----
export async function recordVisit(kind: string, date: string, talkedIds: Set<number>, feedback: string, next: Appointment | null) {
  await repo.recordVisit(kind, date, talkedIds, feedback.trim(), next)
  await refresh()
  toast('記録しました')
}

export async function setAppointments(values: Record<string, Appointment | null>) {
  await repo.setAppointments(values)
  await refresh()
  toast('予定を保存しました')
}

// ---- AIの整理 ----
/** 貼られた答えを相手ごとに分けて保存し、「メモ: #番号」の相手を付け替える */
export async function saveAiAnswer(raw: string, kinds: string[]) {
  if (raw.trim() === '' || kinds.length === 0) return
  const parsed = parseAiAnswer(raw, kinds)
  await repo.saveAiSummaries(parsed.summaries)
  const n = kinds.length >= 2 ? await repo.tagMemos(parsed.tags) : 0
  await refresh()
  toast(n > 0 ? `保存し、${n}件を自動で分けました` : '保存しました')
}

export async function clearAiSummaries() {
  const old = await repo.clearAiSummaries()
  await refresh()
  if (old.length > 0) toast('消しました', () => repo.restoreAiSummaries(old))
}

// ---- 設定 ----
export const setUse = (kind: string, on: boolean) => updateSettings(kind === 'doc' ? { useDoc: on } : { useCoun: on })
export const setOnboardingDone = () => updateSettings({ onboardingDone: true })
export const setAiGuideDone = () => updateSettings({ aiGuideDone: true })
export const setInstallGuideDone = () => updateSettings({ installGuideDone: true })

/**
 * 記録をファイルに書き出す。共有できる環境では OS の共有画面に渡し(Google ドライブなどを選べる)、
 * できなければダウンロードする。Android の Chrome は .json を共有できないので .txt で渡す
 */
export async function exportBackup() {
  const json = toJson(await repo.snapshot())
  const name = `watakushigoto-${today()}.txt`
  const file = new File([json], name, { type: 'text/plain' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name })
    } else {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }
  } catch (e) {
    // 共有画面を閉じただけなら何も言わない
    if (e instanceof DOMException && e.name === 'AbortError') return
    toast('書き出せませんでした')
    return
  }
  updateSettings({ lastExportAt: Date.now() })
  toast('書き出しました')
}

/** ファイルを読み込んで今のデータに足す */
export async function importBackup(file: File) {
  try {
    const n = await repo.merge(parseBackup(await file.text()))
    await refresh()
    toast(n > 0 ? `${n}件を読み込みました` : '新しい記録はありませんでした')
  } catch (e) {
    toast('読み込めませんでした' + (e instanceof BackupFormatError ? `（${e.message}）` : ''))
  }
}
