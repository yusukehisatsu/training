# Training Notes

個人のトレーニング記録と改善方針を整理する Web サイトのソース。
パーソナルトレーナーにレビューしてもらうことを想定し、GitHub Pages で公開している。

## 目的

身体の課題（肩こり・反り腰・右ハム張り・左母趾痛・浅い呼吸など）に対する改善方針と、日々のトレーニング／ストレッチ／生活習慣メニューを整理する。
解剖学的に「どの筋肉をどう改善するか」を、活性すべき筋／抑制すべき筋という分類で一貫して扱う。

## サイト構成

`docs/` を GitHub Pages として公開している（クライアントサイドで Markdown を描画）。

| セクション | ファイル | 内容 |
| --- | --- | --- |
| 課題 | `docs/content/issues.md` | 中心仮説・部位別の課題・改善優先順位・活性／抑制筋 |
| ジム | `docs/content/menu/gym.md` | 25 分／毎日の週間サイクル・日別メニュー |
| 自宅 | `docs/content/menu/home.md` | 風呂前 5 分ルーチン |
| ストレッチ | `docs/content/menu/stretch.md` | 入浴中ほぐし／入浴後リリース／寝る前ストレッチ |
| 生活 | `docs/content/menu/lifestyle.md` | 食事・呼吸法・姿勢・睡眠 |

## ディレクトリ概要

```
docs/        GitHub Pages 公開対象（HTML/CSS/JS + Markdown データ）
resource/    一次ソース（ChatGPT 整理・ジムマシン一覧・トレーナーフィードバック原文・提案された種目集）
README.md    本ファイル
CLAUDE.md    Claude Code 用のリポジトリガイド
```

## ローカルプレビュー

`docs/assets/js/app.js` が `fetch()` で Markdown を読み込む構成のため、`file://` では動作しない。ローカルサーバー経由で開く：

```sh
cd docs
python3 -m http.server 8080
# → http://localhost:8080/
```
