import { useState } from 'preact/hooks'
import type { AiPrompt } from '../domain/aiPrompt'
import { saveAiAnswer, toast } from '../store'
import { Chevron, CrisisBox, MiniButton, NoteField, PrimaryButton, Sheet, SheetActions, SubButton } from '../ui/parts'

// 「AIで整理」のシート（Android 版 ui/screens/AiSheets.kt と同じ流れ）

/** 初回のみ表示する「AIで整理」の使い方 */
export function AiTutorialSheet({ onContinue, onDismiss }: { onContinue: () => void; onDismiss: () => void }) {
  return (
    <Sheet title="AIで整理の使い方" onDismiss={onDismiss}>
      <p>手持ちのAIアプリ（ChatGPTやGeminiなど）を使って、話すことを診察室で見せやすくまとめます。</p>
      <div class="col gap10">
        <TutorialStep num="1" title="AIへ送る" body="次の画面で「コピー」または「アプリ」から、まとめた文章をAIアプリへ渡します。" />
        <TutorialStep num="2" title="AIの返答をコピー" body="AIが診察・カウンセリング向けに整理した返答をコピーします。" />
        <TutorialStep num="3" title="「答えを貼る」に保存" body="このアプリに戻って「答えを貼る」を押すと、先生に見せる画面に自動で反映されます。" />
      </div>
      <p class="note12">※ このアプリ自体は記録をネットに送りません。渡した文章は選んだAIアプリの会社に送られます。</p>
      <SheetActions>
        <SubButton text="やめる" onClick={onDismiss} />
        <PrimaryButton text="わかった・続ける" onClick={onContinue} />
      </SheetActions>
    </Sheet>
  )
}

function TutorialStep({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div class="tutorial-step">
      <span class="step-num">{num}</span>
      <div class="col gap2">
        <b>{title}</b>
        <span class="muted small">{body}</span>
      </div>
    </div>
  )
}

const canShareText = () => typeof navigator.share === 'function' && (navigator.canShare?.({ text: 'a' }) ?? true)

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * AIアプリへ渡す文の確認。全文を見てから「コピー」か「アプリ」(OS の共有画面)で渡す。
 * 共有で長文が欠けるアプリがありうるので、コピーを主ボタンにしておく。共有できない環境(PC など)ではコピーだけ
 */
export function AiShareSheet({ prompt, onShowTutorial, onDismiss }: { prompt: AiPrompt; onShowTutorial: () => void; onDismiss: () => void }) {
  const [preview, setPreview] = useState(false)
  return (
    <Sheet title="AIアプリへ渡す" onDismiss={onDismiss}>
      <div class="flow-hint">
        <span class="grow">① AIへ送る → ② 返答をコピー → ③ 「答えを貼る」へ</span>
        <MiniButton text="手順" icon="help" onClick={onShowTutorial} />
      </div>
      {prompt.excluded > 0 && (
        <>
          <p class="body-small">{prompt.excluded}件の文は外しました。</p>
          <CrisisBox />
        </>
      )}
      <div class="preview">
        <button type="button" class="fold-row accent-text" aria-expanded={preview} onClick={() => setPreview(!preview)}>
          <span class="grow">{preview ? '渡す文章を閉じる' : `渡す文章を確認する（${prompt.text.length}文字）`}</span>
          <Chevron open={preview} />
        </button>
        {preview && (
          <pre class="preview-text" aria-label="AIに渡す文">
            {prompt.text}
          </pre>
        )}
      </div>
      <p class="body-small">AIアプリに渡した内容は、そのAIの会社に送られます。</p>
      <SheetActions>
        <SubButton text="やめる" onClick={onDismiss} />
        {canShareText() && (
          <SubButton
            text="アプリ"
            onClick={async () => {
              try {
                await navigator.share({ text: prompt.text })
                onDismiss()
              } catch (e) {
                if (!(e instanceof DOMException && e.name === 'AbortError')) toast('共有できませんでした。コピーを使ってください')
              }
            }}
          />
        )}
        <PrimaryButton
          text="コピー"
          onClick={async () => {
            toast((await copyText(prompt.text)) ? 'コピーしました' : 'コピーできませんでした')
            onDismiss()
          }}
        />
      </SheetActions>
    </Sheet>
  )
}

/**
 * AIの答えを貼るシート。ブラウザはクリップボードを勝手に読めないので、
 * 「クリップボードから貼る」を押したときだけ読む(渡した文そのものなら入れない)
 */
export function AiPasteSheet({ kinds, lastPrompt, onDismiss }: { kinds: string[]; lastPrompt: string | null; onDismiss: () => void }) {
  const [text, setText] = useState('')
  const canRead = typeof navigator.clipboard?.readText === 'function'
  return (
    <Sheet title="AIの答えを貼る" onDismiss={onDismiss}>
      <NoteField value={text} onInput={setText} label="AIの答え" rows={6} autoFocus placeholder="ここに貼り付け" />
      {canRead && (
        <div>
          <MiniButton
            text="クリップボードから貼る"
            onClick={async () => {
              try {
                const c = await navigator.clipboard.readText()
                if (c.trim() === '') toast('クリップボードが空です')
                else if (c === lastPrompt) toast('コピーされているのは、AIに渡した文です')
                else setText(c)
              } catch {
                toast('読めませんでした。入力欄を長押しして貼り付けてください')
              }
            }}
          />
        </div>
      )}
      <SheetActions>
        <SubButton text="やめる" onClick={onDismiss} />
        <PrimaryButton
          text="保存"
          disabled={text.trim() === ''}
          onClick={() => {
            saveAiAnswer(text.trim(), kinds)
            onDismiss()
          }}
        />
      </SheetActions>
    </Sheet>
  )
}
