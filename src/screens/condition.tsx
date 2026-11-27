import { useState } from 'preact/hooks'
import { conditionsOn, type AppData } from '../data/entities'
import { mdw } from '../domain/date'
import { hm, nowMin } from '../domain/format'
import { goBack, leaveSecondPage, openSecondPage, routes } from '../nav'
import { deleteCondition, saveCondition } from '../store'
import { Card, IconButton, NoteField, PrimaryButton, Screen, Sheet, SheetActions, SubButton, levelColor, mindColor } from '../ui/parts'

const WORDS = ['とてもつらい', 'つらい', 'ふつう', '少し楽', '楽']

interface Draft {
  mind: number | null
  body: number | null
  note: string
  timeMin: number
}

/**
 * 調子の画面(2ページ)。id があればその記録を直す。
 * ページは URL で分け(スマホの「戻る」で1ページ目へ戻れるように)、入力中の値は同じ画面のまま保つ
 */
export function ConditionScreen({ data, date, id, page }: { data: AppData; date: string; id: number | null; page: 1 | 2 }) {
  const editing = id != null ? (conditionsOn(data, date).find((r) => r.id === id) ?? null) : null
  const [d, setD] = useState<Draft>(() => ({
    mind: editing?.mind ?? null,
    body: editing?.body ?? null,
    note: editing?.note ?? '',
    timeMin: editing?.timeMin ?? nowMin(),
  }))
  const update = (patch: Partial<Draft>) => setD({ ...d, ...patch })
  const [help, setHelp] = useState(false)
  const toPage2 = () => openSecondPage(`${routes.condition(date, id)}/2`)

  return (
    <Screen>
      <div class="top-row">
        <IconButton icon="left" label={page === 2 ? 'ココロとカラダへ戻る' : '記録へ戻る'} onClick={goBack} />
        <div class="steps grow" aria-label={`手順 ${page} / 2`}>
          <i class={page === 1 ? 'on' : ''} />
          <i class={page === 2 ? 'on' : ''} />
        </div>
        {editing && (
          <IconButton
            icon="trash"
            label="この調子の記録を削除"
            onClick={() => {
              deleteCondition(editing)
              if (page === 2) leaveSecondPage()
              else goBack()
            }}
          />
        )}
        <IconButton icon="help" label="調子の見方" onClick={() => setHelp(true)} />
      </div>
      <p class="bold">
        {mdw(date)} {hm(d.timeMin)}
      </p>

      {page === 1 ? (
        <>
          <Card>
            <h2 class="title-small">ココロ</h2>
            <MindTrack value={d.mind} onSelect={(v) => update({ mind: v })} />
          </Card>
          <Card>
            <h2 class="title-small">カラダ</h2>
            <BigBattery value={d.body} onSelect={(v) => update({ body: v })} />
          </Card>
          <PrimaryButton text="次へ" icon="right" iconEnd wide onClick={toPage2} />
        </>
      ) : (
        <>
          <Card>
            <h2 class="title-small">ひとこと（任意）</h2>
            <NoteField value={d.note} onInput={(v) => update({ note: v })} label="ひとこと" placeholder="例：昨日はおそくまで起きてしまった。" />
          </Card>
          <PrimaryButton
            text="保存する"
            icon="check"
            wide
            onClick={() => {
              saveCondition(editing, date, d.timeMin, d.mind, d.body, d.note)
              leaveSecondPage()
            }}
          />
        </>
      )}

      {help && (
        <Sheet title="調子の見方" onDismiss={() => setHelp(false)}>
          <p>ココロ（顔）とカラダ（電池）は、どちらも左ほどつらく、右ほど楽な5段階です。</p>
          <p>どちらか片方だけ選んだり、ひとことだけ書いて保存することもできます。</p>
          <SheetActions>
            <SubButton text="閉じる" onClick={() => setHelp(false)} />
          </SheetActions>
        </Sheet>
      )}
    </Screen>
  )
}

/** ココロ: 5つの顔。選んだ位置まで塗り、表情と色をそろえる */
function MindTrack({ value, onSelect }: { value: number | null; onSelect: (v: number) => void }) {
  const fillW = value != null && value > 1 ? `calc((100% - 48px) * ${(value - 1) / 4})` : '0'
  const grad = value != null ? `linear-gradient(90deg, ${Array.from({ length: Math.max(value, 2) }, (_, i) => mindColor(i + 1)).join(',')})` : undefined
  return (
    <div class="mind-track">
      <div class="mind-rail" />
      <div class="mind-fill" style={{ width: fillW, background: grad }} />
      <div class="mind-faces" role="radiogroup" aria-label="ココロ">
        {[1, 2, 3, 4, 5].map((v) => {
          const on = value != null && v <= value
          const shown = on ? value! : v
          const fill = on ? mindColor(value!) : 'var(--surface)'
          const stroke = on ? fill : 'var(--line)'
          const feature = on ? 'var(--ink)' : 'var(--line)'
          const curve = [-6, -3, 0, 4, 7][shown - 1]
          return (
            <button type="button" role="radio" aria-checked={v === value} aria-label={`ココロ ${v} ${WORDS[v - 1]}`} class={`face ${v === value ? 'sel' : ''}`} onClick={() => onSelect(v)}>
              <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
                <circle cx="24" cy="24" r="20" fill={fill} stroke={stroke} stroke-width="2.5" />
                <circle cx="18" cy="20" r="2.3" fill={feature} />
                <circle cx="30" cy="20" r="2.3" fill={feature} />
                <path d={`M17 31Q24 ${31 + curve} 31 31`} stroke={feature} stroke-width="2.5" stroke-linecap="round" fill="none" />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** カラダ: 5区切りの電池 */
function BigBattery({ value, onSelect }: { value: number | null; onSelect: (v: number) => void }) {
  const fill = value != null ? levelColor(value) : 'transparent'
  return (
    <div class="battery">
      <div class={`battery-frame ${value != null ? 'set' : ''}`} role="radiogroup" aria-label="カラダ">
        {[1, 2, 3, 4, 5].map((v) => {
          const on = value != null && v <= value
          return (
            <button
              type="button"
              role="radio"
              aria-checked={v === value}
              aria-label={`カラダ ${v} ${WORDS[v - 1]}`}
              class={`cell ${on ? 'on' : ''} ${v === value ? 'sel' : ''}`}
              style={on ? { background: fill } : undefined}
              onClick={() => onSelect(v)}
            />
          )
        })}
      </div>
      <span class={`battery-tip ${value != null ? 'set' : ''}`} />
    </div>
  )
}
