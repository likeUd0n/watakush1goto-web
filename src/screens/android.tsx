import { goBack } from '../nav'
import { exportBackup } from '../store'
import { Card, CardTitle, EmptyText, PrimaryButton, Screen, SubButton, SubTopRow } from '../ui/parts'

/** Android 版の配布先(まだプレリリースだけなので、最新版のページではなく一覧を開く) */
const RELEASES_URL = 'https://github.com/likeUd0n/watakush1goto/releases'

/** Android の端末で開いているか(iPhone では Android 版を入れられないので、案内を出さない) */
export const isAndroid = () => /Android/i.test(navigator.userAgent)

/** Android 版への移り方の案内。設定と、記録タブの★から開く */
export function AndroidScreen() {
  return (
    <Screen>
      <SubTopRow title="Android 版に移る" backLabel="戻る" onBack={goBack} />

      <Card>
        <CardTitle text="Android 版でできること" />
        <ul class="android-list">
          <li>記録していない日だけ、1日1回お知らせ（オンにしたときだけ）</li>
          <li>画面を消した時刻から、寝た時刻を自動で入れる</li>
          <li>ブラウザの履歴やサイトのデータを消しても、記録は消えない</li>
        </ul>
        <EmptyText text="記録の画面と使い方はブラウザ版と同じです。ブラウザ版のままでも困ることはありません。" />
      </Card>

      <Card>
        <CardTitle text="移り方" />
        <ol class="android-list">
          <li>
            今の記録をファイルに書き出す
            <SubButton text="ファイルに書き出す" onClick={exportBackup} wide />
          </li>
          <li>
            GitHub のページで、いちばん上の「watakush1goto-….apk」を押してダウンロードする
            <PrimaryButton text="ダウンロードのページを開く" onClick={() => window.open(RELEASES_URL, '_blank', 'noopener')} wide />
          </li>
          <li>ダウンロードしたファイルを開く。「このアプリのインストールは許可されていません」と出たら、「設定」→「この提供元のアプリを許可」をオンにして戻る</li>
          <li>「インストール」を押す。Play プロテクトの確認が出たら、画面の案内に沿ってインストールを続ける</li>
          <li>Android 版を開き、設定の「ファイルから読み込む」で 1. のファイルを選ぶ</li>
        </ol>
        <EmptyText text="ブラウザ版の記録はそのまま残ります。移ったあとは、ホーム画面からブラウザ版を削除してかまいません。" />
      </Card>
    </Screen>
  )
}
