import { useState } from 'preact/hooks'
import { conditionsOn, kindLabel, type AppData, type ConditionRecord } from '../data/entities'
import { kindsOf, type AppSettings } from '../data/settings'
import { addDays, mdw, today as todayKey } from '../domain/date'
import { dueKinds, durJ, hm, napMin, nightMin } from '../domain/format'
import { navigate, routes } from '../nav'
import { addMemo, setSelectedDate } from '../store'
import { CoachId } from '../ui/coach'
import { Icon } from '../ui/icons'
import { Chevron, CountText, EntryButton, EntryIcon, HeaderTile, IconButton, MiniBattery, MiniMind, Screen } from '../ui/parts'
import { MemoAddSheet } from './visitSheets'

/** 記録タブ */
export function RecordScreen(p: {
  data: AppData
  settings: AppSettings
  selected: string
  onHelp: () => void
  onOpenVisitTab: () => void
  onRecordVisit: (kind: string, date: string) => void
}) {
  const { data, settings } = p
  const t = todayKey()
  const day = p.selected > t ? t : p.selected
  const kinds = kindsOf(settings)
  const [adding, setAdding] = useState(false)

  const sr = data.sleeps[day]
  const conds = conditionsOn(data, day)

  return (
    <Screen>
      {/* 日付ナビ(今日より先には行けない)と、ナビゲーションガイド・設定 */}
      <div class="top-row">
        <IconButton icon="left" label="前の日" onClick={() => setSelectedDate(addDays(day, -1))} />
        <h1 class="title-large">{mdw(day)}</h1>
        <IconButton icon="right" label="次の日" onClick={() => setSelectedDate(addDays(day, 1))} disabled={day >= t} />
        <span class="grow" />
        <HeaderTile icon="help" label="ナビゲーションガイド" onClick={p.onHelp} coach={CoachId.RECORD_GUIDE} />
        <HeaderTile icon="gear" label="設定" onClick={() => navigate(routes.settings)} />
      </div>

      {/* 予定日の診察・カウンセリング(今日か、その予定日を見ているときだけ) */}
      {dueKinds(day, t, kinds, data.appointments).map((kind) => {
        const a = data.appointments[kind]
        return (
          <button type="button" class="due-banner" onClick={() => p.onRecordVisit(kind, a.date)}>
            <EntryIcon icon="visit" box={34} bg="var(--surface)" tint="var(--warm)" />
            <span class="grow col">
              <b class="title-medium">
                {a.date === t ? '今日' : mdw(a.date)}の{kindLabel(kind)}を記録
              </b>
              <span class="due-sub">{(a.timeMin != null ? `${hm(a.timeMin)}・` : '') + '話したこととアドバイスを残す'}</span>
            </span>
            <Chevron />
          </button>
        )
      })}

      {/* 睡眠: 記録があれば長さだけ。未記録は薄い灰色にして圧をかけない */}
      <EntryButton
        title={sr ? durJ(nightMin(sr)) : '睡眠'}
        subtitle={!sr ? '未記録' : napMin(sr) > 0 ? `二度寝 ${durJ(napMin(sr))}` : null}
        icon="moon"
        muted={!sr}
        onClick={() => navigate(routes.sleep(day))}
        coach={CoachId.SLEEP}
        label={sr ? `睡眠 ${durJ(nightMin(sr))}` + (napMin(sr) > 0 ? `、二度寝 ${durJ(napMin(sr))}` : '') : '睡眠 未記録'}
      />

      {/* 調子: 未記録なら薄い灰色の入口、あればその日の行(押すと直す)と右上の件数＋ */}
      {conds.length === 0 ? (
        <EntryButton title="調子" subtitle="未記録" icon="smile" muted onClick={() => navigate(routes.condition(day, null))} coach={CoachId.CONDITION} />
      ) : (
        <ConditionBox conds={conds} onAdd={() => navigate(routes.condition(day, null))} onOpen={(r) => navigate(routes.condition(day, r.id))} />
      )}

      {/* 振り返り */}
      <EntryButton title="振り返り" icon="rec" onClick={() => navigate(routes.history)} coach={CoachId.HISTORY} />

      {/* 診察・カウンセリング(両方オフなら出さない) */}
      {kinds.length > 0 && (
        <>
          <h2 class="title-small section-head">{kinds.length === 1 ? kindLabel(kinds[0]) : '診察・カウンセリング'}</h2>
          <div class="card-row" data-coach={CoachId.TALK}>
            <button type="button" class="card-row-main" onClick={p.onOpenVisitTab}>
              <EntryIcon icon="talk" />
              <span class="title-medium grow">話すこと</span>
              {data.memos.length > 0 && <CountText text={`${data.memos.length}件`} />}
            </button>
            <IconButton icon="plus" label="話すことを追加" onClick={() => setAdding(true)} />
          </div>
        </>
      )}

      {adding && (
        <MemoAddSheet
          kinds={kinds}
          onDismiss={() => setAdding(false)}
          onAdd={(text, kind, pinned) => {
            addMemo(text, kind, pinned)
            setAdding(false)
          }}
        />
      )}
    </Screen>
  )
}

/** その日の調子の一覧 */
function ConditionBox({ conds, onAdd, onOpen }: { conds: ConditionRecord[]; onAdd: () => void; onOpen: (r: ConditionRecord) => void }) {
  return (
    <section class="cond-box" data-coach={CoachId.CONDITION}>
      <div class="cond-head">
        <EntryIcon icon="smile" />
        <h2 class="title-medium grow">調子</h2>
        <CountText text={`${conds.length}件`} />
        <IconButton icon="plus" label="調子を追加" onClick={onAdd} />
      </div>
      {conds.map((r) => (
        <>
          <hr class="divider inset" />
          <button
            type="button"
            class="cond-line"
            onClick={() => onOpen(r)}
            aria-label={`${hm(r.timeMin)} ココロ${r.mind ?? '-'} カラダ${r.body ?? '-'} ${r.note}(押すと直す)`}
          >
            <span class="muted small">{hm(r.timeMin)}</span>
            <MiniMind value={r.mind} />
            <MiniBattery value={r.body} />
            <span class={`grow ellipsis ${r.note === '' ? 'muted' : ''}`}>{r.note || 'ひとことなし'}</span>
            <Icon name="right" size={16} class="chev" />
          </button>
        </>
      ))}
    </section>
  )
}
