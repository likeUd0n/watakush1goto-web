import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { COUN, DOC, kindLabel } from '../data/entities'
import { level } from '../domain/format'
import { useBackClose } from '../nav'
import { Icon, type IconName } from './icons'

// 画面の部品（Android 版 ui/components/Common.kt・Parts.kt と同じ見た目）

/** ココロの顔の5段階の色(1 = つらい 〜 5 = よい) */
export const MIND_COLORS = ['#A7ACC9', '#A4BED9', '#A6CBC8', '#C2D7A4', '#F0D488']
/** カラダ(電池)の5段階の色 */
export const LEVEL_COLORS = ['#C0573B', '#CF8A3F', '#B8A845', '#7FA65A', '#4C9A6A']
export const mindColor = (v: number) => MIND_COLORS[Math.min(5, Math.max(1, v)) - 1]
export const levelColor = (v: number) => LEVEL_COLORS[Math.min(5, Math.max(1, v)) - 1]

/** 相手の色(診察は青、カウンセリングは橙) */
export const kindVar = (kind: string) => (kind === COUN ? 'var(--warm)' : 'var(--accent)')

// ---- 画面の枠 ----

/** 画面の共通の枠: 左右 16、上 12、要素の間 12 */
export const Screen = ({ children }: { children: ComponentChildren }) => <main class="screen">{children}</main>

/** 画面の上の行: 左・見出し・右 */
export function TopRow({ title, start, end }: { title: string; start?: ComponentChildren; end?: ComponentChildren }) {
  return (
    <div class="top-row">
      {start}
      <h1 class="title-large grow">{title}</h1>
      {end}
    </div>
  )
}

/** サブ画面の上の行: 戻る・見出し・右の操作 */
export const SubTopRow = (p: { title: string; backLabel: string; onBack: () => void; end?: ComponentChildren }) => (
  <TopRow title={p.title} start={<IconButton icon="left" label={p.backLabel} onClick={p.onBack} />} end={p.end} />
)

// ---- ボタン ----

/** 丸いアイコンボタン: 押せる範囲は 48、アイコンは 24 */
export function IconButton(p: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; class?: string }) {
  return (
    <button type="button" class={`icon-btn ${p.class ?? ''}`} aria-label={p.label} title={p.label} onClick={p.onClick} disabled={p.disabled}>
      <Icon name={p.icon} />
    </button>
  )
}

/** 画面上部の角丸アイコンタイル */
export function HeaderTile(p: { icon: IconName; label: string; onClick: () => void; coach?: string }) {
  return (
    <button type="button" class="header-tile" aria-label={p.label} title={p.label} onClick={p.onClick} data-coach={p.coach}>
      <Icon name={p.icon} size={23} />
    </button>
  )
}

interface BtnProps {
  text: string
  onClick: () => void
  icon?: IconName
  iconEnd?: boolean
  disabled?: boolean
  wide?: boolean
}

function Pill(p: BtnProps & { kind: 'primary' | 'sub' }) {
  return (
    <button type="button" class={`pill ${p.kind} ${p.wide ? 'wide' : ''}`} onClick={p.onClick} disabled={p.disabled}>
      {p.icon && !p.iconEnd && <Icon name={p.icon} size={18} />}
      <span>{p.text}</span>
      {p.icon && p.iconEnd && <Icon name={p.icon} size={18} />}
    </button>
  )
}

/** 主ボタン */
export const PrimaryButton = (p: BtnProps) => <Pill {...p} kind="primary" />
/** 控えめなボタン */
export const SubButton = (p: BtnProps) => <Pill {...p} kind="sub" />

export type Tone = 'muted' | 'accent' | 'warm'

/** 小さな枠つきボタン */
export function MiniButton(p: { text: string; onClick: () => void; icon?: IconName; tone?: Tone; label?: string }) {
  return (
    <button type="button" class={`mini-btn tone-${p.tone ?? 'muted'}`} onClick={p.onClick} aria-label={p.label}>
      {p.icon && <Icon name={p.icon} size={16} />}
      <span>{p.text}</span>
    </button>
  )
}

// ---- カード・入口 ----

export function Card({ children, class: cls, coach, label }: { children: ComponentChildren; class?: string; coach?: string; label?: string }) {
  return (
    <section class={`card ${cls ?? ''}`} data-coach={coach} aria-label={label}>
      {children}
    </section>
  )
}

/** 入口のアイコン: 淡い色の角丸の中に置く */
export function EntryIcon({ icon, box = 40, bg, tint }: { icon: IconName; box?: number; bg?: string; tint?: string }) {
  return (
    <span class="entry-ico" style={{ width: `${box}px`, height: `${box}px`, background: bg, color: tint }}>
      <Icon name={icon} size={Math.round(box * 0.55)} />
    </span>
  )
}

/** 入口のボタン: 押すとサブ画面へ。muted で未記録の薄い灰色 */
export function EntryButton(p: {
  title: string
  onClick: () => void
  icon?: IconName
  subtitle?: string | null
  muted?: boolean
  coach?: string
  label?: string
}) {
  return (
    <button type="button" class={`entry-btn ${p.muted ? 'muted' : ''}`} onClick={p.onClick} data-coach={p.coach} aria-label={p.label}>
      {p.icon && <EntryIcon icon={p.icon} />}
      <span class="grow col">
        <span class="title-medium">{p.title}</span>
        {p.subtitle && <span class="body-small">{p.subtitle}</span>}
      </span>
      <Icon name="right" size={18} class="chev-icon" />
    </button>
  )
}

/** 右向きの小さな矢印。open で下向き */
export const Chevron = ({ open }: { open?: boolean }) => <Icon name="right" size={16} class={`chev ${open ? 'open' : ''}`} />

/** カードの見出し */
export function CardTitle({ text, icon, grow }: { text: string; icon?: IconName; grow?: boolean }) {
  return (
    <h2 class={`card-title ${grow ? 'grow' : ''}`}>
      {icon && <Icon name={icon} size={17} />}
      <span>{text}</span>
    </h2>
  )
}

export const EmptyText = ({ text }: { text: string }) => <p class="body-small">{text}</p>
export const CountText = ({ text }: { text: string }) => <span class="count">{text}</span>

// ---- 相手のバッジ ----
export function KindBadge({ kind }: { kind: string }) {
  return <span class={`kind-badge ${kind === COUN ? 'coun' : 'doc'}`}>{kindLabel(kind)}</span>
}

/** 相談メモの振り分け指定バッジ(診察・カウンセリング・優先) */
export function PinBadge({ kind, both }: { kind: string | null; both: boolean }) {
  const coun = !(both && kind === DOC)
  const label = both && kind === DOC ? '診察' : both && kind === COUN ? 'カウンセリング' : '優先'
  return <span class={`pin-badge ${coun ? 'warm' : 'accent'}`}>{label}</span>
}

// ---- ココロの顔・カラダの電池(小さな表示) ----

/** ココロの小さな顔。値が無ければ「-」 */
export function MiniMind({ value, size = 20 }: { value: number | null | undefined; size?: number }) {
  if (value == null) return <span class="dash">-</span>
  const v = level(value)
  const curve = [-5, -2.5, 0, 3, 5.5][v - 1]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="no-shrink">
      <circle cx="12" cy="12" r="10" fill={mindColor(v)} />
      <circle cx="9" cy="10" r="1.2" fill="var(--ink)" />
      <circle cx="15" cy="10" r="1.2" fill="var(--ink)" />
      <path d={`M8.5 15Q12 ${15 + curve} 15.5 15`} stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round" fill="none" />
    </svg>
  )
}

/** カラダの小さな電池。値が無ければ「-」 */
export function MiniBattery({ value, height = 20 }: { value: number | null | undefined; height?: number }) {
  if (value == null) return <span class="dash">-</span>
  const n = level(value)
  const col = levelColor(n)
  return (
    <svg width={height * 1.4} height={height} viewBox="0 0 28 20" aria-hidden="true" class="no-shrink">
      <rect x="1.75" y="3.75" width="21.5" height="12.5" rx="2.5" fill="none" stroke="var(--ink)" stroke-width="1.5" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect x={2 + i * 4.2 + 0.4} y="5" width="3.2" height="10" rx="1" fill={i < n ? col : 'var(--empty)'} />
      ))}
      <rect x="24.5" y="7" width="2.5" height="6" rx="1" fill="var(--ink)" />
    </svg>
  )
}

// ---- シート ----

/** 下から出るシート。見出しと中身。中身は長ければスクロールする。スマホの「戻る」でも閉じる */
export function Sheet({ title, onDismiss, children }: { title: string; onDismiss: () => void; children: ComponentChildren }) {
  useBackClose(onDismiss)
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.body.classList.add('sheet-open')
    const prev = document.activeElement as HTMLElement | null
    if (!panel.current?.querySelector('[data-autofocus]')) panel.current?.focus()
    return () => {
      if (!document.querySelector('.sheet-backdrop')) document.body.classList.remove('sheet-open')
      prev?.focus?.()
    }
  }, [])
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onDismiss()
  }
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onDismiss()} onKeyDown={onKey}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <div class="grab" aria-hidden="true" />
        <h2 class="title-large">{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** シートの下のボタンの並び。右寄せ */
export function SheetActions({ start, children }: { start?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="sheet-actions">
      {start}
      <span class="grow" />
      {children}
    </div>
  )
}

// ---- セグメント ----
export function Segmented<T extends string>(p: {
  options: [T, string][]
  selected: T
  onSelect: (v: T) => void
  coach?: string
  class?: string
}) {
  return (
    <div class={`seg ${p.class ?? ''}`} role="radiogroup" data-coach={p.coach}>
      {p.options.map(([v, label]) => (
        <button type="button" role="radio" aria-checked={v === p.selected} class={v === p.selected ? 'on' : ''} onClick={() => p.onSelect(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ---- 文の入力欄 ----
export function NoteField(p: {
  value: string
  onInput: (v: string) => void
  label: string
  placeholder?: string
  rows?: number
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (p.autoFocus) ref.current?.focus()
  }, [])
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 12 * 26)}px`
  }
  useEffect(() => {
    if (ref.current) grow(ref.current)
  }, [p.value])
  return (
    <textarea
      ref={ref}
      class="note-field"
      aria-label={p.label}
      placeholder={p.placeholder}
      rows={p.rows ?? 4}
      value={p.value}
      data-autofocus={p.autoFocus ? '' : undefined}
      onInput={(e: JSX.TargetedEvent<HTMLTextAreaElement>) => p.onInput(e.currentTarget.value)}
    />
  )
}

// ---- 相談窓口 ----
export function CrisisBox({ showTitle = true }: { showTitle?: boolean }) {
  return (
    <div class="crisis">
      {showTitle && <b class="crisis-title">ひとりで抱えないでください</b>}
      <p>つらい気持ちを話せる窓口があります。</p>
      <p>
        いのちの電話 <a href="tel:0120783556">0120-783-556</a>
      </p>
      <p>
        よりそいホットライン <a href="tel:0120279338">0120-279-338</a>(24時間)
      </p>
    </div>
  )
}

export function CrisisSheet({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Sheet title="ひとりで抱えないでください" onDismiss={onDismiss}>
      <CrisisBox showTitle={false} />
      <SheetActions>
        <SubButton text="閉じる" onClick={onDismiss} />
      </SheetActions>
    </Sheet>
  )
}

/** 押すと開閉する行(見出し＋右の補足＋矢印) */
export function FoldRow(p: { open: boolean; onToggle: () => void; children: ComponentChildren; disabled?: boolean; class?: string }) {
  return (
    <button type="button" class={`fold-row ${p.class ?? ''}`} aria-expanded={p.open} onClick={p.onToggle} disabled={p.disabled}>
      {p.children}
    </button>
  )
}

export const Divider = () => <hr class="divider" />
