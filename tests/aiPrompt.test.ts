import { describe, expect, it } from 'vitest'
import { COUN, DOC, emptyData, type AppData } from '../src/data/entities'
import { buildAiPrompt, parseAiAnswer } from '../src/domain/aiPrompt'

// Android 版 AiPromptTest.kt と同じ確認
const today = '2026-11-13'
const millis = (d: string) => Date.parse(`${d}T00:00:00Z`)
const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const data: AppData = {
  ...emptyData(),
  sleeps: { '2026-11-12': { date: '2026-11-12', sleepMin: 30, wakeMin: 420, napSleepMin: null, napWakeMin: null, updatedAt: 0 } },
  conditions: {
    '2026-11-12': [
      { id: 1, date: '2026-11-12', timeMin: 9 * 60, mind: 2, body: 3, note: '朝がだるい', updatedAt: 0 },
      { id: 2, date: '2026-11-12', timeMin: 19 * 60, mind: 4, body: 3, note: '消えたい', updatedAt: 0 },
    ],
  },
  memos: [
    { id: 3, text: '夜中に目が覚める', kind: null, createdAt: millis('2026-11-10'), talkedAt: null, pinned: false },
    { id: 4, text: 'しにたいと思った', kind: null, createdAt: millis('2026-11-11'), talkedAt: null, pinned: false },
  ],
  visits: [{ id: 1, date: '2026-11-01', kind: DOC, talkedSummary: '-', feedback: '睡眠リズム優先', createdAt: 0 }],
}

describe('buildAiPrompt', () => {
  it('both kinds tags memos and excludes crisis', () => {
    const p = buildAiPrompt(data, [DOC, COUN], today, utcDate)
    expect(p.excluded).toBe(2)
    expect(p.text.startsWith('次の精神科・心療内科の診察（5〜10分）とカウンセリング')).toBe(true)
    expect(p.text).toContain('[#3] 11/10 夜中に目が覚める')
    expect(p.text).not.toContain('しにたい')
    expect(p.text).not.toContain('消えたい')
    expect(p.text).toContain('― 前回の診察（11/1(日)）でのアドバイス ―\n睡眠リズム優先')
    // カウンセリングは前回が無いので30日。長いほうの期間を渡す
    expect(p.text).toContain('― 記録（10/15〜11/13） ―')
    expect(p.text).toContain('11/12 ココロ3.0 カラダ3.0 睡眠 6時間30分 朝がだるい')
  })

  it('single kind has no ids', () => {
    const p = buildAiPrompt(data, [DOC], today, utcDate)
    expect(p.text).toContain('\n11/10 夜中に目が覚める')
    expect(p.text).toContain('― 記録（11/2〜11/13） ―')
    expect(p.text.startsWith('次の精神科・心療内科の診察（5〜10分）で、医師に')).toBe(true)
  })

  it('pinned memo includes routing tag', () => {
    const d: AppData = {
      ...emptyData(),
      memos: [
        { id: 10, text: '薬の副作用がつらい', kind: DOC, createdAt: millis('2026-11-10'), talkedAt: null, pinned: true },
        { id: 11, text: '家族との会話', kind: COUN, createdAt: millis('2026-11-11'), talkedAt: null, pinned: true },
        { id: 12, text: '普通のメモ', kind: null, createdAt: millis('2026-11-12'), talkedAt: null, pinned: false },
      ],
    }
    const both = buildAiPrompt(d, [DOC, COUN], today, utcDate)
    expect(both.text).toContain('[#10] 【必ず診察】 11/10 薬の副作用がつらい')
    expect(both.text).toContain('[#11] 【必ずカウンセリング】 11/11 家族との会話')
    expect(both.text).toContain('[#12] 11/12 普通のメモ')
    const single = buildAiPrompt(d, [DOC], today, utcDate)
    expect(single.text).toContain('【必ず相談したい】 11/10 薬の副作用がつらい')
  })
})

describe('parseAiAnswer', () => {
  it('parse sections', () => {
    const raw = 'はい、整理しました。\r\n\r\n**【診察】**\r\nメモ: #3, #5\r\n1. 夜中に目が覚める\r\n\r\n【カウンセリング】\nメモ：#4\n1. 涙が出た'
    const r = parseAiAnswer(raw, [DOC, COUN])
    expect(r.summaries[DOC]).toBe('1. 夜中に目が覚める')
    expect(r.summaries[COUN]).toBe('1. 涙が出た')
    expect(Object.fromEntries(r.tags)).toEqual({ 3: DOC, 5: DOC, 4: COUN })
  })

  it('free text goes to one kind', () => {
    expect(parseAiAnswer('1. a', [DOC, COUN]).summaries).toEqual({ [DOC]: '1. a' })
    expect(parseAiAnswer(' 1. a ', [COUN]).summaries).toEqual({ [COUN]: '1. a' })
  })

  it('heading inside sentence is not section', () => {
    const r = parseAiAnswer('次の診察では\n眠りのことを話す', [DOC, COUN])
    expect(Object.keys(r.summaries).length).toBe(1)
    expect(r.tags.size).toBe(0)
  })

  it('sections with inline memo line', () => {
    const raw = '【診察】 メモ: #1, #2, #5, #6\n1. 睡眠リズムの乱れ\n\n**【カウンセリング】** **メモ：** #3, #4\n1. 仕事での不安'
    const r = parseAiAnswer(raw, [DOC, COUN])
    expect(r.summaries[DOC]).toBe('1. 睡眠リズムの乱れ')
    expect(r.summaries[COUN]).toBe('1. 仕事での不安')
    expect(Object.fromEntries(r.tags)).toEqual({ 1: DOC, 2: DOC, 5: DOC, 6: DOC, 3: COUN, 4: COUN })
  })

  it('strips footer guide on paste', () => {
    const raw = '【診察】\nメモ: #3\n1. 夜中に目が覚める\n\n---\n※この返答をコピーして、アプリの「答えを貼る」に貼り付けてください。'
    const r = parseAiAnswer(raw, [DOC, COUN])
    expect(r.summaries[DOC]).toBe('1. 夜中に目が覚める')
    expect(Object.fromEntries(r.tags)).toEqual({ 3: DOC })
  })
})
