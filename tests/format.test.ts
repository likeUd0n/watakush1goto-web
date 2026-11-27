import { describe, expect, it } from 'vitest'
import { COUN, DOC } from '../src/data/entities'
import { looksLikeCrisis } from '../src/domain/crisis'
import { addDays, daysSince, mdw, monday, monthDays } from '../src/domain/date'
import { diffMin, dueKinds, durJ, durShort, hm, levelWord, napMin, nightMin, totalMin } from '../src/domain/format'

// Android 版 FormatTest.kt と同じ確認
const today = '2026-11-13'

describe('format', () => {
  it('formats', () => {
    expect(mdw(today)).toBe('11/13(金)')
    expect(mdw(addDays(today, 2))).toBe('11/15(日)')
    expect(hm(425)).toBe('07:05')
    expect(hm(1440)).toBe('00:00')
    expect(durJ(366)).toBe('6時間6分')
    expect(durShort(366)).toBe('6h06')
    expect(levelWord(1)).toBe('とてもつらい')
    expect(levelWord(3)).toBe('ふつう')
    expect(levelWord(5)).toBe('楽')
    expect(diffMin(23 * 60, 60)).toBe(120)
  })

  it('sleep across midnight', () => {
    const r = { date: today, sleepMin: 23 * 60 + 30, wakeMin: 7 * 60, napSleepMin: 13 * 60, napWakeMin: 14 * 60 + 30, updatedAt: 0 }
    expect(nightMin(r)).toBe(450)
    expect(napMin(r)).toBe(90)
    expect(totalMin(r)).toBe(540)
    expect(napMin({ ...r, napWakeMin: null })).toBe(0)
  })

  it('period since last visit', () => {
    expect(daysSince(null, today).length).toBe(30)
    expect(daysSince(null, today)[0]).toBe(addDays(today, -29))
    expect(daysSince('2026-11-10', today)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13'])
    // 前回が今日なら今日だけ
    expect(daysSince('2026-11-13', today)).toEqual([today])
  })

  it('due banner only on today or that day', () => {
    const appts = {
      [DOC]: { kind: DOC, date: '2026-11-10', timeMin: 630 },
      [COUN]: { kind: COUN, date: '2026-11-20', timeMin: null },
    }
    expect(dueKinds(today, today, [DOC, COUN], appts)).toEqual([DOC])
    expect(dueKinds('2026-11-10', today, [DOC, COUN], appts)).toEqual([DOC])
    expect(dueKinds('2026-11-12', today, [DOC, COUN], appts)).toEqual([])
    expect(dueKinds(today, today, [COUN], appts)).toEqual([])
  })

  it('calendar helpers', () => {
    expect(monthDays(2026, 2).length).toBe(28)
    expect(monthDays(2028, 2).length).toBe(29)
    expect(monday('2026-11-15')).toBe('2026-11-09')
    expect(monday('2026-11-09')).toBe('2026-11-09')
  })

  it('crisis words', () => {
    expect(looksLikeCrisis('しにたいと思った')).toBe(true)
    expect(looksLikeCrisis('消え たい')).toBe(true)
    expect(looksLikeCrisis('ＯＤした')).toBe(true)
    expect(looksLikeCrisis('ODDな日')).toBe(false)
    expect(looksLikeCrisis('朝がだるい')).toBe(false)
  })
})
