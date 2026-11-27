import { useState } from 'preact/hooks'
import { COUN, DOC, kindLabel, type AppData, type Appointment, type ConsultMemo } from '../data/entities'
import { kindsOf, type AppSettings } from '../data/settings'
import { dateOfMillis, md, mdw, today as todayKey, weekdayJ, year as yearOf } from '../domain/date'
import { daysLeft, hm, leftText } from '../domain/format'
import { deleteMemo, recordVisit, returnTalked, setAppointments, updateMemo } from '../store'
import { KindBadge, MiniButton, NoteField, PrimaryButton, Segmented, Sheet, SheetActions, SubButton, kindVar } from '../ui/parts'
import { TimeWheelSheet } from '../ui/timeWheel'

// 診察タブのシート（Android 版 ui/screens/VisitSheets.kt と同じ）

export const createdDate = (m: ConsultMemo) => dateOfMillis(m.createdAt)

// ---- 日付・時刻の入力欄 ----

/** 日付の欄。押すとブラウザのカレンダーを出す。null は未定 */
export function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label class="field-cell">
      <span class="muted small">{label}</span>
      <b>{value ? `${yearOf(value)}/${mdw(value)}` : '未定'}</b>
      <input
        type="date"
        class="cover-input"
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.currentTarget.value || null)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker()
          } catch {
            // showPicker が使えないブラウザは、そのまま入力欄が開く
          }
        }}
      />
    </label>
  )
}

/** 時刻の欄。押すと5分きざみのホイールを出す。null は未定 */
export function TimeField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" class="field-cell" onClick={() => setOpen(true)} aria-label={`${label} ${value != null ? hm(value) : '未定'}`}>
        <span class="muted small">{label}</span>
        <b>{value != null ? hm(value) : '--:--'}</b>
      </button>
      {open && (
        <TimeWheelSheet
          title={label}
          slots={[{ label, minutes: value ?? 10 * 60 }]}
          onDismiss={() => setOpen(false)}
          onConfirm={([v]) => {
            onChange(v)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

/** 日付・時刻の2つ並び */
export function DateTimeRow(p: { date: string | null; time: number | null; onDate: (v: string | null) => void; onTime: (v: number | null) => void }) {
  return (
    <div class="times">
      <DateField label="日付" value={p.date} onChange={p.onDate} />
      <TimeField label="時刻" value={p.time} onChange={p.onTime} />
    </div>
  )
}

/** 左に色帯のある囲み */
export function KindStrip({ kind, children }: { kind: string; children: preact.ComponentChildren }) {
  return (
    <div class={`kind-strip ${kind === COUN ? 'coun' : 'doc'}`}>
      <div class="col gap4">{children}</div>
    </div>
  )
}

// ---- 次の予定 ----

/** 次の予定。開いた直後は見る用、「予定を編集」で入力に切り替える */
export function AppointmentsSheet({ data, settings, onDismiss }: { data: AppData; settings: AppSettings; onDismiss: () => void }) {
  const kinds = kindsOf(settings)
  const t = todayKey()
  const [editing, setEditing] = useState(false)
  const [dates, setDates] = useState<Record<string, string | null>>(() => Object.fromEntries(kinds.map((k) => [k, data.appointments[k]?.date ?? null])))
  const [times, setTimes] = useState<Record<string, number | null>>(() => Object.fromEntries(kinds.map((k) => [k, data.appointments[k]?.timeMin ?? null])))

  return (
    <Sheet title={editing ? '次の予定を編集' : '次の予定'} onDismiss={onDismiss}>
      {!editing ? (
        <>
          {kinds.map((k) => {
            const a = data.appointments[k]
            return (
              <KindStrip kind={k}>
                <div class="row">
                  <KindBadge kind={k} />
                  <span class="grow" />
                  {a && <b class={`small ${daysLeft(a, t) <= 0 ? 'warm' : 'muted'}`}>{leftText(a, t)}</b>}
                </div>
                {!a ? (
                  <p class="muted">まだ決まっていません</p>
                ) : (
                  <div class="appt-when">
                    <span>
                      <b class="appt-date">{md(a.date)}</b>
                      <b class="muted">({weekdayJ(a.date)})</b>
                    </span>
                    {a.timeMin != null && (
                      <b class="appt-time" style={{ color: kindVar(k) }}>
                        {hm(a.timeMin)}
                      </b>
                    )}
                  </div>
                )}
              </KindStrip>
            )
          })}
          <SheetActions>
            <SubButton text="閉じる" onClick={onDismiss} />
            <PrimaryButton text={kinds.some((k) => data.appointments[k]) ? '予定を編集' : '予定を設定'} onClick={() => setEditing(true)} />
          </SheetActions>
        </>
      ) : (
        <>
          {kinds.map((k, i) => {
            const d = dates[k]
            const a: Appointment | null = d ? { kind: k, date: d, timeMin: times[k] } : null
            return (
              <>
                {i > 0 && <hr class="divider" />}
                <div class="row">
                  <b>{kindLabel(k)}</b>
                  <span class={`small grow ${a && daysLeft(a, t) <= 0 ? 'warm' : 'muted'}`}>{a ? leftText(a, t) : '未定'}</span>
                  {d && (
                    <MiniButton
                      text="消す"
                      tone="warm"
                      onClick={() => {
                        setDates({ ...dates, [k]: null })
                        setTimes({ ...times, [k]: null })
                      }}
                    />
                  )}
                </div>
                <DateTimeRow date={d} time={times[k]} onDate={(v) => setDates({ ...dates, [k]: v })} onTime={(v) => setTimes({ ...times, [k]: v })} />
              </>
            )
          })}
          <SheetActions>
            <SubButton text="戻る" onClick={() => setEditing(false)} />
            <PrimaryButton
              text="保存"
              onClick={() => {
                setAppointments(Object.fromEntries(kinds.map((k) => [k, dates[k] ? { kind: k, date: dates[k]!, timeMin: times[k] } : null])))
                onDismiss()
              }}
            />
          </SheetActions>
        </>
      )}
    </Sheet>
  )
}

// ---- 診察・カウンセリングを記録する ----

/**
 * 記録するシート。チェックした話すことは「話したこと」へ移る(その相手向け＋未分類を最初からチェック)。
 * 予定日のバナーから開くと、相手と日付は予定のものが入る
 */
export function VisitFormSheet(p: { data: AppData; settings: AppSettings; kind0: string; date0: string; onDismiss: () => void }) {
  const kinds = kindsOf(p.settings)
  const both = kinds.length >= 2
  const memos = p.data.memos
  const defaultChecks = (k: string) => new Set(memos.filter((m) => !both || m.kind == null || m.kind === k).map((m) => m.id!))
  const [kind, setKind] = useState(p.kind0)
  const [date, setDate] = useState<string | null>(p.date0)
  const [checked, setChecked] = useState(() => defaultChecks(p.kind0))
  const [feedback, setFeedback] = useState('')
  const [nextDate, setNextDate] = useState<string | null>(null)
  const [nextTime, setNextTime] = useState<number | null>(null)
  const toggle = (id: number) => {
    const s = new Set(checked)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setChecked(s)
  }

  return (
    <Sheet title="記録する" onDismiss={p.onDismiss}>
      {both && (
        <Segmented
          options={kinds.map((k) => [k, kindLabel(k)] as [string, string])}
          selected={kind}
          onSelect={(k) => {
            setKind(k)
            setChecked(defaultChecks(k))
          }}
        />
      )}
      <DateField label="日付" value={date} onChange={setDate} />
      {memos.length > 0 && (
        <>
          <h3 class="title-small">話したこと（外したものは次回へ残ります）</h3>
          <div class="check-list">
            {memos.map((m) => (
              <label class="check-row">
                <input type="checkbox" checked={checked.has(m.id!)} onChange={() => toggle(m.id!)} />
                {both && m.kind != null && <KindBadge kind={m.kind} />}
                <span class="grow ellipsis">{m.text}</span>
              </label>
            ))}
          </div>
        </>
      )}
      <h3 class="title-small">アドバイス</h3>
      <NoteField value={feedback} onInput={setFeedback} label="アドバイス" rows={3} />
      <h3 class="title-small">次の予定（決まっていれば）</h3>
      <DateTimeRow date={nextDate} time={nextTime} onDate={setNextDate} onTime={setNextTime} />
      <SheetActions>
        <SubButton text="やめる" onClick={p.onDismiss} />
        <PrimaryButton
          text="保存"
          onClick={() => {
            recordVisit(kind, date ?? todayKey(), checked, feedback, nextDate ? { kind, date: nextDate, timeMin: nextTime } : null)
            p.onDismiss()
          }}
        />
      </SheetActions>
    </Sheet>
  )
}

// ---- 過去の記録と話したこと ----
export function VisitsSheet(p: { data: AppData; settings: AppSettings; onAddVisit: () => void; onDismiss: () => void }) {
  const kinds = kindsOf(p.settings)
  const title = kinds.length === 1 ? `過去の${kindLabel(kinds[0])}` : '過去の記録'
  const visits = p.data.visits.filter((v) => kinds.includes(v.kind))
  return (
    <Sheet title={title} onDismiss={p.onDismiss}>
      <h3 class="title-small">記録</h3>
      {visits.length === 0 && <p class="body-small">なし</p>}
      {visits.map((v) => (
        <div class="col gap2">
          <div class="row gap6">
            <b class="small14">{mdw(v.date)}</b>
            <KindBadge kind={v.kind} />
          </div>
          <span class="small14">{v.talkedSummary}</span>
          <span class="small14 accent">{v.feedback}</span>
        </div>
      ))}
      <div>
        <MiniButton text="＋ 予定になかった日を記録" onClick={p.onAddVisit} />
      </div>
      <h3 class="title-small">話したこと</h3>
      {p.data.talked.length === 0 && <p class="body-small">なし</p>}
      {p.data.talked.map((m) => (
        <div class="row gap8">
          <span class="muted small">{md(createdDate(m))}</span>
          <span class="grow small14">{m.text}</span>
          <MiniButton text="戻す" onClick={() => returnTalked(m)} label={`「${m.text.slice(0, 16)}」を話すことへ戻す`} />
        </div>
      ))}
      <SheetActions>
        <SubButton text="閉じる" onClick={p.onDismiss} />
      </SheetActions>
    </Sheet>
  )
}

/** 相談メモの振り分け指定チップ(追加・編集で共用) */
export function MemoRoutingChips(p: { kinds: string[]; kind: string | null; pinned: boolean; onChange: (kind: string | null, pinned: boolean) => void }) {
  const both = p.kinds.length >= 2
  const target = p.kinds[0] ?? null
  const options: [string, string | null, boolean, 'accent' | 'warm'][] = both
    ? [
        ['おまかせ', null, false, 'accent'],
        ['診察', DOC, true, 'accent'],
        ['カウンセリング', COUN, true, 'warm'],
      ]
    : [
        ['普通', target, false, 'accent'],
        ['優先', target, true, 'warm'],
      ]
  return (
    <div class="col gap6">
      <h3 class="title-small">振り分け指定</h3>
      <div class="chips" role="radiogroup" aria-label="振り分け指定">
        {options.map(([label, k, pin, tone]) => {
          const on = both ? (pin ? p.pinned && p.kind === k : !p.pinned) : p.pinned === pin
          return (
            <button type="button" role="radio" aria-checked={on} class={`chip big ${tone} ${on ? 'on' : ''}`} onClick={() => p.onChange(k, pin)}>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 話すことを追加するシート */
export function MemoAddSheet(p: { kinds: string[]; onDismiss: () => void; onAdd: (text: string, kind: string | null, pinned: boolean) => void }) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  return (
    <Sheet title="話すことを追加" onDismiss={p.onDismiss}>
      {p.kinds.length > 0 && (
        <MemoRoutingChips
          kinds={p.kinds}
          kind={kind}
          pinned={pinned}
          onChange={(k, pin) => {
            setKind(k)
            setPinned(pin)
          }}
        />
      )}
      <NoteField value={text} onInput={setText} label="話すこと" autoFocus />
      <SheetActions>
        <SubButton text="やめる" onClick={p.onDismiss} />
        <PrimaryButton text="追加" icon="check" disabled={text.trim() === ''} onClick={() => p.onAdd(text, kind, pinned)} />
      </SheetActions>
    </Sheet>
  )
}

/** 話すことを直す */
export function MemoEditSheet({ memo, kinds, onDismiss }: { memo: ConsultMemo; kinds: string[]; onDismiss: () => void }) {
  const [text, setText] = useState(memo.text)
  const [kind, setKind] = useState(memo.kind)
  const [pinned, setPinned] = useState(memo.pinned)
  return (
    <Sheet title="話すことを直す" onDismiss={onDismiss}>
      <MemoRoutingChips
        kinds={kinds}
        kind={kind}
        pinned={pinned}
        onChange={(k, pin) => {
          setKind(k)
          setPinned(pin)
        }}
      />
      <NoteField value={text} onInput={setText} label="話すこと" />
      <SheetActions
        start={
          <MiniButton
            text="消す"
            icon="trash"
            tone="warm"
            onClick={() => {
              deleteMemo(memo)
              onDismiss()
            }}
          />
        }
      >
        <SubButton text="やめる" onClick={onDismiss} />
        <PrimaryButton
          text="保存"
          disabled={text.trim() === ''}
          onClick={() => {
            updateMemo(memo, text, kind, pinned)
            onDismiss()
          }}
        />
      </SheetActions>
    </Sheet>
  )
}
