# jinai.md リポジショニング計画（2026-10-01）

SkyDeck 3分ピッチ（16枚）で変えた方向性に、サイトを合わせるための計画。
このファイルは本番には出ない（`scripts/build-pages.mjs` の allowlist 外）。

---

## 1. いまのズレ

| 項目 | 現行サイト（content.json 2026-09-12） | ピッチ（2026-10） | サイトでの扱い |
| --- | --- | --- | --- |
| 何のプロダクトか | エージェントが書いたファイルを見る・直す・戻す「ビジュアルワークスペース」 | あなたのファイルとチャット履歴から働き方を学び、すべてのAIに文脈を渡す | ピッチに合わせる |
| 見出し | Take control of every file your agents create. | Gives every AI your context, automatically. | ピッチに合わせる |
| 中心の痛み | エージェントが勝手にファイルを作る | 毎回プロンプトし直す／指示ファイル作りが新しい仕事になっている | ピッチに合わせる |
| 説明の型 | See → Fix → Undo | 学ぶ（何が厳密で、何をAIに任せていいか）→ 依頼ごとに必要な分だけ渡す → Markdownで読めて直せる | ピッチに合わせる |
| 状態 | In build / coming soon | アプリは動く。10月に約50人のベータ | **要確認**：ベータの範囲が決まってから書く |
| CLAUDE.md 等の自動更新 | Planned（未出荷） | 「Auto-updated」と見せている | **出荷するまで Planned 表示を残す** |
| 料金 | 個人ローカル無料／共同作業 $15/月＋ストレージ | Free／Pro $10/月（Drive・Notion連携、PC・スマホ同期）／チームは相談 | ピッチに合わせ「ベータで検証中の案」と明記 |
| 証拠 | 創業者PCで1週間に3,950個のMarkdown | Workday調査：AIで浮いた時間の約40%が手直しで消える（n=3,200） | Workday を主に。3,950 は「始まりの話」として1行に縮める |
| Tomoya | Co-founder, business and sales | advises on go-to-market | **要確認**：どちらが正しいか決めて統一 |
| アクセント色 | コバルト `#1659e9` | バーミリオン系（デッキ `#C45C26` 付近、brand/README は `#c1362f`） | **要決定**：1色に絞る（推奨：バーミリオン） |
| スクリーンショット | ファイル一覧＋文書（Launch narrative） | 「Your memory」画面（187 things / Working. Claude Code got 4 memories…） | 新しい画面で撮り直す |

ズレの根っこは `agent/content.json` と `README.md` の「Content rules」。
ここが古いままだと、手で直しても Copilot が古いルールに従って戻してしまうし、FAQ・llms.txt・/agent/ も古いまま生成される。**最初に直すのはこの2つ。**

## 2. 変えないもの

いまのサイトの見た目は、もうAIっぽくない。紙の地色、Source Serif の見出し、等幅の小見出し、出典と注意書きを必ず添える書き方。デッキもセリフ見出し＋温かい地色なので、相性はいい。
**作り直すのはメッセージと構成。デザインシステムは色以外ほぼ据え置き。**

- 紙の地色 `--paper`、セリフ見出し、`--mono` の小ラベル
- status-aware な書き方（In build / Planned / Later を混ぜない）
- 出典を本文のすぐ下に書くスタイル
- `GENERATED:*` 生成の仕組み、waitlist フォーム、CI

## 3. AIっぽく見せないためのルール

デッキはスライドなので3枚カード・番号付きの丸・2×2マトリクスを使った。**サイトにそのまま移すと一気にテンプレっぽくなる。** サイトでは次を守る。

やらない
- アイコン＋見出し＋2行の、同じ大きさのカードを3つ並べる
- オレンジの丸に 1・2・3
- グラデーション、ぼかした光、浮いた3D、絵文字
- 「Supercharge / Unlock / Seamless / Effortless / Revolutionize / Game-changer」
- 「No more X.」を何度も繰り返す見出し
- 競合の2×2ポジショニング図（スライド向け。サイトでは表と文章にする）
- 中身のない数字（「10x faster」など、測っていない数字）

やる
- **本物を見せる**：実際のアプリ画面、実際の `CLAUDE.md` の差分、実際のメモリ1件（「Acme の CFO 向けには ROI を最初の段落に。renewal-notes.docx 9/24 の通話メモから」）
- **具体的な場面から入る**：「英語の大学教授のように直して」→ 20分後に崩れる → 同じ指示をまた打つ。このやりとりをそのまま見せる
- **段落で語る**：3つの痛みはカードではなく、短い文章とリストで
- **大きさに差をつける**：全部を同じ重さにしない。主役（メモリ画面）を大きく、それ以外は小さく
- **人が書いた跡**：創業者の一人称の短い一文（なぜ作ったか）。3,950個のファイルの話はここで使う
- **やらないことを書く**：画面を録画しない。ファイルを動かさない。中身はプレーンな Markdown で読めて直せる

## 4. 新しいページ構成（`index.html`）

| # | セクション | 中身 | 現行からの扱い |
| --- | --- | --- | --- |
| 1 | Hero | H1: **Every AI you use, already briefed.**（候補。ピッチと同じ "Gives every AI your context, automatically." でも可）／ lede: ファイルとチャット履歴から働き方を学び、Claude Code・ChatGPT・Codex・Copilot に渡す／ CTA: 10月ベータに参加／ 画像: Your memory 画面 | 書き換え |
| 2 | The re-prompt | 大学教授の例を、実際のチャットの見た目で（1回目は良い、20分後に崩れる、また打つ）。下に Workday の数字と出典 | 新規（現 #problem を置換） |
| 3 | A job of its own | 3つの痛みを文章で：優先順位を分かってくれない／指示ファイル作りが毎週の新しい仕事になる／AIごとに一から書き直し。散らかった `CLAUDE.md` と `AGENTS.md` の実物を小さく | 新規 |
| 4 | How it works | メモリ画面を大きく1枚。横に3行だけ：学ぶ（厳密なもの／AIに任せるもの）→ 依頼ごとに必要な分を渡す →「Claude Code got 4 memories at 9:15, 3 used in its reply.」の受領表示。Markdownで読めて直せる | 現 #solution と #product を統合して置換 |
| 5 | Where it works | Claude Code / ChatGPT / Codex / Copilot。**各ツールに状態ラベル（Beta / Planned）** | 新規（現 #outcome を置換） |
| 6 | What it never does | 画面を録画しない／ファイルを動かさない／ローカルが基本 | 新規（短く） |
| 7 | Compared with | 表：手書きの CLAUDE.md、ChatGPT/Claude のメモリ、MemoryPlugin、Littlebird、Pieces。「どれだけ繋がるか」「構造化されているか」の2列＋一言。「他は誰もやっていない」とは書かない | 現 .cmp を流用 |
| 8 | Pricing | Free（PC、ローカルのファイルとチャット履歴）／ Pro $10/月（Drive・Notion、PC・スマホ同期）／ Teams（相談）。**"Proposed for the beta"** と明記 | 書き換え |
| 9 | Team | Yu / Tomoya。肩書きは確認後に統一 | 肩書き修正 |
| 10 | Roadmap | 10月ベータ（約50人、インタビューしながら作る）→ 各AI向けプラグイン → Pro 公開 | 書き換え |
| 11 | FAQ | 生成（content.json の direct_answers から） | 中身を差し替え |
| 12 | Final CTA | "Stop re-prompting. Join the beta." 程度に短く | 書き換え |

削除：See → Fix → Undo、「Your agents decide. You are not asked.」、ファイル配置・Undo 系の機能説明、audience-switch の残骸（README では言語・方向切替なしと書いてある）。

## 5. 作業の順番

1. **決めること（人）**：ベータの範囲、Tomoya の肩書き、アクセント色、H1 の案。ここは Copilot に任せない
2. `README.md` の Content rules を新しい方向に書き換え
3. `agent/content.json` を新しい方向に（product / problem / evidence / solution / capabilities / business_model / roadmap / direct_answers / founders）。`last_updated` を更新
4. `node scripts/generate-aeo.mjs` → FAQ・JSON-LD・/agent/・llms.txt が追従
5. `index.html` の手書き部分をセクション単位で書き換え（Hero → 2 → 3 → 4 …）
6. 色トークンの差し替え（`--cobalt*` → アクセント1色）
7. スクリーンショット撮り直し（`scripts/make-shots.ps1`）
8. 検証：`--check`、`waitlist.test.mjs`、`build-pages.mjs`、`validate-site.mjs`、ローカルで目視（PC幅とスマホ幅）
9. PR を作って確認してから main へ（**main に push すると即本番に出る**）
