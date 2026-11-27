# わたくしごと ブラウザ版（PWA）

Android 版「わたくしごと」（`C:\Users\PLANA\shinsatsu-note`、公開は `likeUd0n/watakush1goto`）のブラウザ版。

- 要件: `docs/requirements.md`。コンセプト: `docs/design/concept.md`（Android 版から写したもの）
- 画面と動きは Android 版を手本にする。Android 版の画面を変えたら、こちらも合わせるかを確かめる
- 片方だけに入っている変更は Android 版の `docs/parity.md`（差分表）で管理する。作業を始めるときに「未」の行を見る。画面・仕様・バックアップの形を変える課題を完了したら、Android 版にも入れるかを本人に聞いて表を更新する（両版共通かどうかは本人が決める）
- バックアップの JSON は Android 版と同じ形式（`src/data/backup.ts`）。形を変えるときは両方同時に変える
- Android 版の資料（コンセプト・モック・ペルソナ）を写し直すときは `scripts/sync-from-android.ps1` を使う

## コマンド
- `npm run dev`：開発サーバー
- `npm test`：テスト（Vitest）
- `npm run build`：型チェック＋ビルド（`dist/`）
- `npx vite preview --port 4173 --host 127.0.0.1`：ビルドしたものを開く。エミュレーターでは `adb reverse tcp:4173 tcp:4173` のあと `http://127.0.0.1:4173/watakush1goto-web/`
