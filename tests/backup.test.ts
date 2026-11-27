import { describe, expect, it } from 'vitest'
import { BackupFormatError, backupSize, emptyBackup, parseBackup, planMerge, toJson, type BackupData } from '../src/data/backup'
import { COUN, DOC } from '../src/data/entities'

// Android 版 BackupTest.kt と同じ確認
const data: BackupData = {
  sleeps: [{ date: '2026-11-13', sleepMin: 40, wakeMin: 425, napSleepMin: 780, napWakeMin: 870, updatedAt: 1 }],
  conditions: [{ id: 5, date: '2026-11-13', timeMin: 560, mind: 3, body: null, note: '朝は眠い', updatedAt: 2 }],
  memos: [
    { id: 7, text: '夜中に目が覚める', kind: DOC, createdAt: 3, talkedAt: null, pinned: false },
    { id: 8, text: '涙が出た', kind: null, createdAt: 4, talkedAt: 9, pinned: false },
  ],
  visits: [{ id: 1, date: '2026-10-30', kind: COUN, talkedSummary: '緊張する', feedback: '書き出す', createdAt: 5 }],
  appointments: [
    { kind: DOC, date: '2026-12-11', timeMin: 630 },
    { kind: COUN, date: '2026-12-01', timeMin: null },
  ],
  aiSummaries: [{ kind: DOC, text: '1. 睡眠', savedAt: 6 }],
}

const withoutId = <T extends { id?: number }>(xs: T[]) => xs.map(({ id: _, ...rest }) => rest)

describe('backup', () => {
  it('round trip', () => {
    const back = parseBackup(toJson(data))
    expect(back.sleeps).toEqual(data.sleeps)
    expect(back.appointments).toEqual(data.appointments)
    expect(back.aiSummaries).toEqual(data.aiSummaries)
    // id は入れ直すときに振り直すので持たない
    expect(back.conditions).toEqual(withoutId(data.conditions))
    expect(back.memos).toEqual(withoutId(data.memos))
    expect(back.conditions[0].body).toBeNull()
    expect(back.memos[1].talkedAt).toBe(9)
  })

  it('null の項目は書かない（Android 版と同じ）', () => {
    const json = JSON.parse(toJson(data))
    expect(json.format).toBe('shinsatsu-note')
    expect(json.version).toBe(1)
    expect('body' in json.condition_records[0]).toBe(false)
    expect('timeMin' in json.appointments[1]).toBe(false)
    expect(json.consult_memos[0].pinned).toBe(false)
  })

  it('rejects other files', () => {
    expect(() => parseBackup('not json')).toThrow(BackupFormatError)
    expect(() => parseBackup('{"format":"other"}')).toThrow(BackupFormatError)
    expect(() => parseBackup('{"format":"shinsatsu-note","version":1,"sleep_records":[{"date":1}]}')).toThrow(BackupFormatError)
    expect(() => parseBackup('{"format":"shinsatsu-note","version":2}')).toThrow('新しい版')
  })

  it('Android 版が書き出した形を読める', () => {
    const android = `{"format":"shinsatsu-note","version":1,"exportedAt":1,
      "sleep_records":[{"date":"2026-11-13","sleepMin":40,"wakeMin":425,"updatedAt":1}],
      "condition_records":[{"date":"2026-11-13","timeMin":560,"mind":3,"note":"","updatedAt":2}],
      "consult_memos":[{"text":"a","createdAt":3,"pinned":true}],
      "visits":[],"appointments":[{"kind":"doc","date":"2026-12-11"}],"ai_summaries":[]}`
    const b = parseBackup(android)
    expect(b.sleeps[0].napSleepMin).toBeNull()
    expect(b.conditions[0].body).toBeNull()
    expect(b.memos[0]).toEqual({ text: 'a', kind: null, createdAt: 3, talkedAt: null, pinned: true })
    expect(b.appointments[0].timeMin).toBeNull()
  })

  it('merge twice does not grow', () => {
    const incoming = parseBackup(toJson(data))
    expect(backupSize(planMerge(emptyBackup(), incoming))).toBe(backupSize(data))
    // 入れたあとの状態にもう一度読み込んでも、足すものはない
    expect(backupSize(planMerge(data, incoming))).toBe(0)
  })

  it('merge overwrites by key and skips duplicates in file', () => {
    const current: BackupData = {
      ...emptyBackup(),
      sleeps: [{ date: '2026-11-13', sleepMin: 0, wakeMin: 400, napSleepMin: null, napWakeMin: null, updatedAt: 0 }],
      appointments: [{ kind: DOC, date: '2026-11-20', timeMin: null }],
    }
    const incoming = { ...data, conditions: [...data.conditions, ...data.conditions] }
    const plan = planMerge(current, incoming)
    expect(plan.sleeps.length).toBe(1)
    expect(plan.conditions.length).toBe(1)
    expect(plan.appointments.length).toBe(2)
  })
})
