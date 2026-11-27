import { COUN, DOC } from './entities'

/**
 * アプリ設定。localStorage に置き、バックアップの JSON には入れない(Android 版と同じ)。
 * 「使うもの」をオフにしても記録は消さず、見せないだけにする
 */
export interface AppSettings {
  useDoc: boolean
  useCoun: boolean
  onboardingDone: boolean
  aiGuideDone: boolean
  /** 初めて開いたときのホーム画面追加の案内を閉じたか */
  installGuideDone: boolean
  /** 最後に書き出した日時(ミリ秒)。まだなら null */
  lastExportAt: number | null
}

const KEY = 'watakush1goto.settings'

const DEFAULTS: AppSettings = {
  useDoc: true,
  useCoun: true,
  onboardingDone: false,
  aiGuideDone: false,
  installGuideDone: false,
  lastExportAt: null,
}

/** いま使っている相手(診察 → カウンセリングの順) */
export function kindsOf(s: AppSettings): string[] {
  const out: string[] = []
  if (s.useDoc) out.push(DOC)
  if (s.useCoun) out.push(COUN)
  return out
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 保存できない環境(プライベートモードなど)では、開いているあいだだけ覚えておく
  }
}
