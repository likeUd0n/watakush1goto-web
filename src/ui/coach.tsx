import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { useBackClose } from '../nav'
import { PrimaryButton, SubButton } from './parts'

// 実際の画面要素を明るく切り抜いて案内するナビゲーションガイド（Android 版 ui/screens/Guide.kt と同じ文言）

export const CoachId = {
  SLEEP: 'sleep',
  CONDITION: 'condition',
  HISTORY: 'history',
  TALK: 'talk',
  VISIT_TAB: 'visit_tab',
  RECORD_GUIDE: 'record_guide',
  VISIT_SEG: 'visit_seg',
  VISIT_CAL: 'visit_cal',
  VISIT_MEMO: 'visit_memo',
  VISIT_GUIDE: 'visit_guide',
} as const

/** targetId が null なら中央カードとして出す */
export interface CoachStep {
  targetId: string | null
  title: string
  body: string
}

/**
 * 記録タブの手順。ブラウザ版は初回にホーム画面追加の案内で「ようこそ」を伝えるので、
 * Android 版の「わたくしごと へようこそ」の1枚目は出さない
 */
export function recordCoachSteps(hasVisitTab: boolean): CoachStep[] {
  const steps: CoachStep[] = [
    { targetId: CoachId.SLEEP, title: '睡眠の記録', body: '寝た・起きた時刻や二度寝を記録できます。未記録のときは薄い灰色で表示されます。' },
    { targetId: CoachId.CONDITION, title: '調子の記録', body: 'ココロとカラダを5段階とひとことで残します。1日に何度でも記録でき、押すとあとから直せます。' },
    { targetId: CoachId.HISTORY, title: '振り返り', body: '月ごとのグラフや週ごとの一覧で、調子と睡眠の推移をゆっくり振り返れます。' },
  ]
  if (hasVisitTab) {
    steps.push(
      { targetId: CoachId.TALK, title: '話すこと', body: '診察やカウンセリングで伝えたいことを書きためておけます。右の「＋」からすぐ追加できます。' },
      {
        targetId: CoachId.VISIT_TAB,
        title: '診察・カウンセリングへ',
        body: '書きためたメモをAIで整理したり、先生に見せるまとめ画面を開けます。このガイドは右上の「？」からいつでも見直せます。',
      },
    )
  } else {
    steps.push({ targetId: CoachId.RECORD_GUIDE, title: 'ナビゲーションガイド', body: '使い方に迷ったら、右上の「？」からいつでもこの案内を開き直せます。' })
  }
  return steps
}

export const visitCoachSteps = (): CoachStep[] => [
  {
    targetId: CoachId.VISIT_SEG,
    title: '「準備」と「見せる」',
    body: '「準備」で話すことやAIの整理を整え、診察室では「見せる」に切り替えて先生にそのまま見せられます。',
  },
  { targetId: CoachId.VISIT_CAL, title: '次の予定', body: '次の診察やカウンセリングの日時を登録しておくと、予定日に記録タブでお知らせが出ます。' },
  {
    targetId: CoachId.VISIT_MEMO,
    title: '話すこととAIで整理',
    body: 'メモを押すと編集や診察・カウンセリングの指定ができます。「AIで整理」で手持ちのAIに要約を頼めます。',
  },
  { targetId: CoachId.VISIT_GUIDE, title: 'ナビゲーションガイド', body: '使い方に迷ったら、右上の「？」からいつでもこの案内を開き直せます。' },
]

interface Box {
  left: number
  top: number
  width: number
  height: number
}

const PAD = 6

export function CoachMarkOverlay({ steps, onFinish }: { steps: CoachStep[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [cardH, setCardH] = useState(210)
  const card = useRef<HTMLDivElement>(null)
  useBackClose(onFinish)
  const step = steps[Math.min(index, steps.length - 1)]
  const last = index >= steps.length - 1
  const next = () => (last ? onFinish() : setIndex(index + 1))

  useLayoutEffect(() => {
    const el = step.targetId ? document.querySelector(`[data-coach="${step.targetId}"]`) : null
    if (!el) {
      setBox(null)
      return
    }
    el.scrollIntoView({ block: 'nearest' })
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step])

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight)
  }, [step, box])

  useEffect(() => {
    card.current?.querySelector<HTMLElement>('.pill.primary')?.focus()
  }, [index])

  // ツールチップの置き場所: 上下の空きを見て収まる側へ置き、画面内に収める
  const vh = window.innerHeight
  let top: number | null = null
  if (box) {
    const gap = 12
    const safeTop = 48
    const safeBottom = 56
    const spaceBelow = vh - safeBottom - (box.top + box.height)
    const spaceAbove = box.top - safeTop
    const below = box.top + box.height + gap
    const above = box.top - gap - cardH
    const raw = spaceBelow >= cardH + gap ? below : spaceAbove >= cardH + gap ? above : spaceBelow >= spaceAbove ? below : above
    top = Math.min(Math.max(raw, safeTop), Math.max(safeTop, vh - safeBottom - cardH))
  }

  return (
    <div class="coach" onClick={next}>
      {box ? <div class="coach-hole" style={{ left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }} /> : <div class="coach-dim" />}
      <div
        class={`coach-card ${box ? '' : 'center'}`}
        style={top != null ? { top: `${top}px` } : undefined}
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="coach-head">
          <b>ナビゲーションガイド</b>
          <span>
            {index + 1} / {steps.length}
          </span>
        </div>
        <h2 class="title-medium">{step.title}</h2>
        <p>{step.body}</p>
        <div class="coach-actions">
          <button type="button" class="text-btn" onClick={onFinish}>
            スキップ
          </button>
          <span class="grow" />
          {index > 0 && <SubButton text="前へ" onClick={() => setIndex(index - 1)} />}
          <PrimaryButton text={last ? 'はじめる' : '次へ'} onClick={next} />
        </div>
      </div>
    </div>
  )
}
