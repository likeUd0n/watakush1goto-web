import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseBackup, toJson } from '../src/data/backup'
import { AppDb } from '../src/data/db'
import { COUN, DOC } from '../src/data/entities'
import { Repository } from '../src/data/repository'

let n = 0
let repo: Repository

beforeEach(() => {
  repo = new Repository(new AppDb(`test-${n++}`))
})

describe('repository', () => {
  it('記録すると話すことが話したことへ移り、AIの整理と済んだ予定が消える', async () => {
    const a = await repo.addMemo('夜中に目が覚める', DOC, false)
    await repo.addMemo('次回へ残す', null, false)
    await repo.saveAiSummaries({ [DOC]: '1. 睡眠', [COUN]: '1. 気持ち' })
    await repo.setAppointments({ [DOC]: { kind: DOC, date: '2026-11-13', timeMin: 630 } })
    await repo.recordVisit(DOC, '2026-11-13', new Set([a]), '睡眠リズム優先', { kind: DOC, date: '2026-12-11', timeMin: null })
    const d = await repo.load()
    expect(d.memos.map((m) => m.text)).toEqual(['次回へ残す'])
    expect(d.talked.map((m) => m.text)).toEqual(['夜中に目が覚める'])
    expect(d.visits[0].talkedSummary).toBe('夜中に目が覚める')
    expect(d.aiSummaries[DOC]).toBeUndefined()
    expect(d.aiSummaries[COUN]?.text).toBe('1. 気持ち')
    expect(d.appointments[DOC].date).toBe('2026-12-11')
  })

  it('AIの振り分けは固定指定のメモを上書きしない', async () => {
    const a = await repo.addMemo('a', null, false)
    const b = await repo.addMemo('b', DOC, true)
    expect(await repo.tagMemos(new Map([[a, COUN], [b, COUN]]))).toBe(1)
    const d = await repo.load()
    expect(d.memos.find((m) => m.id === a)?.kind).toBe(COUN)
    expect(d.memos.find((m) => m.id === b)?.kind).toBe(DOC)
  })

  it('書き出したものを読み込むと増え、2回目は増えない', async () => {
    await repo.saveSleep({ date: '2026-11-13', sleepMin: 40, wakeMin: 425, napSleepMin: null, napWakeMin: null, updatedAt: 0 })
    await repo.addCondition({ date: '2026-11-13', timeMin: 560, mind: 3, body: 4, note: '', updatedAt: 0 })
    await repo.addMemo('a', null, false)
    const json = toJson(await repo.snapshot())

    const other = new Repository(new AppDb(`test-${n++}`))
    expect(await other.merge(parseBackup(json))).toBe(3)
    expect(await other.merge(parseBackup(json))).toBe(0)
    const d = await other.load()
    expect(d.conditions['2026-11-13'].length).toBe(1)
    expect(d.sleeps['2026-11-13'].wakeMin).toBe(425)
  })
})
