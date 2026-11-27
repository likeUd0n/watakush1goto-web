# わたくしごと（ブラウザ版）

調子と睡眠を記録して、診察やカウンセリングで先生に見せる1画面にまとめるアプリの、ブラウザ版です。
Android 版（F-Droid）と同じ機能を、インストールなしでスマホのブラウザから使えます。

- 記録はブラウザの中（IndexedDB）だけに保存します。サーバーには送りません
- ホーム画面に追加すると、アプリのように開けて、オフラインでも使えます
- 設定から書き出したファイルは、Android 版でも読み込めます（逆も同じ）

## 開発

```sh
npm install
npm run dev     # 開発サーバー
npm test        # テスト
npm run build   # dist/ にビルド
```

main に push すると、GitHub Actions が GitHub Pages に公開します（`.github/workflows/deploy.yml`）。
