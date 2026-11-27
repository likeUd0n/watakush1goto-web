import { COUN, DOC, conditionsOn, kindLabel, lastVisit, type AppData } from '../data/entities'
import { looksLikeCrisis } from './crisis'
import { dateOfMillis, daysSince, md, mdw } from './date'
import { durJ, totalMin } from './format'

// 外部のAIアプリに渡す文を作り、返ってきた答えを相手ごとに分ける（Android 版 domain/AiPrompt.kt と同じ）。
// アプリの中でAIは呼ばない。文を作る処理は、ここに独立させておく

/** 渡す文と、危機を示す語があって外した件数 */
export interface AiPrompt {
  text: string
  excluded: number
}

const FOOTER_GUIDE =
  '前置きや挨拶・励ましなどの余計な文章は書かず、要約だけを出力してください。' +
  '最後に1行あけて、次の1行だけをそのまま添えてください：\n' +
  '※この返答をコピーして、アプリの「答えを貼る」に貼り付けてください。'

const ASK_BOTH =
  '次の精神科・心療内科の診察（5〜10分）とカウンセリングに向けて、下のメモと記録を整理してください。' +
  'まず各メモを【診察】か【カウンセリング】に振り分け、それぞれ大事な順に3つまで1〜2文で要約してください。' +
  '【必ず診察】【必ずカウンセリング】が付いているメモは、指定された相手から動かさず必ず要約に含めてください。' +
  '診察は睡眠・調子の変化・薬のこと、カウンセリングは出来事と気持ちを中心にしてください。診断や断定はしないでください。\n' +
  `${FOOTER_GUIDE}\n\n` +
  '出力形式：\n【診察】\nメモ: #番号, #番号\n1. ...\n\n【カウンセリング】\nメモ: #番号\n1. ...'

const ASK_DOC =
  '次の精神科・心療内科の診察（5〜10分）で、医師に伝えたいことを、大事な順に3つまで、1つ1〜2文で挙げてください。' +
  '【必ず相談したい】が付いているメモは、必ず要約に含めてください。' +
  '睡眠と調子の変化、薬について気になることを優先してください。診断や断定はしないでください。\n' +
  FOOTER_GUIDE

const ASK_COUN =
  '次のカウンセリングで話したいことを、大事な順に3つまで挙げてください。' +
  '【必ず相談したい】が付いているメモは、必ず要約に含めてください。' +
  '出来事と、そのときの気持ちを中心にしてください。診断や断定はしないでください。\n' +
  FOOTER_GUIDE

/**
 * 渡す文を作る。指示文＋前回のアドバイス＋未相談のメモ＋前回からの記録。
 * 両方使うときは、前回から長いほうの期間をまとめて渡し、メモに #番号 を付けて振り分けてもらう。
 * dateOf はメモの作成日時を日付にする関数(テストで時差を固定するため)
 */
export function buildAiPrompt(
  data: AppData,
  kinds: string[],
  today: string,
  dateOf: (ms: number) => string = dateOfMillis,
): AiPrompt {
  if (kinds.length === 0) throw new Error('kinds is empty')
  const both = kinds.length >= 2
  const days = kinds
    .map((k) => daysSince(lastVisit(data, k)?.date, today))
    .reduce((a, b) => (b.length > a.length ? b : a))
  let excluded = 0

  const memoLines =
    data.memos
      .filter((m) => {
        if (looksLikeCrisis(m.text)) {
          excluded++
          return false
        }
        return true
      })
      .map((m) => {
        const d = md(dateOf(m.createdAt))
        const pin = !m.pinned ? '' : both && m.kind != null ? `【必ず${kindLabel(m.kind)}】 ` : '【必ず相談したい】 '
        return both ? `[#${m.id}] ${pin}${d} ${m.text}` : `${pin}${d} ${m.text}`
      })
      .join('\n') || '(なし)'

  const avg = (values: (number | null)[]) => {
    const xs = values.filter((v): v is number => v != null)
    return xs.length > 0 ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '-'
  }
  const recordLines = [...days]
    .reverse()
    .flatMap((d) => {
      const sr = data.sleeps[d]
      const conds = conditionsOn(data, d)
      if (!sr && conds.length === 0) return []
      const t = sr ? totalMin(sr) : 0
      const sleep = t > 0 ? durJ(t) : '-'
      const notes = conds
        .map((c) => c.note)
        .filter((n) => {
          if (n === '') return false
          if (looksLikeCrisis(n)) {
            excluded++
            return false
          }
          return true
        })
        .join(' / ')
      const line = `${md(d)} ココロ${avg(conds.map((c) => c.mind))} カラダ${avg(conds.map((c) => c.body))} 睡眠 ${sleep}`
      return [notes !== '' ? `${line} ${notes}` : line]
    })
    .join('\n')

  const prevs = kinds
    .flatMap((k) => {
      const v = lastVisit(data, k)
      return v ? [`― 前回の${kindLabel(k)}（${mdw(v.date)}）でのアドバイス ―\n${v.feedback}`] : []
    })
    .join('\n\n')

  const ask = both ? ASK_BOTH : kinds[0] === DOC ? ASK_DOC : ASK_COUN
  let text = ask
  if (prevs !== '') text += `\n\n${prevs}`
  text += `\n\n― メモ ―\n${memoLines}`
  text += `\n\n― 記録（${md(days[0])}〜${md(days[days.length - 1])}） ―\n${recordLines}`
  return { text, excluded }
}

/** AIの答えを分けたもの。summaries は相手ごとの要約、tags は「メモ: #番号」で分かったメモの相手 */
export interface ParsedAi {
  summaries: Record<string, string>
  tags: Map<number, string>
}

// 【診察】 / [カウンセリング] / 診察向け: / **【診察】** / ## 診察 などの見出し（後ろに「メモ:」が同行で続く場合も含む）
const SECTION = /^[ \t#*]*(?:【|\[)?(診察|カウンセリング)(?:向け)?(?:】|\])?[*]*[：:]?(?=[ \t]*(?:$|[*・-]*メモ[*]*[：:]))/gm
const MEMO_LINE = /^[ \t*・-]*メモ[*]*[：:]/
const MEMO_ID = /#(\d+)/g
const FOOTER_LINE = /^[ \t*・※-]*この返答をコピーして.*/
const HR_LINE = /^[ \t]*[-*_―─]{3,}[ \t]*$/

const isBlank = (s: string) => s.trim() === ''

function stripFooter(text: string): string {
  const lines = text.split('\n')
  while (lines.length > 0 && isBlank(lines[lines.length - 1])) lines.pop()
  while (lines.length > 0 && (FOOTER_LINE.test(lines[lines.length - 1]) || HR_LINE.test(lines[lines.length - 1]))) {
    lines.pop()
    while (lines.length > 0 && isBlank(lines[lines.length - 1])) lines.pop()
  }
  return lines.join('\n').trim()
}

/**
 * 答えから【診察】【カウンセリング】の要約と、「メモ: #番号」の振り分けを取り出す。
 * 末尾に付けた貼り付け案内行は自動で取り除く。
 * 見出しがなければ全体を1つの要約として、両方使うときは診察へ、片方ならその相手へ入れる
 */
export function parseAiAnswer(raw: string, kinds: string[]): ParsedAi {
  const text = stripFooter(raw.replace(/\r\n/g, '\n').trim())
  const hits = [...text.matchAll(SECTION)]
  if (hits.length === 0) {
    const target = kinds.length >= 2 ? DOC : kinds[0]
    return { summaries: { [target]: text }, tags: new Map() }
  }
  const summaries: Record<string, string> = {}
  const tags = new Map<number, string>()
  hits.forEach((h, i) => {
    const kind = h[1] === '診察' ? DOC : COUN
    const end = i + 1 < hits.length ? hits[i + 1].index! : text.length
    const body = text.substring(h.index! + h[0].length, end)
    const kept = body
      .split('\n')
      .filter((line) => {
        if (MEMO_LINE.test(line)) {
          for (const m of line.matchAll(MEMO_ID)) tags.set(Number(m[1]), kind)
          return false
        }
        return true
      })
      .join('\n')
      .trim()
    if (kept !== '') summaries[kind] = kept
  })
  return { summaries, tags }
}
