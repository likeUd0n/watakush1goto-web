import { useState } from 'preact/hooks'
import { conditionsOn, type AppData, type ConditionRecord } from '../data/entities'
import { addDays, day as dayOf, daysBetweenCount, isoWeekday, md, mdw, monday, month as monthOf, monthDays, today as todayKey, weekdayJ, year as yearOf } from '../domain/date'
import { avgBody, avgMind, durJ, durShort, hm, level, napMin, nightMin, totalMin } from '../domain/format'
import { goBack, navigate, routes } from '../nav'
import { ChartHead, MoodChart, MoodFilterChips, SleepChart, SummaryRow, periodAverage, type MoodFilter } from '../ui/charts'
import { Icon } from '../ui/icons'
import { Card, Chevron, EmptyText, EntryIcon, IconButton, MiniBattery, MiniButton, MiniMind, Screen } from '../ui/parts'

const openSleep = (d: string) => navigate(routes.sleep(d))
const openCondition = (d: string, id: number | null | undefined) => navigate(routes.condition(d, id))

/** 振り返り(個人で長期的に振り返る)。月ごとのグラフと週ごとの折りたたみ一覧 */
export function HistoryScreen({ data }: { data: AppData }) {
  const t = todayKey()
  const [ym, setYm] = useState(yearOf(t) * 12 + monthOf(t) - 1)
  const [raw, setRaw] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<MoodFilter>('all')
  const y = Math.floor(ym / 12)
  const m = (ym % 12) + 1
  const isThisMonth = y === yearOf(t) && m === monthOf(t)
  const days = monthDays(y, m)
  const selected = selectedKey && days.includes(selectedKey) ? selectedKey : null
  const has = (d: string) => data.sleeps[d] != null || conditionsOn(data, d).length > 0

  // 週ごとの折りたたみ(新しい週から)。一覧モードでは全部開く
  const recorded = days.filter((d) => d <= t).reverse().filter(has)
  const weeks: [string, string[]][] = []
  for (const d of recorded) {
    const mon = monday(d)
    const w = weeks.find(([k]) => k === mon)
    if (w) w[1].push(d)
    else weeks.push([mon, [d]])
  }
  const thisMon = monday(t)

  return (
    <Screen>
      <div class="top-row">
        <IconButton icon="left" label="記録へ戻る" onClick={goBack} />
        <div class="month-nav grow">
          <IconButton
            icon="left"
            label="前の月"
            onClick={() => {
              setYm(ym - 1)
              setSelectedKey(null)
            }}
          />
          <h1 class="title-large">
            {y}年{m}月
          </h1>
          <IconButton
            icon="right"
            label="次の月"
            disabled={isThisMonth}
            onClick={() => {
              setYm(ym + 1)
              setSelectedKey(null)
            }}
          />
        </div>
        <MiniButton text={raw ? 'グラフ' : '一覧'} icon={raw ? 'chart' : 'list'} onClick={() => setRaw(!raw)} label={raw ? 'グラフ表示に戻す' : '生の記録の一覧に切り替え'} />
      </div>

      {!raw && (
        <>
          <Card>
            <SummaryRow avg={periodAverage(days.filter((d) => d <= t), data)} />
            <ChartHead
              title="ココロ・カラダ"
              legend={[
                ['var(--accent)', 'ココロ'],
                ['var(--body)', 'カラダ'],
              ]}
            />
            <MoodFilterChips current={filter} onChange={setFilter} />
            <MoodChart days={days} data={data} selected={selected} onSelect={setSelectedKey} shareAxis filter={filter} />
            <ChartHead
              title="睡眠"
              legend={[
                ['var(--accent)', '夜'],
                ['var(--nap)', '二度寝'],
              ]}
              dashed="平均"
            />
            <SleepChart days={days} data={data} selected={selected} onSelect={setSelectedKey} showAvg />
            <p class="body-small">点や棒を押すと、その日の記録を見られます</p>
          </Card>
          {selected && (
            <Card>
              <div class="row">
                <h2 class="title-medium grow">{mdw(selected)}</h2>
                <IconButton icon="close" label="この日の記録を閉じる" onClick={() => setSelectedKey(null)} />
              </div>
              {has(selected) ? <DayItems date={selected} data={data} /> : <EmptyText text="この日の記録はありません" />}
            </Card>
          )}
        </>
      )}

      {weeks.length === 0 && <p class="body-small empty-month">この月の記録はありません</p>}
      {weeks.map(([mon, wdays]) => {
        const ago = Math.floor(daysBetweenCount(mon, thisMon) / 7)
        const range = `${md(mon)}〜${md(addDays(mon, 6))}`
        return (
          <WeekFold
            key={`${mon}-${raw}`}
            days={wdays}
            data={data}
            title={isThisMonth ? (ago === 0 ? '今週' : ago === 1 ? '先週' : `${ago}週間前`) : range}
            sub={isThisMonth ? range : `${wdays.length}日分`}
            initiallyOpen={raw || (isThisMonth && ago === 0)}
            today={t}
          />
        )
      })}
    </Screen>
  )
}

function WeekFold(p: { days: string[]; data: AppData; title: string; sub: string; initiallyOpen: boolean; today: string }) {
  const [open, setOpen] = useState(p.initiallyOpen)
  const minds = p.days.flatMap((d) => {
    const v = avgMind(conditionsOn(p.data, d))
    return v == null ? [] : [level(v)]
  })
  const sleeps = p.days.flatMap((d) => {
    const s = p.data.sleeps[d]
    const t = s ? totalMin(s) : 0
    return t > 0 ? [t] : []
  })
  const lo = Math.min(...minds)
  const hi = Math.max(...minds)
  return (
    <section class="week">
      <button type="button" class="week-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span class="grow col">
          <b class="title-medium week-title">{p.title}</b>
          <span class="muted small">{p.sub}</span>
        </span>
        {minds.length > 0 && (
          <>
            <MiniMind value={lo} size={16} />
            <span class="muted small">{lo === hi ? `${lo}` : `${lo}〜${hi}`}</span>
          </>
        )}
        <Icon name="moon" size={15} class="muted" />
        <span class="muted small">{sleeps.length > 0 ? durShort(Math.trunc(sleeps.reduce((a, b) => a + b, 0) / sleeps.length)) : '-'}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div>
          <hr class="divider" />
          {p.days.map((d) => (
            <div class="week-day">
              <div class="week-date">
                <b class={d === p.today ? 'accent' : ''}>{dayOf(d)}</b>
                <span class={isoWeekday(d) === 7 ? 'warm' : 'muted'}>{d === p.today ? '今日' : weekdayJ(d)}</span>
              </div>
              <div class="grow">
                <DayItems date={d} data={p.data} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const condDesc = (r: ConditionRecord) => `調子 ${hm(r.timeMin)} ココロ${r.mind ?? '-'} カラダ${r.body ?? '-'} ${r.note}`

/** その日の記録の行(睡眠・調子)。押すと編集画面へ */
export function DayItems({ date, data }: { date: string; data: AppData }) {
  const sr = data.sleeps[date]
  const conds = conditionsOn(data, date)
  const [open, setOpen] = useState(false)
  const notes = conds
    .map((c) => c.note)
    .filter((n) => n !== '')
    .join(' / ')
  return (
    <div>
      {sr && (
        <button type="button" class="item-row" onClick={() => openSleep(date)} aria-label={`睡眠 ${durJ(nightMin(sr))}`}>
          <EntryIcon icon="moon" box={30} />
          <span class="grow col">
            <b>{durJ(nightMin(sr))}</b>
            {napMin(sr) > 0 && <span class="muted small">二度寝 {durJ(napMin(sr))}</span>}
          </span>
          <Chevron />
        </button>
      )}
      {conds.length === 1 && (
        <button type="button" class="item-row" onClick={() => openCondition(date, conds[0].id)} aria-label={condDesc(conds[0])}>
          <span class="face-slot">
            <MiniMind value={conds[0].mind} size={24} />
          </span>
          <span class="grow col">
            <MiniBattery value={conds[0].body} />
            {conds[0].note !== '' && <span>{conds[0].note}</span>}
          </span>
          <span class="muted small">1件</span>
          <Chevron />
        </button>
      )}
      {conds.length > 1 && (
        <>
          <button type="button" class="item-row" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={`調子 ${conds.length}件(押すと開く)`}>
            <span class="face-slot">
              <MiniMind value={avgMind(conds)} size={24} />
            </span>
            <span class="grow col min0">
              <MiniBattery value={avgBody(conds)} />
              {!open && notes !== '' && <span class="ellipsis">{notes}</span>}
            </span>
            <span class="muted small">{conds.length}件</span>
            <Chevron open={open} />
          </button>
          {open &&
            conds.map((r) => (
              <button type="button" class="item-row indent" onClick={() => openCondition(date, r.id)} aria-label={condDesc(r)}>
                <span class="muted small">{hm(r.timeMin)}</span>
                <MiniMind value={r.mind} />
                <MiniBattery value={r.body} />
                <span class="grow">{r.note}</span>
                <Chevron />
              </button>
            ))}
        </>
      )}
    </div>
  )
}
