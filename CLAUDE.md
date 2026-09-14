# CLAUDE.md

TypeFab — GitHub Pagesで動く、日本語対応のレーザー加工向けタイポグラフィSVGエディタ。
公開URL: https://fooping-tech.github.io/TypeFab/

## 作業の進め方（必須）

1. **作業開始時に `PLANS.md` を読む。** これまでの要求・実装範囲・検証結果・未検証の境界（実機加工、材料強度など）が時系列で記録されている。既存の仕様や決定事項と矛盾しないように作業する。
2. **新しい依頼は `PLANS.md` の末尾に節を追加して記録する。** 見出しに日付（YYYY-MM-DD）を入れ、要求と完了条件を箇条書きにする。
3. **実装・検証が終わったら同じ節に結果を追記する。** テスト件数、ビルド結果、ブラウザでの確認内容、未実装・未検証の事項を事実どおりに書く。検証していないことを検証済みと書かない。
4. 利用者向けの仕様が変わったら `README.md`（日本語）も更新する。
5. **更新したら GitHub Pages へ反映する**（下記「公開手順」）。公開が成功したことまで確認して完了とする。

## 開発コマンド

Node.js 22以降。

```sh
npm ci
npm run dev      # http://127.0.0.1:5173/TypeFab/
npm test         # node --test tests/*.test.js
npm run build    # dist/ を生成
npm run preview
```

プレビューサーバーの起動にはサンドボックスのネットワーク待ち受け許可が必要な場合がある。ブラウザ確認は `@playwright/cli` を直接使った実績がある（`.playwright-cli/` と `output/` は `.gitignore` 済み）。

## 構成

Vite + 素のJavaScript（フレームワークなし）+ opentype.js + HarfBuzz WASM + Clipper の完全静的構成。

| ファイル | 役割 |
| --- | --- |
| `src/main.js` | 編集UI全体（ツールバー、キャンバス操作、プロパティ、Undo/Redo、自動保存） |
| `src/geometry.js` | 輪郭化、ブリッジ（線の途切れ／矩形差分）、加工チェック、SVG出力 |
| `src/operations.js` | 拡縮ハンドル、ブーリアン演算（結合・切り抜き・交差・XOR） |
| `src/layers.js` | レイヤー |
| `src/typography.js` | 文字組版（`layoutGlyphs` は1文字ごとの輪郭と位置）、HarfBuzzによる縦書き（vert/vrt2） |
| `src/grouping.js` | グループ（`groupId`）の作成・解除、1文字ずつの文字アイテム、部位ごとの固定パス、対象付きブリッジの引き継ぎ |
| `src/interaction.js` | 範囲選択の判定、ブラウザのShift範囲選択、レイヤー間移動の検証、ホイール／ピンチのズーム計算 |
| `src/warp.js` | Text Warp：12点のエンベロープ（4辺のベジェ）、Coonsパッチ、プリセット、許容誤差内の細分化 |
| `src/edit.js` | 重ね順（最前面へ／前面へ／背面へ／最背面へ）、複製・貼り付け用のコピー |
| `src/project.js` | プロジェクトJSONの入力検証、v1→v2移行 |
| `public/fonts/` | 同梱書体（Zen Kaku Gothic New / しっぽり明朝）とOFLライセンス |
| `tests/` | `node:test` による形状・編集・操作のテスト |

## 守るべき前提

- `vite.config.js` の `base: "/TypeFab/"` はPagesのパスに合わせている。変更しない。
- SVGはmm単位・`viewBox`付き・パスのみ（text/mask/clipPath/imageを残さない）。
- 保存済みプロジェクト（v1/v2 JSON）の互換性を壊さない。旧データの輪郭を勝手に作り直さない。
- フォント・入力テキスト・プロジェクトを外部に送信しない。
- 「切り残しなし」などの検査は材料強度や連結性を保証するものではない。そう読める表現をUIやドキュメントに書かない。
- 形状処理を変えたらテストを追加し、両方の同梱書体で確認する。
- アイテムの `contours` は常に最終形状（ワープ・長体・フィレット適用後）にする。SVG出力・図形演算・ブリッジはこれを使う。変形をCSS/SVGの `transform` だけで表現しない。

## 公開手順（GitHub Pages）

`main` へのpushで `.github/workflows/pages.yml` が `npm ci` → `npm test` → `npm run build` → Pagesデプロイを行う。テストかビルドが失敗するとデプロイされない。

1. ローカルで `npm test` と `npm run build` が通ることを確認する。
2. 変更をコミットして `main` へpushする。
3. Actionsの実行を確認する: `gh run list --workflow pages.yml --limit 1` → `gh run watch <run-id> --exit-status`
4. 公開URLが HTTP 200 を返すことを確認する: `curl -sI https://fooping-tech.github.io/TypeFab/`
5. 実行URLと結果を `PLANS.md` に記録する。
