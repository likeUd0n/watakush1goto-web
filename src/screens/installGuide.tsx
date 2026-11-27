import { useEffect, useState } from 'preact/hooks'
import { Card, PrimaryButton } from '../ui/parts'

// 初めて開いたときだけ出す、ホーム画面への追加の案内(モック①②)

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// beforeinstallprompt は読み込み直後に来ることがあるので、画面より先に受け取っておく
let deferred: BeforeInstallPromptEvent | null = null
const waiters = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  waiters.forEach((w) => w())
})

/** ホーム画面から開いているか(ブラウザのタブではない) */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

export function InstallGuide({ onDone }: { onDone: () => void }) {
  const ios = isIos()
  const [canPrompt, setCanPrompt] = useState(deferred != null)
  const [noPrompt, setNoPrompt] = useState(false)
  useEffect(() => {
    const w = () => setCanPrompt(true)
    waiters.add(w)
    return () => {
      waiters.delete(w)
    }
  }, [])

  const install = async () => {
    if (!deferred) {
      setNoPrompt(true)
      return
    }
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    if (outcome === 'accepted') onDone()
  }

  return (
    <main class="screen install">
      <Card>
        <h1 class="title-large">わたくしごと</h1>
        <p>調子と睡眠を記録して、診察やカウンセリングで先生に見せる1画面にまとめます。</p>
        <p class="body-small">記録はこのスマホのブラウザの中だけに保存します。サーバーには送りません。通知はありません。書ける日だけで大丈夫です。</p>
      </Card>
      {ios ? (
        <>
          <Card>
            <h2 class="title-medium">ホーム画面に追加してください</h2>
            <p class="body-small">Safari のタブのままだと、7日ほど開かないと記録が消えることがあります。ホーム画面から開けば消えません。</p>
          </Card>
          <Card>
            <ol class="steps-list">
              <li>
                画面下の <span class="kbd">共有</span> を押す
              </li>
              <li>
                <b>「ホーム画面に追加」</b>を選ぶ（見つからなければ下にスクロール）
              </li>
              <li>
                右上の<b>「追加」</b>を押す
              </li>
              <li>ホーム画面の「わたくしごと」から開く</li>
            </ol>
          </Card>
          <div class="install-btns">
            <button type="button" class="text-btn" onClick={onDone}>
              あとで（ブラウザのまま使う）
            </button>
          </div>
        </>
      ) : (
        <>
          <Card>
            <h2 class="title-medium">ホーム画面に追加しておくと便利です</h2>
            <p class="body-small">ほかのアプリと同じように、アイコンから開けます。ネットにつながっていなくても使えます。</p>
            {noPrompt && !canPrompt && (
              <p class="body-small">
                ここから追加できませんでした。ブラウザの右上の <span class="kbd">⋮</span> から<b>「ホーム画面に追加」</b>か<b>「アプリをインストール」</b>を選んでください。
              </p>
            )}
          </Card>
          <div class="install-btns">
            <PrimaryButton text="ホーム画面に追加する" wide onClick={install} />
            <button type="button" class="text-btn" onClick={onDone}>
              ブラウザのまま使う
            </button>
          </div>
        </>
      )}
    </main>
  )
}
