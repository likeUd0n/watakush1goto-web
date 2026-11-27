import { useEffect, useRef, useState } from 'preact/hooks'
import { DOC, conditionsOn, kindLabel, lastVisit, type AppData, type ConsultMemo } from '../data/entities'
import { kindsOf, type AppSettings } from '../data/settings'
import { daysSince, md, mdw, today as todayKey } from '../domain/date'
import { buildAiPrompt, type AiPrompt } from '../domain/aiPrompt'
import { durJ, hm, napMin, nightMin } from '../domain/format'
import { addMemo, clearAiSummaries, setAiGuideDone, setVisitMode } from '../store'
import { ChartHead, SleepChart, SplitMoodCharts, SummaryRow, periodAverage } from '../ui/charts'
import { CoachId } from '../ui/coach'
import { Icon } from '../ui/icons'
import {
  Card,
  CardTitle,
  Chevron,
  CountText,
  Divider,
  EmptyText,
  HeaderTile,
  IconButton,
  KindBadge,
  MiniBattery,
  MiniButton,
  MiniMind,
  PinBadge,
  Screen,
  Segmented,
  Sheet,
  SheetActions,
  SubButton,
} from '../ui/parts'
import { AiPasteSheet, AiShareSheet, AiTutorialSheet } from './aiSheets'
import { AppointmentsSheet, KindStrip, MemoAddSheet, MemoEditSheet, VisitFormSheet, VisitsSheet, createdDate } from './visitSheets'

type SheetName = 'none' | 'appointments' | 'visits' | 'addMemo'

/** 診察タブ(準備 / 見せる) */
export function VisitScreen({ data, settings, mode, onHelp }: { data: AppData; settings: AppSettings; mode: 'prep' | 'show'; onHelp: () => void }) {
  const [sheet, setSheet] = useState<SheetName>('none')
  const [editMemo, setEditMemo] = useState<ConsultMemo | null>(null)
  const [visitForm, setVisitForm] = useState<[string, string] | null>(null)
  const [aiPrompt, setAiPrompt] = useState<AiPrompt | null>(null)
  const [aiTutorial, setAiTutorial] = useState(false)
  const [paste, setPaste] = useState(false)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const kinds = kindsOf(settings)
  if (kinds.length === 0) return null

  const openAiShare = () => {
    const p = buildAiPrompt(data, kinds, todayKey())
    setLastPrompt(p.text)
    setAiPrompt(p)
  }

  return (
    <Screen>
      <div class="top-row gap6">
        <Segmented
          options={[
            ['prep', '準備'],
            ['show', '見せる'],
          ]}
          selected={mode}
          onSelect={setVisitMode}
          coach={CoachId.VISIT_SEG}
          class="grow"
        />
        <HeaderTile icon="cal" label="次の予定" onClick={() => setSheet('appointments')} coach={CoachId.VISIT_CAL} />
        <HeaderTile icon="help" label="ナビゲーションガイド" onClick={onHelp} coach={CoachId.VISIT_GUIDE} />
      </div>
      {mode === 'prep' ? (
        <PrepPane
          data={data}
          kinds={kinds}
          onAddMemo={() => setSheet('addMemo')}
          onEditMemo={setEditMemo}
          onOpenVisits={() => setSheet('visits')}
          onAi={() => (settings.aiGuideDone ? openAiShare() : setAiTutorial(true))}
          onPaste={() => setPaste(true)}
        />
      ) : (
        <ShowPane data={data} kinds={kinds} />
      )}

      {sheet === 'appointments' && <AppointmentsSheet data={data} settings={settings} onDismiss={() => setSheet('none')} />}
      {sheet === 'visits' && (
        <VisitsSheet
          data={data}
          settings={settings}
          onAddVisit={() => {
            setSheet('none')
            setVisitForm([kinds[0], todayKey()])
          }}
          onDismiss={() => setSheet('none')}
        />
      )}
      {sheet === 'addMemo' && (
        <MemoAddSheet
          kinds={kinds}
          onDismiss={() => setSheet('none')}
          onAdd={(text, kind, pinned) => {
            addMemo(text, kind, pinned)
            setSheet('none')
          }}
        />
      )}
      {editMemo && <MemoEditSheet memo={editMemo} kinds={kinds} onDismiss={() => setEditMemo(null)} />}
      {visitForm && <VisitFormSheet data={data} settings={settings} kind0={visitForm[0]} date0={visitForm[1]} onDismiss={() => setVisitForm(null)} />}
      {aiTutorial && (
        <AiTutorialSheet
          onContinue={() => {
            setAiTutorial(false)
            if (!settings.aiGuideDone) setAiGuideDone()
            openAiShare()
          }}
          onDismiss={() => setAiTutorial(false)}
        />
      )}
      {aiPrompt && (
        <AiShareSheet
          prompt={aiPrompt}
          onShowTutorial={() => {
            setAiPrompt(null)
            setAiTutorial(true)
          }}
          onDismiss={() => setAiPrompt(null)}
        />
      )}
      {paste && <AiPasteSheet kinds={kinds} lastPrompt={lastPrompt} onDismiss={() => setPaste(false)} />}
    </Screen>
  )
}

function PrepPane(p: {
  data: AppData
  kinds: string[]
  onAddMemo: () => void
  onEditMemo: (m: ConsultMemo) => void
  onOpenVisits: () => void
  onAi: () => void
  onPaste: () => void
}) {
  const { data, kinds } = p
  const both = kinds.length >= 2
  const [memosExpanded, setMemosExpanded] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [adviceOpen, setAdviceOpen] = useState(false)
  const memos = memosExpanded || data.memos.length <= 3 ? data.memos : data.memos.slice(0, 3)
  const aiKinds = kinds.filter((k) => data.aiSummaries[k])
  const last = kinds.flatMap((k) => {
    const v = lastVisit(data, k)
    return v ? [v] : []
  })

  return (
    <>
      {/* 話すこと(4件以上あるときは最新3件だけ見せ、残りはたたむ) */}
      <Card coach={CoachId.VISIT_MEMO}>
        <div class="row">
          <CardTitle text="話すこと" icon="talk" grow />
          {data.memos.length > 0 && <CountText text={`${data.memos.length}件`} />}
          <IconButton icon="plus" label="話すことを追加" onClick={p.onAddMemo} />
        </div>
        {data.memos.length === 0 && <EmptyText text="なし" />}
        {memos.map((m) => (
          <button type="button" class="memo-row" onClick={() => p.onEditMemo(m)} aria-label={`${m.text}(押すと直せます)`}>
            <span class="muted small memo-date">{md(createdDate(m))}</span>
            <span class="grow col gap2 min0">
              {m.pinned ? <PinBadge kind={m.kind} both={both} /> : both && m.kind != null && <KindBadge kind={m.kind} />}
              <span class="ellipsis">{m.text}</span>
            </span>
            <Chevron />
          </button>
        ))}
        {data.memos.length > 3 && (
          <button type="button" class="fold-row accent-text" aria-expanded={memosExpanded} onClick={() => setMemosExpanded(!memosExpanded)}>
            <span class="grow">{memosExpanded ? 'たたむ' : `ほか ${data.memos.length - 3}件をすべて見る`}</span>
            <Chevron open={memosExpanded} />
          </button>
        )}
        <Divider />
        <div class="row end gap8">
          <MiniButton text="AIで整理" icon="ai" tone="accent" onClick={p.onAi} />
          <MiniButton text="答えを貼る" onClick={p.onPaste} />
        </div>
      </Card>

      {/* AIの整理(貼ってあるときだけ。最初はたたむ) */}
      {aiKinds.length > 0 && (
        <Card>
          <button type="button" class="fold-row" aria-expanded={aiOpen} onClick={() => setAiOpen(!aiOpen)}>
            <CardTitle text={both ? 'AIの整理' : `AIの整理（${kindLabel(aiKinds[0])}向け）`} icon="ai" grow />
            <b class="small accent">反映済み</b>
            <Chevron open={aiOpen} />
          </button>
          {aiOpen && (
            <div class="col gap8">
              <Divider />
              {aiKinds.map((k, i) => (
                <>
                  {i > 0 && <Divider />}
                  {both && (
                    <div>
                      <KindBadge kind={k} />
                    </div>
                  )}
                  <p class="pre">{data.aiSummaries[k].text}</p>
                </>
              ))}
              <div class="row end">
                <MiniButton text="消す" onClick={clearAiSummaries} />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 前回のアドバイス(最初はたたむ) */}
      {last.length > 0 && (
        <Card>
          <button type="button" class="fold-row" aria-expanded={adviceOpen} onClick={() => setAdviceOpen(!adviceOpen)}>
            <CardTitle text="前回のアドバイス" icon="visit" grow />
            <span class="muted small">{last.length === 1 ? md(last[0].date) : `${last.length}件`}</span>
            <Chevron open={adviceOpen} />
          </button>
          {adviceOpen && (
            <div class="col gap8">
              <Divider />
              {last.map((v) => (
                <KindStrip kind={v.kind}>
                  <div class="row gap8">
                    <KindBadge kind={v.kind} />
                    <span class="muted small">{mdw(v.date)}</span>
                  </div>
                  <p class="pre">{v.feedback}</p>
                </KindStrip>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 過去の記録 */}
      <button type="button" class="past-row" onClick={p.onOpenVisits}>
        <Icon name="rec" size={18} class="muted" />
        <b class="grow">{kinds.length === 1 ? `過去の${kindLabel(kinds[0])}` : '過去の記録'}</b>
        <span class="muted small">
          {data.visits.filter((v) => kinds.includes(v.kind)).length}回・話したこと {data.talked.length}件
        </span>
        <Chevron />
      </button>
    </>
  )
}

/** 見せる(前回からの客観データを相手に伝える)。両方オンのときは下線タブ＋左右スワイプで切替 */
function ShowPane({ data, kinds }: { data: AppData; kinds: string[] }) {
  const [page, setPage] = useState(0)
  const pager = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = pager.current
    if (!el) return
    const onScroll = () => setPage(Math.round(el.scrollLeft / el.clientWidth))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [kinds.length])
  if (kinds.length < 2) return <ShowKindContent kind={kinds[0]} both={false} data={data} />
  const go = (i: number) => pager.current?.scrollTo({ left: i * pager.current.clientWidth, behavior: 'smooth' })
  return (
    <>
      <div class="kind-tabs" role="tablist">
        {kinds.map((k, i) => (
          <button type="button" role="tab" aria-selected={i === page} class={`${k === DOC ? 'doc' : 'coun'} ${i === page ? 'on' : ''}`} onClick={() => go(i)}>
            {kindLabel(k)}
          </button>
        ))}
      </div>
      <div class="pager" ref={pager}>
        {kinds.map((k) => (
          <div class="page">
            <ShowKindContent kind={k} both data={data} />
          </div>
        ))}
      </div>
    </>
  )
}

function ShowKindContent({ kind, both, data }: { kind: string; both: boolean; data: AppData }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [chartsOpen, setChartsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [memosOpen, setMemosOpen] = useState(false)
  const t = todayKey()
  const last = lastVisit(data, kind)
  const days = daysSince(last?.date, t)
  const periodText = (last ? '前回から ' : '直近 ') + (days.length === 1 ? md(days[0]) : `${md(days[0])}〜${md(days[days.length - 1])}`)

  // 今回話すこと(両方オンのときは分類済みのみ。必ず指定を先頭に。AIの整理があれば整理を主役にし、元のメモは別に開く)
  const memos = (both ? data.memos.filter((m) => m.kind === kind) : data.memos).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned))
  const ai = data.aiSummaries[kind]
  const sel = selected && days.includes(selected) ? selected : null
  const notes = [...days]
    .reverse()
    .flatMap((d) => [...conditionsOn(data, d)].reverse().filter((r) => r.note !== '').map((r) => [d, r] as const))
    .slice(0, 10)

  return (
    <>
      <Card>
        <div class="row gap8">
          <CardTitle text={ai ? '今回話すこと（AIの整理）' : '今回話すこと'} grow />
          <span class="muted small12 nowrap">{periodText}</span>
        </div>
        {ai ? (
          <>
            <p class="pre">{ai.text}</p>
            {memos.length > 0 && (
              <>
                <Divider />
                <button type="button" class="fold-row accent-text" onClick={() => setMemosOpen(true)}>
                  <span class="grow">元のメモを見る</span>
                  <span class="muted small">{memos.length}件</span>
                  <Chevron />
                </button>
              </>
            )}
          </>
        ) : (
          <>
            {memos.length === 0 && <EmptyText text="なし" />}
            {memos.slice(0, 3).map((m) => (
              <div class="show-memo">
                <span>・</span>
                <div class="col gap2">
                  {m.pinned && <PinBadge kind={m.kind} both={both} />}
                  <span>{m.text}</span>
                </div>
              </div>
            ))}
            {memos.length > 3 && (
              <>
                <Divider />
                <button type="button" class="fold-row accent-text" onClick={() => setMemosOpen(true)}>
                  <span class="grow">元のメモをすべて見る</span>
                  <span class="muted small">{memos.length}件</span>
                  <Chevron />
                </button>
              </>
            )}
          </>
        )}
      </Card>

      {kind === DOC ? (
        <>
          <Card>
            <SummaryRow avg={periodAverage(days, data)} />
            <button type="button" class="fold-row accent-text" aria-expanded={chartsOpen} onClick={() => setChartsOpen(!chartsOpen)}>
              <span class="grow">{chartsOpen ? 'グラフを閉じる' : 'グラフを見る'}</span>
              <Chevron open={chartsOpen} />
            </button>
            {chartsOpen && (
              <div class="col gap8">
                <SplitMoodCharts days={days} data={data} selected={sel} onSelect={setSelected} />
                <ChartHead
                  title="睡眠"
                  legend={[
                    ['var(--accent)', '夜'],
                    ['var(--nap)', '二度寝'],
                  ]}
                />
                <SleepChart days={days} data={data} selected={sel} onSelect={setSelected} showAvg={false} />
              </div>
            )}
          </Card>
          {chartsOpen && sel && (
            <Card>
              <div class="row">
                <h2 class="title-medium grow">{mdw(sel)}</h2>
                <IconButton icon="close" label="この日の詳しい記録を閉じる" onClick={() => setSelected(null)} />
              </div>
              <DayDetail date={sel} data={data} />
            </Card>
          )}
        </>
      ) : (
        <>
          {/* 最近の出来事・気持ち(ひとことのある記録を新しい順に10件まで。最初はたたむ) */}
          <Card>
            <button type="button" class="fold-row" aria-expanded={notesOpen} disabled={notes.length === 0} onClick={() => setNotesOpen(!notesOpen)}>
              <CardTitle text="最近の出来事・気持ち" grow />
              <span class="muted small">{notes.length === 0 ? 'なし' : `${notes.length}件`}</span>
              {notes.length > 0 && <Chevron open={notesOpen} />}
            </button>
            {notesOpen &&
              notes.map(([d, r]) => (
                <>
                  <Divider />
                  <div class="col gap4">
                    <div class="row gap6">
                      <span class="muted small">
                        {md(d)} {hm(r.timeMin)}
                      </span>
                      <MiniMind value={r.mind} />
                      <MiniBattery value={r.body} />
                    </div>
                    <p class="pre">{r.note}</p>
                  </div>
                </>
              ))}
          </Card>
          {last && (
            <Card>
              <CardTitle text="前回の振り返り" />
              <b class="small14 accent">{mdw(last.date)}</b>
              <p class="pre">{last.feedback}</p>
            </Card>
          )}
        </>
      )}

      {memosOpen && (
        <Sheet title={`元のメモ（${kindLabel(kind)}）`} onDismiss={() => setMemosOpen(false)}>
          {memos.map((m) => (
            <div class="show-memo">
              <span>・</span>
              <span>{m.text}</span>
            </div>
          ))}
          <SheetActions>
            <SubButton text="閉じる" onClick={() => setMemosOpen(false)} />
          </SheetActions>
        </Sheet>
      )}
    </>
  )
}

/** 見せる画面の、その日の詳しい記録 */
function DayDetail({ date, data }: { date: string; data: AppData }) {
  const sr = data.sleeps[date]
  const conds = conditionsOn(data, date)
  if (!sr && conds.length === 0) return <p>記録なし</p>
  return (
    <>
      {sr && (
        <p class="small14">
          {hm(sr.sleepMin)}〜{hm(sr.wakeMin)} ({durJ(nightMin(sr))})
        </p>
      )}
      {sr && sr.napSleepMin != null && sr.napWakeMin != null && (
        <p class="small14">
          二度寝 {hm(sr.napSleepMin)}〜{hm(sr.napWakeMin)} ({durJ(napMin(sr))})
        </p>
      )}
      {conds.map((r) => (
        <div class="row gap6">
          <span class="muted small">{hm(r.timeMin)}</span>
          <MiniMind value={r.mind} />
          <MiniBattery value={r.body} />
          <span class="small14">{r.note}</span>
        </div>
      ))}
    </>
  )
}
