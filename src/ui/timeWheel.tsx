import { useEffect, useRef, useState } from 'preact/hooks'
import { diffMin, durJ, hm } from '../domain/format'
import { PrimaryButton, Sheet } from './parts'

// 5分きざみの時刻を選ぶシート（Android 版 ui/components/TimeWheel.kt と同じ動き）

const STEP = 5
const MINUTES = Array.from({ length: 60 / STEP }, (_, i) => i * STEP)
const ROW = 44
const pad2 = (n: number) => String(n).padStart(2, '0')

/** 時刻を選ぶ1つ分。bedLayout なら時の列を12時から並べる(22・23・0・1時が続いて並ぶ) */
export interface TimeSlot {
  label: string
  minutes: number
  bedLayout?: boolean
}

/**
 * slots が2つならタブで切り替え、showDuration なら2つの間の長さを出す。
 * OK で onConfirm に選んだ分(slots と同じ順)を返す
 */
export function TimeWheelSheet(p: {
  title: string
  slots: TimeSlot[]
  showDuration?: boolean
  onDismiss: () => void
  onConfirm: (values: number[]) => void
}) {
  const [values, setValues] = useState(() => p.slots.map((s) => s.minutes))
  const [which, setWhich] = useState(0)
  const slot = p.slots[which]
  const current = values[which]
  const hours = slot.bedLayout ? Array.from({ length: 24 }, (_, i) => (i + 12) % 24) : Array.from({ length: 24 }, (_, i) => i)

  return (
    <Sheet title={p.title} onDismiss={p.onDismiss}>
      {p.slots.length > 1 && (
        <div class="wheel-tabs" role="tablist">
          {p.slots.map((s, i) => (
            <button type="button" role="tab" aria-selected={i === which} class={i === which ? 'on' : ''} onClick={() => setWhich(i)}>
              <b>{s.label}</b>
              <span>{hm(values[i])}</span>
            </button>
          ))}
        </div>
      )}
      {/* タブを切り替えたら列を作り直し、そのタブの時刻に合わせる */}
      <div class="wheel" key={which}>
        <div class="wheel-band" />
        <WheelColumn
          labels={hours.map(pad2)}
          initialIndex={hours.indexOf(Math.floor(current / 60))}
          description={`${slot.label}の時`}
          onSelect={(i) => setValues((vs) => vs.map((v, k) => (k === which ? hours[i] * 60 + (v % 60) : v)))}
        />
        <span class="wheel-colon">:</span>
        <WheelColumn
          labels={MINUTES.map(pad2)}
          initialIndex={Math.floor((current % 60) / STEP)}
          description={`${slot.label}の分`}
          onSelect={(i) => setValues((vs) => vs.map((v, k) => (k === which ? Math.floor(v / 60) * 60 + MINUTES[i] : v)))}
        />
        <div class="wheel-fade" />
      </div>
      {p.showDuration && values.length === 2 && <p class="wheel-dur">長さ {durJ(diffMin(values[0], values[1]))}</p>}
      <PrimaryButton text="OK" wide onClick={() => p.onConfirm(values)} />
    </Sheet>
  )
}

/**
 * 上下にスクロールして選ぶ列。真ん中の行が選択中。
 * スクロールが止まると、いちばん近い行にぴたりと合わせる(scroll-snap)。上下の行を押すと、その行へ動く
 */
function WheelColumn(p: { labels: string[]; initialIndex: number; description: string; onSelect: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [center, setCenter] = useState(Math.max(0, p.initialIndex))
  const select = useRef(p.onSelect)
  select.current = p.onSelect

  useEffect(() => {
    const el = ref.current!
    el.scrollTop = Math.max(0, p.initialIndex) * ROW
    let last = Math.max(0, p.initialIndex)
    const onScroll = () => {
      const i = Math.min(p.labels.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)))
      if (i !== last) {
        last = i
        setCenter(i)
        select.current(i)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const go = (i: number) => ref.current?.scrollTo({ top: i * ROW, behavior: 'smooth' })
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') go(Math.min(p.labels.length - 1, center + 1))
    else if (e.key === 'ArrowUp') go(Math.max(0, center - 1))
    else return
    e.preventDefault()
  }

  return (
    <div
      class="wheel-col"
      ref={ref}
      role="listbox"
      tabIndex={0}
      aria-label={p.description}
      aria-activedescendant={undefined}
      onKeyDown={onKey}
    >
      <div style={{ height: `${ROW * 2}px` }} />
      {p.labels.map((label, i) => (
        <div role="option" aria-selected={i === center} class={`wheel-item ${i === center ? 'on' : ''}`} onClick={() => go(i)}>
          {label}
        </div>
      ))}
      <div style={{ height: `${ROW * 2}px` }} />
    </div>
  )
}
