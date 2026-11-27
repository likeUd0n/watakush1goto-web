import '@fontsource/biz-udpgothic/400.css'
import '@fontsource/biz-udpgothic/700.css'
import '@fontsource/zen-kaku-gothic-new/700.css'
import './styles.css'
import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app'
import { refresh } from './store'

// アプリ本体をキャッシュして、オフラインでも開けるようにする
registerSW({ immediate: true })

// 容量が足りないときに、ブラウザが記録を消しにくくする(許されなくても使える)
navigator.storage?.persist?.().catch(() => {})

render(<App />, document.getElementById('app')!)
refresh()
