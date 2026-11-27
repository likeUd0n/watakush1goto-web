import type { JSX } from 'preact'
import { conditionsOn, type AppData } from '../data/entities'
import { md, today as todayKey } from '../domain/date'
import { avgBody, avgMind, durJ, level, levelWord, napMin, nightMin, totalMin } from '../domain/format'
import { Icon } from './icons'
import { MiniBattery, MiniMind } from './parts'

// グラフ（Android 版 ui/components/Charts.kt を SVG で写したもの）。座標は 320 幅で考え、画面の幅に合わせて広げる

const W = 320
const L = 28
const R = 6
const T = 10
const H2 = 94
const B2 = 20

/** 期間の平均(平均睡眠・平均ココロ・平均カラダ) */
export interface PeriodAverage {
  sleepMin: number | null
  mind: number | null
  body: number | null
}

const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function periodAverage(days: string[], data: AppData): PeriodAverage {
  const sleeps = days.flatMap((d) => {
    const s = data.sleeps[d]
    const t = s ? totalMin(s) : 0
    return t > 0 ? [t] : []
  })
  const minds = days.flatMap((d) => {
    const v = avgMind(conditionsOn(data, d))
    return v == null ? [] : [v]
  })
  const bodies = days.flatMap((d) => {
    const v = avgBody(conditionsOn(data, d))
    return v == null ? [] : [v]
  })
  const s = mean(sleeps)
  return { sleepMin: s == null ? null : Math.trunc(s), mind: mean(minds), body: mean(bodies) }
}

/** 平均の3つ並び */
export function SummaryRow({ avg }: { avg: PeriodAverage }) {
  return (
    <>
      <div class="sum-row">
        <div class="sum-item">
          <span class="sum-label">平均睡眠</span>
          <span class="sum-val">
            <Icon name="moon" size={16} class="accent" />
            <b>{avg.sleepMin != null ? durJ(avg.sleepMin) : '-'}</b>
          </span>
        </div>
        <div class="sum-item">
          <span class="sum-label">ココロ</span>
          <span class="sum-val">
            <MiniMind value={avg.mind} />
            {avg.mind != null && <b>{levelWord(level(avg.mind))}</b>}
          </span>
        </div>
        <div class="sum-item">
          <span class="sum-label">カラダ</span>
          <span class="sum-val">
            <MiniBattery value={avg.body} />
            {avg.body != null && <b>{levelWord(level(avg.body))}</b>}
          </span>
        </div>
      </div>
      <hr class="divider" />
    </>
  )
}

/** グラフの小見出しと凡例 */
export function ChartHead({ title, legend, dashed }: { title: string; legend: [string, string][]; dashed?: string }) {
  return (
    <div class="chart-head">
      <h3 class="card-title grow">{title}</h3>
      <div class="legend">
        {legend.map(([col, label]) => (
          <span>
            <i style={{ background: col }} />
            {label}
          </span>
        ))}
        {dashed && (
          <span>
            <svg width="14" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="14" y2="5" stroke="var(--warm)" stroke-width="2" stroke-dasharray="4 3" />
            </svg>
            {dashed}
          </span>
        )}
      </div>
    </div>
  )
}

const x = (i: number, n: number) => L + ((i + 0.5) * (W - L - R)) / Math.max(1, n)

/** 押した位置の日。今日より先は選べない */
function daySelect(days: string[], onSelect?: (d: string) => void) {
  if (!onSelect) return {}
  const t = todayKey()
  return {
    onClick: (e: JSX.TargetedMouseEvent<SVGSVGElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      const u = ((e.clientX - r.left) / r.width) * W
      const i = Math.min(days.length - 1, Math.max(0, Math.floor((u - L) / ((W - L - R) / days.length))))
      if (days[i] <= t) onSelect(days[i])
    },
    style: { cursor: 'pointer' },
  }
}

/** 自分で見る振り返りグラフの表示切り替え(すべて / ココロ / カラダ) */
export type MoodFilter = 'all' | 'mind' | 'body'
const FILTERS: [MoodFilter, string][] = [
  ['all', 'すべて'],
  ['mind', 'ココロ'],
  ['body', 'カラダ'],
]

export function MoodFilterChips({ current, onChange }: { current: MoodFilter; onChange: (f: MoodFilter) => void }) {
  return (
    <div class="chips" role="radiogroup" aria-label="グラフに出すもの">
      {FILTERS.map(([f, label]) => (
        <button type="button" role="radio" aria-checked={f === current} class={`chip ${f === 'body' ? 'body' : ''} ${f === current ? 'on' : ''}`} onClick={() => onChange(f)}>
          {label}
        </button>
      ))}
    </div>
  )
}

type Pt = [number, number]

/** 連続する点列(null で切れる)を作る */
function segments(values: (number | null)[], n: number, y: (v: number) => number): Pt[][] {
  const out: Pt[][] = []
  let cur: Pt[] | null = null
  values.forEach((v, i) => {
    if (v == null) {
      cur = null
      return
    }
    const p: Pt = [x(i, n), y(v)]
    if (!cur) {
      cur = [p]
      out.push(cur)
    } else cur.push(p)
  })
  return out
}

/** 単調三次曲線でなめらかに結ぶ(1〜5の範囲をはみ出さない) */
function smooth(pts: Pt[]): string {
  if (pts.length === 0) return ''
  let d = `M${pts[0][0]} ${pts[0][1]}`
  if (pts.length === 1) return d
  if (pts.length === 2) return `${d}L${pts[1][0]} ${pts[1][1]}`
  const m = pts.slice(0, -1).map((p, i) => {
    const dx = pts[i + 1][0] - p[0]
    return dx === 0 ? 0 : (pts[i + 1][1] - p[1]) / dx
  })
  const t = pts.map((_, i) => {
    if (i === 0) return m[0]
    if (i === pts.length - 1) return m[m.length - 1]
    const prev = m[i - 1]
    const next = m[i]
    if (prev * next <= 0) return 0
    const limit = 3 * Math.min(Math.abs(prev), Math.abs(next))
    return Math.max(-limit, Math.min(limit, (prev + next) / 2))
  })
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const dx = (x1 - x0) / 3
    d += `C${x0 + dx} ${y0 + t[i] * dx} ${x1 - dx} ${y1 - t[i + 1] * dx} ${x1} ${y1}`
  }
  return d
}

function Line({ values, n, y, color, dashed }: { values: (number | null)[]; n: number; y: (v: number) => number; color: string; dashed?: boolean }) {
  return (
    <path
      d={segments(values, n, y).map(smooth).join('')}
      fill="none"
      stroke={color}
      stroke-width="2"
      stroke-linejoin="round"
      stroke-dasharray={dashed ? '5 3.5' : undefined}
    />
  )
}

function Area({ values, n, y, bottom, color, opacity }: { values: (number | null)[]; n: number; y: (v: number) => number; bottom: number; color: string; opacity: number }) {
  return (
    <>
      {segments(values, n, y)
        .filter((p) => p.length >= 2)
        .map((p) => (
          <path d={`${smooth(p)}L${p[p.length - 1][0]} ${bottom}L${p[0][0]} ${bottom}Z`} fill={color} fill-opacity={opacity} />
        ))}
    </>
  )
}

function Grid({ y }: { y: (v: number) => number }) {
  return (
    <>
      {[1, 2, 3, 4, 5].map((v) =>
        v === 3 ? (
          <line x1={L} x2={W - R} y1={y(3)} y2={y(3)} stroke="var(--muted)" stroke-opacity="0.32" stroke-width="1.2" stroke-dasharray="4 4" />
        ) : (
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" stroke-opacity="0.85" stroke-width="0.6" />
        ),
      )}
    </>
  )
}

const SelLine = ({ i, n, top, bottom }: { i: number; n: number; top: number; bottom: number }) =>
  i < 0 ? null : <line x1={x(i, n)} x2={x(i, n)} y1={top} y2={bottom} stroke="var(--warm)" stroke-width="1.5" stroke-dasharray="6 4" />

function MindPoints({ values, n, y, sel }: { values: (number | null)[]; n: number; y: (v: number) => number; sel: number }) {
  return (
    <>
      {values.map((v, i) =>
        v == null ? null : i === sel ? (
          <g>
            <circle cx={x(i, n)} cy={y(v)} r="5.7" fill="var(--surface)" />
            <circle cx={x(i, n)} cy={y(v)} r="4.2" fill="var(--warm)" />
          </g>
        ) : (
          <g>
            <circle cx={x(i, n)} cy={y(v)} r="3.6" fill="var(--surface)" />
            <circle cx={x(i, n)} cy={y(v)} r="2.5" fill="var(--accent)" />
          </g>
        ),
      )}
    </>
  )
}

function BodyPoints({ values, n, y, sel }: { values: (number | null)[]; n: number; y: (v: number) => number; sel: number }) {
  return (
    <>
      {values.map((v, i) => {
        if (v == null) return null
        const h = i === sel ? 4.2 : 2.5
        const pad = 1.2
        const cx = x(i, n)
        const cy = y(v)
        return (
          <g>
            <rect x={cx - h - pad} y={cy - h - pad} width={(h + pad) * 2} height={(h + pad) * 2} fill="var(--surface)" />
            <rect x={cx - h} y={cy - h} width={h * 2} height={h * 2} fill={i === sel ? 'var(--warm)' : 'var(--body)'} />
          </g>
        )
      })}
    </>
  )
}

/** 縦軸の両端の小さな顔(上が楽、下がつらい) */
function AxisFace({ v, cy }: { v: number; cy: number }) {
  const ox = 5
  const oy = cy - 8
  const curve = v === 1 ? -3 : 3
  return (
    <g stroke="var(--muted)" stroke-width="1.2" fill="none">
      <circle cx={ox + 8} cy={oy + 8} r="7" />
      <circle cx={ox + 5.5} cy={oy + 6.5} r="1" fill="var(--muted)" stroke="none" />
      <circle cx={ox + 10.5} cy={oy + 6.5} r="1" fill="var(--muted)" stroke="none" />
      <path d={`M${ox + 5} ${oy + 10.5}Q${ox + 8} ${oy + 10.5 + curve} ${ox + 11} ${oy + 10.5}`} />
    </g>
  )
}

/** 下の日付の目盛り(最初・真ん中・最後) */
function AxisLabels({ days, baseline }: { days: string[]; baseline: number }) {
  return (
    <g font-size="9.5" fill="var(--muted)">
      <text x={L} y={baseline}>
        {md(days[0])}
      </text>
      <text x={(L + W - R) / 2} y={baseline} text-anchor="middle">
        {md(days[Math.floor(days.length / 2)])}
      </text>
      <text x={W - R} y={baseline} text-anchor="end">
        {md(days[days.length - 1])}
      </text>
    </g>
  )
}

const moodValues = (days: string[], data: AppData) => ({
  minds: days.map((d) => avgMind(conditionsOn(data, d))),
  bodies: days.map((d) => avgBody(conditionsOn(data, d))),
})

/** ココロ・カラダの折れ線(自分で見る振り返り用)。エリア塗り・カラダ破線・フィルタ対応 */
export function MoodChart(p: {
  days: string[]
  data: AppData
  selected: string | null
  onSelect?: (d: string) => void
  shareAxis: boolean
  filter?: MoodFilter
}) {
  const { days, data } = p
  if (days.length === 0) return null
  const filter = p.filter ?? 'all'
  const b1 = p.shareAxis ? 8 : 22
  const h1 = p.shareAxis ? 104 : 120
  const { minds, bodies } = moodValues(days, data)
  const sel = p.selected ? days.indexOf(p.selected) : -1
  const showMind = filter !== 'body'
  const showBody = filter !== 'mind'
  const bottom = h1 - b1
  const y = (v: number) => T + ((5 - v) * (h1 - T - b1)) / 4
  const n = days.length
  return (
    <svg viewBox={`0 0 ${W} ${h1}`} class="chart" role="img" aria-label={`ココロとカラダの推移(${md(days[0])}から${md(days[n - 1])})`} {...daySelect(days, p.onSelect)}>
      <Grid y={y} />
      <SelLine i={sel} n={n} top={T - 4} bottom={bottom} />
      <AxisFace v={5} cy={y(5)} />
      <AxisFace v={1} cy={y(1)} />
      {showMind ? (
        <Area values={minds} n={n} y={y} bottom={bottom} color="var(--accent)" opacity={0.11} />
      ) : (
        showBody && <Area values={bodies} n={n} y={y} bottom={bottom} color="var(--body)" opacity={0.12} />
      )}
      {showBody && (
        <>
          <Line values={bodies} n={n} y={y} color="var(--body)" dashed={filter === 'all'} />
          <BodyPoints values={bodies} n={n} y={y} sel={sel} />
        </>
      )}
      {showMind && (
        <>
          <Line values={minds} n={n} y={y} color="var(--accent)" />
          <MindPoints values={minds} n={n} y={y} sel={sel} />
        </>
      )}
      {!p.shareAxis && <AxisLabels days={days} baseline={h1 - 3} />}
    </svg>
  )
}

/** 診察「見せる」用の2段分離グラフ: ココロとカラダを別枠で描く */
export function SplitMoodCharts(p: { days: string[]; data: AppData; selected: string | null; onSelect?: (d: string) => void }) {
  const { days, data } = p
  if (days.length === 0) return null
  const { minds, bodies } = moodValues(days, data)
  const sel = p.selected ? days.indexOf(p.selected) : -1
  const h = 76
  const b = 8
  const bottom = h - b
  const y = (v: number) => T + ((5 - v) * (h - T - b)) / 4
  const n = days.length
  const range = `${md(days[0])}から${md(days[n - 1])}`
  return (
    <div class="col gap6">
      <ChartHead title="ココロ" legend={[['var(--accent)', '1(つらい)〜5(よい)']]} />
      <svg viewBox={`0 0 ${W} ${h}`} class="chart" role="img" aria-label={`ココロの推移(${range})`} {...daySelect(days, p.onSelect)}>
        <Grid y={y} />
        <SelLine i={sel} n={n} top={T - 4} bottom={bottom} />
        <AxisFace v={5} cy={y(5)} />
        <AxisFace v={1} cy={y(1)} />
        <Area values={minds} n={n} y={y} bottom={bottom} color="var(--accent)" opacity={0.13} />
        <Line values={minds} n={n} y={y} color="var(--accent)" />
        <MindPoints values={minds} n={n} y={y} sel={sel} />
      </svg>
      <ChartHead title="カラダ" legend={[['var(--body)', '1(つらい)〜5(よい)']]} />
      <svg viewBox={`0 0 ${W} ${h}`} class="chart" role="img" aria-label={`カラダの推移(${range})`} {...daySelect(days, p.onSelect)}>
        <Grid y={y} />
        <SelLine i={sel} n={n} top={T - 4} bottom={bottom} />
        <g font-size="9.5" fill="var(--muted)" text-anchor="end" dominant-baseline="central">
          <text x={L - 6} y={y(5)}>
            5
          </text>
          <text x={L - 6} y={y(1)}>
            1
          </text>
        </g>
        <Area values={bodies} n={n} y={y} bottom={bottom} color="var(--body)" opacity={0.13} />
        <Line values={bodies} n={n} y={y} color="var(--body)" />
        <BodyPoints values={bodies} n={n} y={y} sel={sel} />
      </svg>
    </div>
  )
}

/** 睡眠の棒(夜＋二度寝)。showAvg なら平均の点線 */
export function SleepChart(p: { days: string[]; data: AppData; selected: string | null; onSelect?: (d: string) => void; showAvg: boolean }) {
  const { days, data } = p
  if (days.length === 0) return null
  const sel = p.selected ? days.indexOf(p.selected) : -1
  const avg = periodAverage(days, data).sleepMin
  const y2 = (min: number) => T + ((10 - Math.min(10, min / 60)) * (H2 - T - B2)) / 10
  const n = days.length
  const barW = Math.max(4, Math.min(7, (W - L - R) / Math.max(1, n) - 2))
  return (
    <svg viewBox={`0 0 ${W} ${H2}`} class="chart" role="img" aria-label="睡眠時間の推移" {...daySelect(days, p.onSelect)}>
      {[0, 4, 8].map((h) => (
        <g>
          <line x1={L} x2={W - R} y1={y2(h * 60)} y2={y2(h * 60)} stroke="var(--line)" stroke-width="0.6" />
          <text x={L - 4} y={y2(h * 60)} font-size="9.5" fill="var(--muted)" text-anchor="end" dominant-baseline="central">
            {h}h
          </text>
        </g>
      ))}
      <SelLine i={sel} n={n} top={T - 4} bottom={H2 - B2} />
      {days.map((d, i) => {
        const r = data.sleeps[d]
        if (!r) return null
        const cx = x(i, n)
        const night = nightMin(r)
        const nap = napMin(r)
        return (
          <g>
            {night > 0 && <rect x={cx - barW / 2} y={y2(night)} width={barW} height={H2 - B2 - y2(night)} rx="2" fill="var(--accent)" fill-opacity="0.75" />}
            {nap > 0 && <rect x={cx - barW / 2} y={y2(night + nap)} width={barW} height={y2(night) - y2(night + nap)} rx="2" fill="var(--nap)" />}
          </g>
        )
      })}
      {p.showAvg && avg != null && <line x1={L} x2={W - R} y1={y2(avg)} y2={y2(avg)} stroke="var(--warm)" stroke-width="1.5" stroke-dasharray="4 3" />}
      <AxisLabels days={days} baseline={H2 - 3} />
    </svg>
  )
}
