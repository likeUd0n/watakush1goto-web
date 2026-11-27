# ブラウザ版（PWA）

モック: https://claude.ai/code/artifact/841aed9f-9597-40c7-b9e0-cd494fff2cd6（`docs/reference/mock-pwa.html`）

Android 版のリポジトリ（`C:\Users\PLANA\shinsatsu-note`）の `docs/requirements/pwa.md` から移した。以後はこちらを正とする。

## 目的
- Google Play に載せない代わりに、ブラウザ版を誰でも開ける形で公開し、インストールなしで試してもらう
- 気に入った人は JSON を書き出して、Android 版（F-Droid）に引き継げるようにする

## できること
- Android 版と同じ機能を使える：記録（睡眠・調子）、これまで、診察（準備・見せる）、AI で整理する、設定（診察・カウンセリングのオン/オフ、バックアップ）
- 初めて開いたときに、ホーム画面への追加を案内する（モック①②）
  - Android の Chrome：「ホーム画面に追加する」ボタンで追加する（`beforeinstallprompt`）
  - iPhone の Safari：共有 →「ホーム画面に追加」の手順を見せる。タブのままだと7日ほど開かないと記録が消えることを伝える
  - 案内は初回だけ出す。記録タブなどには出さない
  - 案内のあとに Android 版と同じナビゲーションガイドを出す。「ようこそ」の1枚目は案内と重なるので出さない
- オフラインで開いて使える（Service Worker でアプリ本体をキャッシュする）
- 設定で記録を JSON ファイルに書き出す・読み込む。最後に書き出した日を設定にだけ表示する（モック④）
  - 書き出すと Web 共有でファイルを OS の共有画面に渡し、Google ドライブなどを選んで保存できる。2回目からは共有画面の上の段に前回の保存先が出るので、「書き出す → ドライブ」で済む
  - ファイル名は日付入り（例: `watakushigoto-2026-11-27.txt`）。Android の Chrome は `.json` を共有できないため `.txt`（`text/plain`）で渡す。Android 版の読み込みは `text/plain` も受け付ける（Android 版 `SettingsScreen.kt` の `importer`）
  - 共有できない環境（PC など）では、ファイルとしてダウンロードする
  - 読み込みはファイル選択画面から。ドライブ上のファイルもそこで選べる
- AI で整理する：Web 共有（`navigator.share`）で OS の共有画面を開き、AI アプリに渡す。共有できない環境（PC など）では「コピー」だけを出す。答えは貼り付け欄に貼る（モック⑤⑥）
  - ブラウザはクリップボードを勝手に読めないので、Android 版のような自動の貼り付けはしない。「クリップボードから貼る」を押したときだけ読む

## 今回つくらないもの
- 睡眠時刻の自動推定（ブラウザからは画面オフの時刻を取れない）。睡眠画面の初期値は前回の記録か既定の時刻
- 通知・リマインダー（コンセプトの「やらないこと」。サーバーなしでは時刻の通知もできない）
- サーバーへの保存・端末間の同期
- Google ドライブ API での保存・自動バックアップ（ブラウザは押さないと保存できず、API でも自動にならない。iPhone のホーム画面アプリでは Google ログインが壊れやすい）。自動バックアップは Android 版の課題にする
- 記録タブなどでのホーム画面追加の再案内、書き出しの催促
- PC 向けの画面（スマホ幅の画面を中央に表示するだけ）
- Android 版とのコードの共有（Compose の Web 版は使わない）
- ダークモード（Android 版もライトのみ）

## 使う既存の仕組み（Android 版のリポジトリのもの）
- 画面と動きの手本：`app/src/main/java/app/shinsatsunote/` のすべての画面（`ui/screens/*.kt`）と `domain/AiPrompt.kt`・`domain/Format.kt`・`domain/Crisis.kt`
- 色：`ui/theme/Color.kt`（`Paper` `#EEF1F4`・`Accent` `#2E5A88` などをそのまま CSS 変数にする）。文字は `ui/theme/Type.kt` と同じ BIZ UDPゴシック と Zen Kaku Gothic New
- バックアップの形式：`data/Backup.kt`（`format: "shinsatsu-note"`・`version: 1`、`sleep_records`・`condition_records`・`consult_memos`・`visits`・`appointments`・`ai_summaries`）と、重複させずに足す `planMerge()` の規則
- データの形：`data/Entities.kt`（日付は `"YYYY-MM-DD"`、時刻は 0:00 からの分、相手は `"doc"`/`"coun"`）
- 見た目の土台：`docs/reference/prototype-mvp-v19.html`（ただし、v19 以降に実装で変えた部分は Android 版を正とする）

## 使う技術
- 確認日はすべて 2026-11-27。版は公開から2週間以上たったものに固定した
- TypeScript 6.0.3 ＋ Preact 10.29.8（Compose と同じく関数で画面を書けるので、Android 版から移しやすい）。Preact 11 と TypeScript 7 は出ているが、使い慣れた版を選んだ
- Vite 8.3.8（2026-11-11 公開。8.4.0 は公開から2週間たっていない。[公式](https://vite.dev/blog/announcing-vite8)）
- vite-plugin-pwa 2.0.0（Vite 8 に対応。[npm](https://www.npmjs.com/package/vite-plugin-pwa)）：Service Worker と manifest を作る
- Dexie 4.4.7（[公式ブログ](https://dexie.org/blog/dexie-44-dexie-cloud-server-30-the-big-one)）：IndexedDB に保存する
- テスト：Vitest 5.1.0 と fake-indexeddb 6.2.8
- 文字：@fontsource/biz-udpgothic 5.3.0・@fontsource/zen-kaku-gothic-new 5.3.1。日本語フォントは字の範囲ごとに分かれていて数が多いので、最初にすべてはキャッシュせず、使った分だけキャッシュする
- 公開先：リポジトリ `watakush1goto-web`（ローカルは `C:\Users\PLANA\watakush1goto-web`）の GitHub Pages（`.github/workflows/deploy.yml`）
- iPhone の Safari では、タブで使っているサイトのデータは、使わない日が7日続くと消える。ホーム画面に追加したアプリは対象外（[WebKit の説明を引いた Apple フォーラムの回答](https://developer.apple.com/forums/thread/710157)）
- 起動時に `navigator.storage.persist()` を呼び、容量が足りないときに消されにくくする

## データ
- 保存先は IndexedDB（Dexie、データベース名 `watakush1goto`）。表と項目は `Entities.kt` と同じにする
- 設定（診察・カウンセリングのオン/オフ、最後に書き出した日、初回案内を見たか、ガイドを見たか）は localStorage の `watakush1goto.settings` に置く。バックアップの JSON には入れない（Android 版と同じ）

いつ増えるか：
1. 初めて開く → 「初回案内を見た」が localStorage に入る。記録は増えない
2. 調子を記録する → `condition_records` に1件増える
3. 再読み込み・オフラインで開き直す → 何も増えない（アプリ本体は Service Worker のキャッシュから読む）
4. 書き出す → JSON ファイルを共有画面に渡し、渡せたら「最後に書き出した日」を更新する（共有画面を閉じただけなら更新しない）
5. Android 版で書き出した JSON を読み込む → `planMerge` と同じ規則で足す。同じファイルを2回読んでも増えない

壊れうること：
- ブラウザのサイトデータを消すと、記録はすべて消える。戻せるのは書き出した JSON からだけ
- バックアップの `version` を上げたときは、Android 版も同時に読めるようにする（古いアプリは新しい版を読めない）
