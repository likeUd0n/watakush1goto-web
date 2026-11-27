import { useEffect, useState } from 'preact/hooks'
import { kindLabel } from './data/entities'
import { kindsOf } from './data/settings'
import { openTab, useRoute } from './nav'
import { ConditionScreen } from './screens/condition'
import { HistoryScreen } from './screens/history'
import { InstallGuide, isStandalone } from './screens/installGuide'
import { RecordScreen } from './screens/record'
import { SettingsScreen } from './screens/settings'
import { SleepScreen } from './screens/sleep'
import { VisitScreen } from './screens/visit'
import { VisitFormSheet } from './screens/visitSheets'
import { dismissCrisis, dismissToast, runUndo, setInstallGuideDone, setOnboardingDone, setVisitMode, useApp, type Toast } from './store'
import { CoachId, CoachMarkOverlay, recordCoachSteps, visitCoachSteps } from './ui/coach'
import { Icon } from './ui/icons'
import { CrisisSheet } from './ui/parts'

/** 画面の行き先。タブは2つ、サブ画面は記録タブから深さ1だけ（Android 版 ui/nav/AppNav.kt と同じ） */
export function App() {
  const { data, settings, toast, crisis, selectedDate, visitMode } = useApp()
  const route = useRoute()
  const [help, setHelp] = useState(false)
  const [visitForm, setVisitForm] = useState<[string, string] | null>(null)
  const kinds = kindsOf(settings)
  const visitTabVisible = kinds.length > 0
  const visitLabel = kinds.length === 1 ? kindLabel(kinds[0]) : '診察'

  // 診察タブを隠したら、記録へ戻す
  const name = route.name === 'visit' && !visitTabVisible ? 'record' : route.name
  const isTab = name === 'record' || name === 'visit'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.name, (route as { date?: string }).date])

  if (!data) return <div class="app" />

  // 初めて開いたとき、ホーム画面から開いていなければ追加を案内する
  if (!settings.installGuideDone && !isStandalone()) {
    return (
      <div class="app">
        <InstallGuide onDone={setInstallGuideDone} />
      </div>
    )
  }

  const showFirstCoach = !settings.onboardingDone && name === 'record'

  return (
    <div class="app">
      {name === 'record' && (
        <RecordScreen
          data={data}
          settings={settings}
          selected={selectedDate}
          onHelp={() => setHelp(true)}
          onOpenVisitTab={() => {
            setVisitMode('prep')
            openTab('visit')
          }}
          onRecordVisit={(k, d) => setVisitForm([k, d])}
        />
      )}
      {name === 'visit' && <VisitScreen data={data} settings={settings} mode={visitMode} onHelp={() => setHelp(true)} />}
      {route.name === 'sleep' && <SleepScreen key={route.date} data={data} date={route.date} />}
      {route.name === 'condition' && <ConditionScreen key={`${route.date}/${route.id}`} data={data} date={route.date} id={route.id} page={route.page} />}
      {route.name === 'history' && <HistoryScreen data={data} />}
      {route.name === 'settings' && <SettingsScreen settings={settings} />}

      {isTab && (
        <nav class="tabs" aria-label="タブ">
          <button type="button" class={`tab ${name === 'record' ? 'on' : ''}`} aria-label="記録" aria-current={name === 'record' ? 'page' : undefined} onClick={() => openTab('record')}>
            <Icon name="rec" size={28} />
          </button>
          {visitTabVisible && (
            <button
              type="button"
              class={`tab ${name === 'visit' ? 'on' : ''}`}
              aria-label={visitLabel}
              aria-current={name === 'visit' ? 'page' : undefined}
              data-coach={CoachId.VISIT_TAB}
              onClick={() => openTab('visit')}
            >
              <Icon name="visit" size={28} />
            </button>
          )}
        </nav>
      )}

      {toast && <ToastBar key={toast.id} toast={toast} raised={isTab} />}

      {/* 初回のナビゲーションガイド または 右上「？」から */}
      {showFirstCoach ? (
        <CoachMarkOverlay steps={recordCoachSteps(visitTabVisible)} onFinish={setOnboardingDone} />
      ) : (
        help && <CoachMarkOverlay steps={name === 'visit' ? visitCoachSteps() : recordCoachSteps(visitTabVisible)} onFinish={() => setHelp(false)} />
      )}

      {visitForm && <VisitFormSheet data={data} settings={settings} kind0={visitForm[0]} date0={visitForm[1]} onDismiss={() => setVisitForm(null)} />}
      {crisis && <CrisisSheet onDismiss={dismissCrisis} />}
    </div>
  )
}

/** 下に出るお知らせ。「元に戻す」があれば長めに出す */
function ToastBar({ toast, raised }: { toast: Toast; raised: boolean }) {
  useEffect(() => {
    const id = setTimeout(() => dismissToast(toast.id), toast.undo ? 8000 : 3000)
    return () => clearTimeout(id)
  }, [])
  return (
    <div class={`toast ${raised ? 'raised' : ''}`} role="status">
      <span class="grow">{toast.message}</span>
      {toast.undo && (
        <button type="button" class="toast-undo" onClick={() => runUndo(toast)}>
          元に戻す
        </button>
      )}
      <button type="button" class="toast-close" aria-label="閉じる" onClick={() => dismissToast(toast.id)}>
        ×
      </button>
    </div>
  )
}
