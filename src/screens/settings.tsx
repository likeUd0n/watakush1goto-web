import { useRef } from 'preact/hooks'
import { COUN, DOC } from '../data/entities'
import { kindsOf, type AppSettings } from '../data/settings'
import { goBack, navigate, routes } from '../nav'
import { exportBackup, importBackup, setUse } from '../store'
import { isAndroid } from './android'
import { Card, CardTitle, Chevron, Divider, EmptyText, Screen, SubTopRow } from '../ui/parts'

/** 最後に書き出した日(11月20日) */
const exportDay = (ms: number) => {
  const d = new Date(ms)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/**
 * 設定。Android 版の「睡眠時刻の自動入力」はブラウザでは使えないので外し、
 * バックアップの説明をブラウザ向けにして、最後に書き出した日を出す(モック④)
 */
export function SettingsScreen({ settings }: { settings: AppSettings }) {
  const file = useRef<HTMLInputElement>(null)
  return (
    <Screen>
      <SubTopRow title="設定" backLabel="記録へ戻る" onBack={goBack} />

      <Card>
        <CardTitle text="使うもの" />
        <SwitchRow title="診察" sub="予定・記録・医師に見せる推移" checked={settings.useDoc} onChange={(on) => setUse(DOC, on)} />
        <Divider />
        <SwitchRow title="カウンセリング" sub="予定・記録・最近の出来事と気持ち" checked={settings.useCoun} onChange={(on) => setUse(COUN, on)} />
        {kindsOf(settings).length === 0 && <EmptyText text="両方オフのあいだは、睡眠と調子の記録だけを使います。話すことやこれまでの記録は消えません。" />}
      </Card>

      <Card>
        <CardTitle text="バックアップ" />
        <EmptyText text="記録はこのブラウザの中だけにあります。ブラウザの履歴やサイトのデータを消すと、記録も消えます。ときどきファイルに書き出してください。" />
        <p class="small14">最後に書き出した日：{settings.lastExportAt != null ? exportDay(settings.lastExportAt) : 'まだ書き出していません'}</p>
        <SetRow title="ファイルに書き出す" onClick={exportBackup} />
        <Divider />
        <SetRow title="ファイルから読み込む" onClick={() => file.current?.click()} />
        <input
          ref={file}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          hidden
          onChange={(e) => {
            const f = e.currentTarget.files?.[0]
            if (f) importBackup(f)
            e.currentTarget.value = ''
          }}
        />
        <EmptyText text={'書き出すと共有画面が開きます。Google ドライブを選ぶと、ドライブに保存できます（iPhone は「"ファイル"に保存」から）。'} />
        <EmptyText text="読み込むと今の記録に足します（同じ記録は増えません）。書き出したファイルは Android 版（F-Droid）でも読み込めます。" />
      </Card>

      {isAndroid() && (
        <Card>
          <CardTitle text="Android 版" />
          <EmptyText text="お知らせや睡眠時刻の自動入力が使え、ブラウザのデータを消しても記録が残ります。" />
          <SetRow title="Android 版に移る" onClick={() => navigate(routes.android)} />
        </Card>
      )}
    </Screen>
  )
}

function SwitchRow(p: { title: string; sub: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label class="switch-row">
      <span class="grow col">
        <span class="t15">{p.title}</span>
        <span class="muted small">{p.sub}</span>
      </span>
      <input type="checkbox" role="switch" class="switch" checked={p.checked} onChange={(e) => p.onChange(e.currentTarget.checked)} />
    </label>
  )
}

function SetRow({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button type="button" class="set-row" onClick={onClick}>
      <span class="grow t15">{title}</span>
      <Chevron />
    </button>
  )
}
