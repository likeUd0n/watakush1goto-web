import { useEffect, useState } from 'preact/hooks'
import type { AppData } from '../data/entities'
import { addDays, md, mdw } from '../domain/date'
import { hm, nowMin } from '../domain/format'
import { goBack } from '../nav'
import { deleteSleep, repo, saveSleep } from '../store'
import { Card, IconButton, PrimaryButton, Screen, SubTopRow } from '../ui/parts'
import { TimeWheelSheet } from '../ui/timeWheel'

/** 未記録の日の初期値。前回も無いときに使う */
const DEFAULT_BED = 40
const DEFAULT_NAP_START = 13 * 60
const DEFAULT_NAP_END = 14 * 60 + 30

/**
 * 睡眠の画面。日付は起きた日(「前日の夜 → 当日の朝」)。
 * ブラウザからは画面オフの時刻を取れないので、Android 版の自動推定はない。初期値は前回の記録か既定の時刻
 */
export function SleepScreen({ data, date }: { data: AppData; date: string }) {
  const existing = data.sleeps[date]
  const [bed, setBed] = useState<number | null>(null)
  const [wake, setWake] = useState(0)
  const [napOn, setNapOn] = useState(false)
  const [napS, setNapS] = useState(DEFAULT_NAP_START)
  const [napW, setNapW] = useState(DEFAULT_NAP_END)
  const [picker, setPicker] = useState<'night' | 'nap' | null>(null)

  // 初めて開いたときだけ初期値を決める(記録があればそれ、無ければ前回 → 既定)
  useEffect(() => {
    if (existing) {
      setBed(existing.sleepMin)
      setWake(existing.wakeMin)
      setNapOn(existing.napSleepMin != null && existing.napWakeMin != null)
      if (existing.napSleepMin != null) setNapS(existing.napSleepMin)
      if (existing.napWakeMin != null) setNapW(existing.napWakeMin)
    } else {
      repo.latestSleep().then((last) => {
        setBed(last?.sleepMin ?? DEFAULT_BED)
        setWake(last?.wakeMin ?? Math.round(nowMin() / 5) * 5 % 1440)
      })
    }
  }, [date])

  return (
    <Screen>
      <SubTopRow
        title="睡眠"
        backLabel="記録へ戻る"
        onBack={goBack}
        end={
          existing && (
            <IconButton
              icon="trash"
              label="この日の睡眠の記録を削除"
              onClick={() => {
                deleteSleep(date)
                goBack()
              }}
            />
          )
        }
      />
      <p class="bold">
        {md(addDays(date, -1))}の夜 → {mdw(date)}の朝
      </p>
      {bed != null && (
        <>
          <Card label="夜の睡眠">
            <TimePair start={bed} end={wake} onClick={() => setPicker('night')} />
            {!napOn && (
              <button type="button" class="add-nap" onClick={() => setNapOn(true)}>
                ＋ 二度寝・昼寝
              </button>
            )}
          </Card>
          {napOn && (
            <Card label="二度寝・昼寝">
              <div class="row">
                <h2 class="title-small grow">二度寝・昼寝</h2>
                <IconButton icon="close" label="二度寝・昼寝を外す" onClick={() => setNapOn(false)} />
              </div>
              <TimePair start={napS} end={napW} onClick={() => setPicker('nap')} />
            </Card>
          )}
          <PrimaryButton
            text="保存する"
            icon="check"
            wide
            onClick={() => {
              saveSleep({
                date,
                sleepMin: bed,
                wakeMin: wake,
                napSleepMin: napOn ? napS : null,
                napWakeMin: napOn ? napW : null,
                updatedAt: Date.now(),
              })
              goBack()
            }}
          />
        </>
      )}

      {picker === 'night' && (
        <TimeWheelSheet
          title="夜の睡眠"
          slots={[
            { label: '寝た', minutes: bed ?? DEFAULT_BED, bedLayout: true },
            { label: '起きた', minutes: wake },
          ]}
          showDuration
          onDismiss={() => setPicker(null)}
          onConfirm={([b, w]) => {
            setBed(b)
            setWake(w)
            setPicker(null)
          }}
        />
      )}
      {picker === 'nap' && (
        <TimeWheelSheet
          title="二度寝・昼寝"
          slots={[
            { label: '寝た', minutes: napS },
            { label: '起きた', minutes: napW },
          ]}
          showDuration
          onDismiss={() => setPicker(null)}
          onConfirm={([s, w]) => {
            setNapS(s)
            setNapW(w)
            setPicker(null)
          }}
        />
      )}
    </Screen>
  )
}

/** 寝た・起きたの2つの時刻。押すと時刻のシートを開く */
function TimePair({ start, end, onClick }: { start: number; end: number; onClick: () => void }) {
  return (
    <div class="times">
      <TimeCell label="寝た" minutes={start} onClick={onClick} />
      <TimeCell label="起きた" minutes={end} onClick={onClick} />
    </div>
  )
}

function TimeCell({ label, minutes, onClick }: { label: string; minutes: number; onClick: () => void }) {
  return (
    <button type="button" class="time-cell" onClick={onClick} aria-label={`${label} ${hm(minutes)}(押すと時刻を変える)`}>
      <span class="muted small">{label}</span>
      <b>{hm(minutes)}</b>
    </button>
  )
}
