import { useEffect, useRef, useState } from 'preact/hooks'

// 画面の行き先(#/record など)と、スマホの「戻る」でシートを閉じるしくみ

export type Route =
  | { name: 'record' }
  | { name: 'visit' }
  | { name: 'sleep'; date: string }
  | { name: 'condition'; date: string; id: number | null; page: 1 | 2 }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'android' }

export function parseRoute(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/')
  switch (p[0]) {
    case 'visit':
      return { name: 'visit' }
    case 'sleep':
      if (p[1]) return { name: 'sleep', date: p[1] }
      break
    case 'condition':
      if (p[1]) return { name: 'condition', date: p[1], id: p[2] && p[2] !== 'new' ? Number(p[2]) : null, page: p[3] === '2' ? 2 : 1 }
      break
    case 'history':
      return { name: 'history' }
    case 'settings':
      return { name: 'settings' }
    case 'android':
      return { name: 'android' }
  }
  return { name: 'record' }
}

export const routes = {
  record: '#/record',
  visit: '#/visit',
  sleep: (date: string) => `#/sleep/${date}`,
  /** id が null なら新しく足す */
  condition: (date: string, id: number | null | undefined) => `#/condition/${date}/${id ?? 'new'}`,
  history: '#/history',
  settings: '#/settings',
  android: '#/android',
}

const routeListeners = new Set<() => void>()

/** アプリの中で開いた画面には印を付け、「戻る」で前の画面へ戻れるようにする */
export function navigate(hash: string) {
  history.pushState({ inApp: true }, '', hash)
  routeListeners.forEach((l) => l())
}

/** 履歴を増やさずに画面を替える */
export function replace(hash: string) {
  history.replaceState(history.state, '', hash)
  routeListeners.forEach((l) => l())
}

/** サブ画面の戻る。アプリの中から来たなら1つ戻り、直接開いたなら記録へ */
export function goBack() {
  if (history.state?.inApp) history.back()
  else replace(routes.record)
}

/** 調子の2ページ目へ。戻るで1ページ目に戻れるよう履歴に積む */
export function openSecondPage(hash: string) {
  history.pushState({ inApp: true, parentInApp: !!history.state?.inApp }, '', hash)
  routeListeners.forEach((l) => l())
}

/** 2ページ目から、調子の画面を開く前の画面へ戻る */
export function leaveSecondPage() {
  if (history.state?.parentInApp) history.go(-2)
  else replace(routes.record)
}

/** 下のタブ。記録 → 診察は履歴に積み、診察 → 記録は戻る(Android 版と同じく、診察タブで戻ると記録へ) */
export function openTab(tab: 'record' | 'visit') {
  const now = parseRoute(location.hash).name
  if (now === tab) return
  if (tab === 'visit') navigate(routes.visit)
  else if (history.state?.inApp) history.back()
  else replace(routes.record)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  useEffect(() => {
    const l = () => setRoute(parseRoute(location.hash))
    routeListeners.add(l)
    window.addEventListener('popstate', l)
    return () => {
      routeListeners.delete(l)
      window.removeEventListener('popstate', l)
    }
  }, [])
  return route
}

// ---- 戻るでシートを閉じる ----
// 開いたときに同じ URL の履歴を1つ積み、戻るでそれが外れたら閉じる。
// ボタンで閉じたときは積んだ履歴を自分で外す(外し終わるまで、次に開くシートの積み上げを待たせる)

interface Entry {
  close: () => void
  pushed: boolean
}

const stack: Entry[] = []
let ignorePops = 0
const waiting: Entry[] = []

function push(e: Entry) {
  history.pushState({ ...(history.state ?? {}), sheet: true }, '')
  e.pushed = true
}

window.addEventListener('popstate', () => {
  if (ignorePops > 0) {
    ignorePops--
    if (ignorePops === 0) waiting.splice(0).forEach(push)
    return
  }
  const top = stack.pop()
  if (top) top.close()
})

/** 開いているあいだ、スマホの「戻る」で onClose を呼ぶ */
export function useBackClose(onClose: () => void) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    const e: Entry = { close: () => ref.current(), pushed: false }
    stack.push(e)
    if (ignorePops > 0) waiting.push(e)
    else push(e)
    return () => {
      const i = stack.indexOf(e)
      if (i < 0) return // 戻るで閉じた
      stack.splice(i, 1)
      const w = waiting.indexOf(e)
      if (w >= 0) {
        waiting.splice(w, 1)
        return
      }
      if (e.pushed) {
        ignorePops++
        history.back()
      }
    }
  }, [])
}
