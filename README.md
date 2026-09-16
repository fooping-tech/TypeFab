# TypeFab

**文字を、かたちに。** GitHub Pagesで動く、日本語対応のレーザー加工向けタイポグラフィSVGエディタ。

公開サイト: **https://fooping-tech.github.io/TypeFab/**（紹介ページ）／ エディタ: **https://fooping-tech.github.io/TypeFab/app/**

## はじめて使う

1. サイトを開き、サンプルの文字をクリックします。
2. 右側で文字内容、日本語フォント、サイズ、字間、位置、回転を変更します。文字内容は入力と同時にキャンバスへ反映されます（日本語入力の変換中も表示します）。数値はフォーカスを外すと確定します。
3. ツールバーの「文字」「長方形」「楕円」「線分」を選び、加工エリアをクリックして追加します。オブジェクトはドラッグで自由配置できます。
4. 「ブリッジ」を選び、切り残したい輪郭上をクリックします。オレンジ色の長方形が**実際にカット線から除去される領域**です。幅・高さ・回転を右側で調整できます。
5. アイテムを選んで「選択にブリッジ」を押すと、ブリッジの幅・高さ（mm）を確認するダイアログが開き、「ブリッジを追加」で選択したアイテムの内側の島と外側の輪郭を非カット帯でつなぎます（既定 1.5 × 1.5 mm、前回の値を記憶）。穴のない文字には追加しません。ブリッジは対象アイテムだけに作用し、その移動・回転・拡縮に追従します。
6. 「加工プレビュー」で赤いカット線と線の途切れを確認し、「SVGを書き出す」で「typefab.svg」をダウンロードします（プロジェクトの「保存」は「typefab-project.json」）。保存場所はブラウザのダウンロード設定に従います。Macで拡張子が見えない場合は、Finderの「設定 → 詳細 → すべてのファイル名拡張子を表示」を確認してください。
7. 加工ソフトでmm寸法とカット設定を確認し、材料に合わせてテスト加工してください。

### 回転

選択枠の上に出る丸いハンドルをドラッグすると回転します。1つなら自分の中心、複数・グループなら全体の中心で回り、ドラッグ中は画面下に角度を表示します。Shiftを押すと15°刻みです。右クリックの「右に90°回転」「左に90°回転」、右側の「回転 °」欄でも回せます。角度は -180°〜180° で表します。対象付きブリッジは親と一緒に回ります。

### 拡縮と比率ロック

矩形・楕円・固定アウトライン・ブリッジは、選択枠の四隅をドラッグして拡大・縮小できます。反対側の角を固定し、回転した状態でも操作できます。

- 「縦横比を固定」をオンにすると比率を保ちます。幅・高さの数値入力にも適用されます。
- ドラッグ中にShiftを押しても一時的に比率を固定できます。
- 文字も四隅のハンドルで拡縮できます。縦方向の倍率で文字サイズと字間が変わり、横方向の残りは「長体・平体 %」になります（100 %が標準）。拡縮後も文字の内容・書体を編集でき、ワープもそのまま掛かります。比率を固定すると長体・平体は変わりません。
- 線分は幅・高さの数値欄で編集します。

### 文字の編集（ダブルクリック）

キャンバス上の文字をダブルクリックすると、文字の下に入力欄が開きます。入力はすぐにキャンバスへ反映され、Esc または ⌘/Ctrl+Enter、欄の外をクリックすると閉じます。右クリックメニューの「テキストを編集」でも開きます。1回の編集は取り消し1回で戻せます。

### ワープ（Text Warp / エンベロープ変形）

文字を曲線に沿って並べるのではなく、**文字のアウトラインそのもの**を変形します。IllustratorのEnvelope Distort（ワープで作成）に近い操作です。文字のほか、**長方形・楕円・固定パス**（アウトライン化した文字、図形演算の結果、部位など）にも使えます。線分は幅と高さのある枠を作れないため対象外です。

1. 文字・図形を1つ選び、ツールバーの「ワープ」、右側の「ワープ（エンベロープ変形）」、または右クリックメニューの「ワープ…」を押します。
2. 文字の周りにエンベロープ（オレンジの枠）が表示されます。四角が角、丸がベジェ曲線のハンドルです。上辺・下辺・左辺・右辺はそれぞれ独立した3次ベジェ曲線です。
3. 角やハンドルをドラッグすると、ドラッグ中から文字の輪郭がリアルタイムに変形します。角をドラッグすると隣のハンドルも一緒に動き、Alt/Optionを押すと角だけが動きます。
4. 右側のプリセット（Arc Up・Arc Down・Arch・Bulge・Wave・Flag・Fish・Perspective）を選び、「曲がり」スライダーで強さ（-100〜100 %）を変えられます。プリセットを選んでから手で調整すると「カスタム」になります。
5. 「完了」または Esc / Enter で終了します。「形をリセット」で平らに戻し、「ワープを解除」で元の文字に戻します。どの操作も取り消し・やり直しできます。

ワープした長方形・楕円は幅・高さ・フィレットを保持し、数値を変えても同じ変形が掛かります。固定パスは変形前の輪郭をワープ設定の中に保存するので、あとから形を調整したり、「ワープを解除」で元の輪郭にそのまま戻したりできます。ワープした文字を「アウトライン化」すると、変形前の文字の輪郭を保存した固定パスになり、ワープの再編集を続けられます。ワープした図形も四隅のハンドルで拡縮でき、変形は保たれます。

ワープした文字は元の文字・書体・サイズとワープ設定を保持します。あとから文字を書き換えたり、書体・サイズ・長体を変えたり、四隅で拡縮したりしても同じ変形が掛かり、もう一度「ワープ」を押せば続きから編集できます。

変形は見た目だけのCSS変換ではなく、実際の輪郭座標に対して行います。エンベロープは4本のベジェ曲線から作るCoonsパッチで、文字の線分は変形後に0.02 mm以内に収まるよう細分化します（元の曲線近似も0.02 mmです）。保存される輪郭とSVG出力は変形後の通常のパスで、書体やCSSには依存しません。結合・切り抜きなどの図形演算、自動ブリッジ、部位への分解もそのまま使えます。ワープ後に形が変わるため、自動ブリッジは変形を決めてから適用してください。ワープした文字を「1文字ずつ」に分解すると、変形後の形の固定パスになります。

### パスのノード編集（Path Edit Mode）

アウトライン化した文字や固定パスの**輪郭上の点（アンカー）とベジェハンドルを直接つかんで**形を変えます。Fusion 360やIllustratorのダイレクト選択に近い操作です。「A」の脚だけ伸ばす、「R」の脚を曲げる、「O」の一部を細くする、といった局所的な加工に使います。

想定の流れ: 文字 → アウトライン化 → パス編集 → ブリッジ → 図形演算 → SVG書き出し

1. 文字を選び「アウトライン化」します（右クリックの「アウトライン化してパス編集」、ツールバーの「パス編集」でも可）。文字の輪郭はフォントのベジェ曲線のままパスになり、形は変わりません。
2. パスをダブルクリックすると **Path Edit Mode** に入ります。通常の選択ではバウンディングボックスだけを表示し、編集モードでアンカー（四角）とハンドル（線と丸）を表示します。
3. 操作
   - アンカーをクリックで選択（塗りつぶされた四角が選択中）、Shift+クリックで追加・解除、空白からドラッグで範囲選択、⌘/Ctrl+A ですべて選択
   - アンカーをドラッグで移動（選択中のアンカーをまとめて動かし、ハンドルも一緒に動きます）。矢印キーで0.1 mm、Shift+矢印で1 mm移動
   - ハンドルをドラッグで曲率を調整。**スムーズ**ノードは反対側のハンドルが連動して一直線を保ち、**コーナー**ノードは左右のハンドルが独立して動きます。Alt/Optionを押しながらハンドルをドラッグするとコーナーになります
   - パス上をダブルクリックでノードを追加（曲線は形を変えずに分割）。右側の「追加」は選択ノードの次の区間の中点に追加します
   - Delete / Backspace で選択ノードを削除
   - 右側または右クリックで「スムーズ」「コーナー」「直線化（ハンドル削除）」を切り替え
   - Esc / Enter / 「完了」で終了
4. 右側の「SVG path d」にパスのd属性（オブジェクト座標・mm）が表示され、書き換えて反映することもできます。M L H V C S Q T A Z（相対座標の小文字も可）を読み込み、内部では M / L / C / Z の3次ベジェに正規化します（円弧は90°以下ごとの3次ベジェに変換）。

ドラッグ中は毎フレーム輪郭を作り直して表示し、ドラッグ1回が取り消し1回になります。ノードの追加・削除・種類の切り替え・d属性の書き換えもすべて取り消し・やり直しできます。

長方形・楕円・ワープした形・図形演算の結果など、ベジェ情報のない輪郭もダブルクリックで編集できます。長方形・楕円は正確なベジェに、それ以外は輪郭を0.02 mm程度の精度で3次ベジェ曲線に近似してノードを作ります。**実際に点を動かすまでは元のまま**で、最初の編集で固定パスに変わります（取り消しで戻せます）。

編集したパスは通常の固定パスとして、四隅での拡縮、自動ブリッジ、結合・切り抜きなどの図形演算、ワープ、SVG書き出しにそのまま使えます。SVGには編集用の点やハンドルは含まれず、0.02 mmで線分化したカット線のパスだけを出力します。

### 2D CAD ツール（多角形・ミラー・パターン・オフセット・トリム・延長・フィレット・面取り・計測・寸法）

「多角形」は1段目の「楕円」の隣に、そのほかはツールバーの2段目にあり、Fusion 360 のスケッチに近い編集ツールです。拘束（Constraint）やパラメトリック履歴はなく、**結果はすべて通常のアイテム／編集できるパス**になり、元の図形との関連は保持しません。どの操作も取り消し1回で戻せます。プレビュー中はプロジェクトを変更せず、確定したときだけ履歴に入ります。

| グループ | ツール | 使い方 |
| --- | --- | --- |
| 1段目 | 多角形 | 右側で頂点数（3〜100）・外接円の半径・回転を決め、中心をクリック。正多角形の固定パスになります |
| MODIFY | オフセット | 図形を選び、距離・外側／内側・角の形（Round / Miter / Square）を決めて確定。閉じた輪郭は Clipper でオフセットし（穴は反対向き）、開いた線は平行線になります。内側に寄せすぎて輪郭が消える場合はエラーを表示します。元の図形は残ります |
| MODIFY | トリム | 他の図形と交差している線の、消したい部分をクリック。最寄りの交点から交点までを削除します。線分は短い線分（2本に分かれることも）に、閉じた図形は開いたパスになります。交点がない場合はエラーです |
| MODIFY | 延長 | 線分や開いたパスの端の近くをクリックすると、延長方向で最初に交差する図形まで伸ばします。交差する図形がない場合はエラーです |
| MODIFY | フィレット | 半径を決めて、直線どうしの角（ノード）をクリック。接線点を計算して円弧（3次ベジェ）に置き換えます。長方形・多角形・パスのほか、端点で接する2本の線分（接点付近をクリック）にも使えます。半径が大きすぎる場合は最大値を示してエラーにします。重なっている図形は手前のものが対象です |
| MODIFY | 面取り | 距離を決めて角をクリック。角から両側に同じ距離の点を取り直線で結びます（Equal distance） |
| PATTERN | ミラー | 図形（複数・グループ可）を選び、基準線の2点をクリックするか「選択の中心で縦軸／横軸」を押し、プレビューを見て確定。コピーを作ります。長方形・楕円・線分はそのままの種類で、文字・ワープ済み・パスは正確に反転した固定パスになります。対象付きブリッジも一緒に反転します |
| PATTERN | 矩形パターン | 図形を選び、列・行・X間隔・Y間隔を決めて確定。元を含めて 列×行 セットになります（負の間隔も可）。複数選択・グループは1セットとして複製し、各コピーは独立したアイテム（グループ）になります |
| PATTERN | 円形パターン | 図形を選び、中心をクリック（または数値入力）し、個数と全体の角度を決めて確定。360° なら等間隔、それ未満なら両端を含めて配置し、各コピーの回転も更新します |
| INSPECT | 計測 | 2点をクリックすると距離・ΔX・ΔY・角度を表示します。線分をクリックすると長さと角度、円をクリックすると半径と直径、選択中の図形があればその幅・高さも表示します。頂点の近くをクリックすると頂点に吸着します。Esc で消えます |
| INSPECT | 寸法 | 種類（直線・水平・垂直・角度・半径・直径）を選び、点をクリックして寸法線を置きます。**参照寸法**で、値を変えても形状は変わりません。寸法は図形とは別に（`annotations`）保存され、加工用SVGには出力しません。削除するには、キャンバスの寸法または左の一覧をクリックして選び、右側の「この寸法を削除」か Delete キー、一覧の × を使います。「寸法をすべて消す」でまとめて消せます（取り消し可） |

### 長方形のフィレット

長方形を選び、右側の「フィレット R」に角の半径（mm）を入力します。右クリックメニューの「フィレット…」でもこの欄に移動します。4つの角を同じ半径で丸め、円弧は許容誤差0.02 mm以内で線分近似します。半径の上限は短辺の半分で、拡縮して短辺の半分より小さくなった場合は半径も縮めます。角ごとに違う半径は未対応です。

### 図形の結合・切り抜き

キャンバスで**Shiftを押しながら複数選択**するか、左の一覧で選択します（下の「選択」を参照）。右側のプロパティまたは右クリックメニューから操作します。

| 操作 | 結果 |
| --- | --- |
| 結合 | 選択図形を1つの領域にする |
| 切り抜き | 最初に選択した図形を土台に、残りの図形を差し引く |
| 交差 | すべての選択図形に共通する部分を残す |
| 排他的 XOR | 重なる部分を除く（3個以上は順次XOR） |

矩形・楕円・文字・固定アウトラインの閉じた輪郭に対応し、穴を保持します。線分・ブリッジは演算対象外です。結果は最初の選択のレイヤーに固定パスとして作られ、元のアイテムは置き換わります。空の結果になる場合は元を残します。取り消しで元の図形・文字に戻せます。

### 選択

- **キャンバス**: クリックで選択、Shift（または⌘/Ctrl）+クリックで追加・解除します。空白からドラッグすると範囲選択です。
- **左のブラウザ**: クリックで1行を選択、⌘/Ctrl+クリックで1行ずつ追加・解除します。**Shift+クリックで、前にクリックした行から今の行までの間をすべて選択**します（レイヤーをまたいでも可。ロック・非表示の行は除きます）。⌘/Ctrl+Shift+クリックでその範囲を今の選択に追加します。
- 最初にクリックした行が「切り抜き」の土台になります。

### 右クリックメニュー

キャンバスのオブジェクトやブラウザの行を右クリックすると編集メニューが開きます（Macの Control+クリック、キーボードの Shift+F10 / メニューキーでも開きます）。選択していないものを右クリックすると、それを選択してから開きます。

| メニュー | ショートカット | 内容 |
| --- | --- | --- |
| 切り取り・コピー・貼り付け | ⌘/Ctrl X・C・V | このページ内のクリップボードを使います。貼り付けは追加先レイヤー（◆）へ、5 mmずらして置きます。切り取り直後の貼り付けは元の位置です |
| 複製・削除 | ⌘/Ctrl D・Delete | 対象付きブリッジも一緒に扱います |
| グループ化・グループ化解除 | ⌘/Ctrl G・Shift+⌘/Ctrl G | 下の「グループ」を参照 |
| アウトライン化・フィレット…・自動ブリッジ | | 選択に応じて使えるものだけ有効になります |
| 結合・切り抜き・交差・XOR | | 2つ以上選択したときに表示します |
| 最前面へ・前面へ・背面へ・最背面へ | ⌘/Ctrl ]・[（Shiftで最前面・最背面） | 同じレイヤーの中で重なり順を変えます |
| ブラウザで表示・すべて選択 | ⌘/Ctrl A | 選択中の行へスクロールします |

空白部分を右クリックすると、元に戻す・やり直す・貼り付け・すべて選択・加工プレビューを表示します。矢印キーで項目を移動、Enterで実行、Escで閉じます。ブラウザによっては重なり順のショートカットがタブ切り替えなどに使われているため、メニューから操作してください。

### グループ

2つ以上選んで「グループ化」（⌘/Ctrl G）すると、1つのグループになります。

- キャンバスではグループのどれかをクリックすると全体を選択し、まとめて移動・複製・削除できます。範囲選択でも一部に触れれば全体を選択します。
- ブラウザでは「グループ」行の下にメンバーを表示します。グループ行のクリックで全体、メンバー行のクリックでそのアイテムだけを選べます（1つだけ動かす・編集するとき）。
- グループのメンバーは1つのレイヤーにまとめ、重なり順も連続させます。グループをレイヤー移動するとメンバー全員が移動します。
- グループを含むものをまとめてグループ化すると、1つの新しいグループになります（入れ子にはしません）。メンバーが1つになったグループは自動で解除します。
- 「グループ化解除」は、まずグループを解除します。グループでないアイテムでは、下の分解を行います。

### グループ化解除（1文字ずつ・部位ごと）

グループでない文字を選び、ツールバーの「グループ化解除」（Ctrl/⌘ Shift G）、右側の「1文字ずつに分解」、または右クリックメニューから実行します。

1. **1文字ずつ**: 文字列が1文字ずつの文字アイテムに分かれます。元の位置・回転・書体・サイズを保ったまま、それぞれを移動・回転・削除したり、文字や書体を変えたりできます。縦書きも同じ位置で分かれます。
2. **部位ごと**: 1文字（または固定アウトライン）を選んでもう一度押すと、つながった部位ごとの固定パスに分かれます。「い」は2本の画に、「は」は左の縦画と右側に分かれます。「日」のように穴のある部位は穴を保ちます。「回」は外枠と内側の島が別の部位になります。部位は四隅のハンドルで拡縮でき、結合・切り抜きにも使えます。

分解後はすべてのピースが選択された状態になり、そのまま移動や次の分解ができます。対象付きブリッジは、交差するピースに引き継ぎます（複数のピースにまたがる帯はそれぞれにコピーし、カット形状を変えません）。取り消しで分解前に戻せます。

### 文字入力

文字内容の欄に入力すると、確定を待たずにキャンバス・アイテム一覧・加工チェックへ反映します。1回の入力中の変更は、取り消し1回でまとめて戻せます。フォントにない文字を入力した場合はメッセージを出し、最後に描けた形を残します。

### レイヤー

左の「＋ レイヤー」で追加します。◆が新規アイテムの追加先です。

- 名前欄で改名、◉で表示／非表示、ロックボタンで編集禁止を切り替えます。
- ↑／↓でレイヤーを前面／背面に並べ替えます。
- 左のオブジェクト行を別のレイヤーへドラッグして移動できます。複数選択した状態ならまとめて移動します。非表示・ロック中のレイヤーへは移動できません。右の「所属レイヤー」でも移動できます。対象付きブリッジは親と一緒に移動します。
- 非表示レイヤーは加工プレビュー・SVG出力から除外します。ロックは編集だけを止め、表示・出力は維持します。
- レイヤー削除時は中身を残りのレイヤーへ移します。ロックされたレイヤーは解除してから削除します。
- SVGにも表示中のレイヤー名とグループを保存します（Inkscapeのレイヤーメタデータ付き）。編集用JSONには全レイヤーを保存します。

### アイテムごとの自動ブリッジ

文字を選び「選択にブリッジ」を押します。まずブリッジの**幅**と**高さ**を mm で設定するダイアログが開きます（右クリックメニューやコマンドの「自動ブリッジ」、プロパティ欄の「選択アイテムに自動ブリッジ」も同じ）。幅はカット線が途切れる長さ（切り残しの太さ）、高さはカット線と直交する方向の帯の広がりです。既定は 1.5 × 1.5 mm、範囲は 0.2〜50 mm で、前回の値をこのブラウザに記憶します。「ブリッジを追加」で「よ」「日」「田」「AB」などの穴を輪郭から検出し、穴の上下を通る矩形（帯の太さ＝幅、輪郭の外へのはみ出し＝高さ、長さは穴と外側の距離から自動）を文字から差し引きます。帯の側面も含む閉じたカット輪郭になるため、文字を切り抜きながら内側の島を板につなぎます。追加フォントにも同じ輪郭処理を適用します。穴のない矩形・楕円・線分の保持ブリッジは、最も長い辺に沿った幅 × 高さの帯になります。

生成した帯は対象だけに作用し、移動・回転・拡縮に追従します。穴のない文字・固定アウトラインには追加しません。以前の自動ブリッジは再適用で新方式に置き換わります。手動ブリッジと穴のない矩形・楕円の保持用ブリッジは、従来の線を途切れさせる方式です。

### スマート接続（文字を一体化して切り出す）

文字そのものをレーザーで切り出すと、文字ごと・部位ごと（「い」の2画、「i」の点など）に別々のパーツになります。「スマート接続」は文字の材料側に接続形状を足してUnionし、選択全体を**1つの閉じた輪郭**にします。板から文字を抜くときに使う「切り抜きブリッジ」（カット線を途切れさせる）とは別の機能です。

1. 文字または固定パスを選び（複数可・同じレイヤー）、ツールバーの「スマート接続」、右側の「スマート接続（文字を一体化）」、または右クリックメニューから開始します。
2. 右側で設定します。初期値は幅 1.5 mm・最大距離 10 mm・スタイル Auto です。
   - **幅**: 接続部の設計幅（Tapered は中央の幅）。**最大距離**: 輪郭どうしの距離がこれを超える相手にはつなぎません。
   - **スタイル**: Auto は Smooth → Tapered → Rounded → Straight の順に成立するものを使います。指定したスタイルが成立しない場合は Straight で代替し、一覧に「代替」と表示します。
   - **文字内の部位をつなぐ／隣の文字とつなぐ／全体を1つにする**: 「全体を1つにする」は両方を必要とし、片方を外すと自動的に外れます。隣の文字は同じ行（縦書きは同じ列）の前後の文字です。行・列をまたぐ接続は「全体を1つにする」のときだけ候補にします。固定パスには文字の情報がないため「全体を1つにする」だけが有効です。
   - **日本語の筆画延長を優先**: 日本語の文字では、払い・はね・横画・縦画などの細い端部から接線方向へ延ばす候補に加点します（最短距離だけでは決めません）。
3. キャンバスに接続案（オレンジ）が出ます。「結果の輪郭」で Union 後の形を確認できます。部品数の前後、接続本数、未接続の部品と原因（最大距離を超える、候補が輪郭と交差する、など）を表示します。全体を1つにできない場合や無効な接続がある場合は確定できません。
4. 手直し: 一覧またはキャンバスで接続を選ぶと、幅・スタイル・曲率の変更、「次の候補」への切り替え、削除（Delete）、両端の○ドラッグで接続点の変更、中央の◇ドラッグで位置の変更ができます。「＋ 接続を手で追加」で2つの部品の輪郭付近を順にクリックすると接続を追加できます。手直し後に設定を変えると再生成が必要になり、再生成すると手直しは失われます（確認表示あり）。
5. 「確定」（Enter）で、文字設定やワープを焼き込んだ1つの固定パスに置き換わります。取り消し1回で元の文字に戻り、やり直しで同じ形を再現します。確定後はパス編集・ワープ・移動・拡縮・SVG出力が通常どおり使えます。Esc でキャンセルします。プレビュー中は保存データを変更しません。

対象付きブリッジが付いたアイテム、選択に重なる全体ブリッジ、線分・開いたパス、複数レイヤーにまたがる選択は実行できません（理由を表示します）。穴を潰す接続、他の輪郭や接続と交差する接続は候補から除外し、確定時にも再検査します。接続幅より狭い接触で重なっている文字は警告します。輪郭がつながることの検査であり、材料の強度や実機での結果を保証するものではありません。

### ズーム

- 2本指スワイプ／ホイールで上下左右にスクロールします。
- ピンチまたはCtrl/⌘＋ホイールで25〜2000%にズームします。タッチ画面は2本指で移動・ピンチできます。

### SVGを開く（読み込み）

「開く」でSVGファイルを選ぶか、SVGファイルをキャンバスにドロップすると、その図形を**今のデザインに編集できるパスとして追加**します（プロジェクトの.jsonを開いた場合はデザイン全体を置き換えます）。取り消しで読み込み前に戻せます。

- 対応する要素: path（M L H V C S Q T A Z）、rect（角丸 rx/ry）、circle、ellipse、line、polyline、polygon。g・a・入れ子のsvgと transform（matrix / translate / scale / rotate / skewX / skewY）を反映します。
- 大きさ: viewBox と width/height の単位（mm・cm・in・pt・pc・px）からmmに換算します。単位のない値は96 dpiのピクセルとして扱います。TypeFabで書き出したSVGは同じ位置・同じ大きさで戻ります。
- Inkscapeのレイヤー（TypeFabの書き出しも同じ形式）は同名のレイヤーに入れ、なければ作ります。それ以外は追加先レイヤー（◆）に入れます。同じレイヤーに入った図形は1つのグループになります。
- 非表示の要素（display:none・visibility:hidden）、defs などの定義は読み込みません。文字（text）・画像（image）・参照（use）は読み込めないため、件数をメッセージで知らせます。文字は元のソフトでアウトライン化してから保存してください。
- 読み込んだ図形はダブルクリックでノードを編集でき、ブリッジ・図形演算・ワープ・SVG書き出しにそのまま使えます。塗りのルール（evenodd）は反映しません。

### 編集と保存

- 「アウトライン化」で選択中の文字を固定パスに変換します。SVG出力は、この操作をしなくても常にアウトラインです。
- 「保存」は編集用JSON、「開く」はその復元です。ブラウザにも自動保存します。旧v1プロジェクトは輪郭を変更せずレイヤー1に取り込み、新規保存はv2形式です。
- JSONには文字の輪郭が保存されるので、追加フォントを再読み込みしなくても表示・移動・SVG出力ができます。文字内容・書体などを再編集するには元のフォントを追加し、選び直してください。
- 「新規」は空のプロジェクトを作成します。取り消し可能です。
- Ctrl/⌘ Z: 元に戻す、Ctrl/⌘ Shift Z: やり直す、Delete: 削除、矢印: 0.5 mm移動、Shift+矢印: 5 mm移動。そのほかは「右クリックメニュー」の表を参照してください。
- 1 mmスナップ、ズーム、オブジェクト複製、加工エリア寸法変更に対応。
- スマートフォンは簡易レイアウトです。精密編集にはPCを推奨します。

## フォント

標準搭載は8書体で、すべて **SIL Open Font License 1.1** です。Google Fonts の公式リポジトリの静的TTFをそのまま同梱し、各フォントのOFL本文を `public/fonts/` に置いています。一覧と著作権表示は `THIRD_PARTY_FONTS.md` と、エディタ下部の「フォントライセンス」画面にあります。

| 分類 | フォント |
| --- | --- |
| ゴシック | Zen Kaku Gothic New（既定） |
| 明朝 | しっぽり明朝、Kaisei Decol |
| 丸ゴシック | Zen Maru Gothic |
| ディスプレイ | Dela Gothic One、RocknRoll One |
| 手書き | Zen Kurenaido |
| ドット / ピクセル | DotGothic16 |

- フォントは**選んだときに読み込みます**。起動時に取得するのは既定フォント（と、復元したプロジェクトが使っているフォント）だけで、同じフォントを2回ダウンロードすることはありません。読み込み中はプロパティに「読み込み中…」を表示し、失敗した場合は別のフォントに置き換えず、エラーを表示して元のフォントのままにします。
- 右側の「フォント」はカテゴリ別の一覧です。「TypeFab標準」の印と分類、現在のフォント名をそのフォントの字形で表示します。「フォント一覧・プレビュー」で全書体を実際の字形で見比べて選べます（プレビューはビルド時に生成した輪郭なので、フォント本体の読み込みは不要です）。
- TTF / OTF / WOFFを端末から追加できます。追加フォントはセッション内のみで、フォント・入力テキスト・プロジェクトを外部サーバーに送信しません。WOFF2 / TTCは未対応です。
- **ユーザー追加フォントの利用規約**: 初めてフォントを追加するとき、「このフォントを使用するために必要な権利・許諾を有していることを確認しました」のチェックを求めます。チェック後のみファイルを選べます。同意はこのブラウザに規約バージョン付きで保存し、規約を更新した場合は再確認します。規約全文は「詳細を見る」または「フォントライセンス」画面で読めます。
- フォントにない文字はエラーを表示し、無断で別の文字に置き換えません。
- 「縦書き（右から左）」はHarfBuzzのOpenType縦書き処理を使い、括弧・句読点・長音などの縦用字形（vert/vrt2）と縦方向の送りに対応します。標準搭載の8書体はいずれも縦用字形を持っています。改行すると左に次の列を作ります。追加フォントも、そのフォントが持つ縦書き用字形・メトリクスを使用します。ルビ・縦中横・禁則処理・欧文の横倒しは未対応です。
- 標準搭載フォントを追加・更新するときは、公式配布元のOFL本文を確認してフォント本体と一緒に `public/fonts/` に置き、`src/fonts.js` の `FONT_CATALOG` と `THIRD_PARTY_FONTS.md` を更新し、`node scripts/font-previews.mjs` でプレビューを再生成します。

## 加工データとMVPの範囲

SVGはmm単位、`viewBox`付き、赤色・塗りなしのパスです。文字参照、画像、マスク、クリップ領域は残しません。自動の切り抜きブリッジは矩形差分の側面もカット線に含めます。手動の保持用ブリッジは元の輪郭に隙間を作ります。文字のBezier曲線は許容誤差 **0.02 mm** で線分近似します。画面の加工プレビューとエクスポートは同じ形状処理を使います。

「切り残しなし」は、閉輪郭にブリッジによる隙間があるかの検査です。**材料の連結性、重なった形状全体の保持、物理的な強度を保証するものではありません。** 「内外が未接続の島」は、矩形差分後に残る入れ子の輪郭を検査します。自動配置後も位置・幅を確認してください。自動ブリッジは図形を結合するUnionとは別の処理で、板との構造接続を自動設計する機能ではありません。

カーフ補正、全体の自動重複線除去、拘束（Constraint Solver）、DXF、レーザー直接制御には対応していません。ブーリアン演算していない図形同士の重なりは、そのまま出力します。エリア外のカット線や、ブリッジで完全に隠れた輪郭がある場合は出力を止めます。

## 開発

Node.js 22以降で実行します。

```sh
npm ci
npm run dev        # Vite 開発サーバー + 注文API Worker（ローカル D1・R2）を同時起動
npm test
npm run build
```

ローカル: http://127.0.0.1:5173/TypeFab/ （紹介ページ）、http://127.0.0.1:5173/TypeFab/app/ （エディタ）、http://127.0.0.1:5173/TypeFab/order/ （加工注文）、http://127.0.0.1:8787/admin/ （注文管理）

`npm run dev` は `scripts/dev.mjs` が Vite（`npm run dev:web`）と Cloudflare Worker（`npm run dev:worker` = `wrangler dev`）を `[web]` / `[worker]` のプレフィックス付きで並行起動します。Worker の初回セットアップ（`worker/.dev.vars`、`cd worker && npm ci`、`npm run db:local`）がまだなら Worker は起動せず、エディタだけが使えます（注文ページは概算のみ）。手順は下記「[ローカル開発](#ローカル開発development)」を参照してください。エディタだけを動かしたいときは `npm run dev:web` です。

Vite + JavaScript + opentype.js + HarfBuzz WASM + Clipperの完全静的構成です。`src/geometry.js` が輪郭・ブリッジ・SVG出力、`src/project.js` がJSON入力検証、`src/main.js` が編集UIを担当します。`src/operations.js` は拡縮とブーリアン、`src/layers.js` はレイヤー、`src/typography.js` は文字組版、`src/grouping.js` はグループと文字・部位への分解、`src/edit.js` は重なり順とコピー、`src/warp.js` はワープ（エンベロープ変形）、`src/path.js` はパスのノード編集（SVG pathの読み書き、ベジェ曲線の近似、ノード操作）、`src/svgimport.js` はSVGファイルの読み込みです。将来別リポジトリ名へ移す場合は `vite.config.js` の `base` を変更してください。

## 加工注文（EC）

TypeFabで作ったSVG、または手元のSVGをそのままレーザー加工注文できる流れを実装しています（Issue #1）。**注文の受付には、下記のCloudflare WorkersとStripeの設定が必要です。設定していない公開サイトでは、注文ページは概算の表示のみで決済はできません。**

```text
デザイン → 「このデザインを加工注文する」 → SVG確認 → 材料・厚さ・数量・納期 → 料金 → 配送先 → Stripe Checkout → 決済 → PAID → 管理画面 → SVGダウンロード → PROCESSING → READY → 追跡番号 → SHIPPED
```

### 使い方（注文する側）

1. エディタのヘッダーにある「このデザインを加工注文する」を押すと、書き出しと同じ検査（加工エリア外のカット線、ブリッジで消えた輪郭）を通したSVGを注文ページ（`/order/`）に渡します。保存と再アップロードは不要です。外部のSVGは注文ページにドロップ／選択して読み込めます。
2. 注文ページはSVGを解析し、実寸（mm）、viewBox、パスのみか、総カット長、パス数、開いた線（open path）、重複線の可能性、文字（text）や未対応要素の有無を表示します。**注文できるデザインの最大サイズは 277 × 190 mm**（A4 用紙 210 × 297 mm から周囲 10 mm のマージンを除いた範囲。縦横どちらの向きでも可、`CATALOG.limits`）で、超えるSVGはエラーになり注文できません。最小は 5 mm です。`script`・`foreignObject`・`iframe`・イベント属性・外部URL・外部エンティティを含むSVGは受け付けません。プレビューはこれらを取り除いたSVGを `<img>` で表示します。
3. TypeFab内部では **1 SVGユーザー単位 = 1 mm** とし、書き出すSVGには `width="240mm" height="160mm" viewBox="0 0 240 160"` のように物理サイズを明示します。width/heightが px や単位なしで実寸が決まらないSVGは「実寸の幅 (mm)」の入力を求め、確定するまで注文できません。
4. 材料は**黒クラフトペーパー（約 0.3 mm）のみ**です（`CATALOG.materials`。複数材料・厚さや「要相談」材料の仕組みは残しているので、追加はカタログの編集だけで済みます）。数量、通常／特急を選ぶと概算を表示します。料金は `src/pricing.js` の設定値（仮）で `基本料金 + 材料費 + 加工費 + 数量加算`、特急は加工料金×2（送料は2倍にしない）です。**最終金額はWorker側で必ず再計算**し、ブラウザから送られた金額は使いません。
5. 数量が閾値（初期値10個、`BULK_THRESHOLD`）以上は事前問い合わせとし、「大量注文について問い合わせる」（`CONTACT_URL`）へ案内します。
6. 配送先を入力し、確認画面の「Stripeで支払う」でStripe Checkoutへ移動します。決済後は注文ページに戻り、注文番号とステータスを表示します。決済完了はリダイレクトではなく **Stripe Webhook（`checkout.session.completed`）** で確定し、同じイベントを複数回受け取っても1回だけ処理します。確定後に注文受付メール（下記）を送り、注文状況ページに「領収書を表示（Stripe）」を出します。
7. 注文フォームに入力した氏名・メールアドレス・住所・電話番号はブラウザに保存しません（材料・厚さ・数量・納期の選択だけをタブ内の `sessionStorage` に保持）。エディタから渡したSVG（`localStorage` の `typefab-order`）は注文作成時に削除します。注文状況ページのURLに含まれる確認用トークンは表示後にアドレスバーから取り除きます。個人情報の取り扱いは [プライバシーポリシー](https://fooping-tech.github.io/TypeFab/privacy/)（`privacy/index.html`）に記載し、注文フォームと確認画面からリンクしています。

### 完成イメージ（文庫本しおりのプレビュー）

注文ページの SVG 欄の下に、黒いクラフトペーパーで作った場合の完成イメージを表示します（Issue #7）。実寸（mm）が確定した SVG だけが対象で、px や単位なしの SVG は「実寸の幅 (mm)」を適用するまで表示しません。

- **単体**: 切断線から求めた紙片の形を黒クラフトペーパー風（紙の質感・薄い影・カット縁）に描き、幅と高さを表示します。閉じた輪郭は偶奇規則で塗るので、文字の穴やブリッジで残る部分もそのまま見えます。
- **本に挟む**: 105 × 148 mm の文庫本（固定）にしおりを差し込み、上部 20 mm（固定）が見えている状態を実寸比率で描きます。本より長い場合は下部のはみ出し量も表示します。
- **サイズ比較**: 文庫本としおりを同じ縮尺で並べ、それぞれの寸法を表示します。比較対象は `src/bookmark-preview.js` の `COMPARISON_REFERENCES` に追加できます。

紙片の大きさは、すべての切断線を囲む閉じた外形があればその外形、なければ SVG 全体（用紙）とします。TypeFab から渡した SVG は加工エリア全体が用紙になるため、「SVG実寸」を別に表示します。横長のデザインは 90° 回転して縦向きに表示し、チェックボックスで元の向きに戻せます。幅 50 mm 超、長さ 90 mm 未満、160 mm 超は文庫本のしおりとして不自然な目安として注意を出しますが、注文は止めません（閾値は `BOOKMARK_THRESHOLDS`）。表示は目安で、材料の色・表面・仕上がりは実物と異なります。

### 注文通知メール（Issue #9）

Stripe Webhook で注文が初めて `PAID` になった時点で、Worker が2通のメールを送ります（注文作成時・未決済・期限切れ・決済失敗では送りません）。

| 宛先 | 内容 | 含めないもの |
| --- | --- | --- |
| 購入者（`customer_email`） | 件名「【TypeFab】ご注文を承りました（注文番号）」。注文番号、決済日時、材料・厚さ・サイズ・数量・納期、加工料金・送料・合計、発送予定日、注文状況ページのURL（確認用トークン付き）、領収書の案内、問い合わせ先（`CONTACT_URL`） | 配送先住所、電話番号 |
| 管理者（`ADMIN_NOTIFICATION_EMAIL`） | 件名「新規注文 注文番号 ¥金額」（特急は「【特急】」を先頭に付け、本文にも強調）。購入者名、金額、決済日時、発送期限、注文内容、カット長、管理画面のURL（`ADMIN_URL`） | 住所、電話番号、メールアドレス（Access で保護された管理画面で確認） |

送信サービスは **Resend** を使います。理由: Worker から HTTPS の JSON API だけで送れる、API キーを Cloudflare Secret にできる、独自ドメインで SPF / DKIM / DMARC を設定できる、UTF-8 の日本語件名・本文に対応、少量なら無料枠で運用できる、です。送信結果は D1 の `order_notifications`（注文ID × 種別で1行、`sent_at` / `provider_id` / `error` / `attempts`）に記録し、同じ注文に同じ種別を二重送信しません。Webhook の再送は `stripe_events` で弾き、別イベントで `PAID` 済みの注文も再通知しません。送信に失敗しても注文は `PAID` のまま確定し（Webhook は 200 を返す）、失敗理由を記録して Worker のログに注文番号と理由だけを出します。管理画面の「詳細を表示」に送信状況が出て、「未送信の通知メールを再送」で再送できます（送信済みの種別は再送しません）。`MAIL_API_KEY` / `MAIL_FROM` が未設定の環境では送信をスキップして「mail not configured」と記録します。状態変更（加工開始・発送済みなど）の通知は未実装です。

### 領収書（Issue #10）

- **Stripe の領収書メール**: Stripe ダッシュボードの Settings → Emails（「Customer emails」）で **Successful payments** を有効にします。Worker は Checkout Session に `payment_intent_data[receipt_email]`（注文者のメールアドレス）を渡すので、決済成功時に Stripe から領収書メールが届きます。テストモードでは Stripe は領収書メールを送らないため、本番モードでも一度確認してください。
- **注文状況ページ**: `PAID` 確定時に Worker が PaymentIntent（`expand[]=latest_charge`）から Charge ID と `receipt_url` を取得して D1（`stripe_charge_id`、`receipt_url`）に保存し、購入者API（`GET /api/orders/:id?token=`）は領収書URLだけを返します（Stripe の内部IDは返しません）。取得に失敗した場合は購入者が注文状況ページを開いたときに再取得します。「領収書を表示（Stripe）」は `PAID` 以降（PAID・PROCESSING・READY・SHIPPED・COMPLETED）にだけ表示し、未決済・`CANCELLED` では表示しません。管理画面の詳細にも同じリンクを出します。
- **返金**: 返金は Stripe ダッシュボードで行い、管理画面で `CANCELLED` にします。「返金済み」の独立した状態や返金情報の同期は未実装で、`CANCELLED` になると領収書リンクは非表示になります。
- **適格請求書（インボイス）**: Stripe の領収書は日本の適格請求書ではありません。TypeFab は適格請求書発行事業者として登録していないため、適格請求書として表示・発行しません。注文確認画面にその旨を記載しています。法人向け対応が必要になった場合は、登録番号・税率別の対象額と消費税額・宛名などを含む書式を Stripe Invoicing か TypeFab 側で用意する別要件とします。

### 管理画面（Cloudflare Access 配下）

管理画面は GitHub Pages には置かず、注文 API と同じ Cloudflare Worker が `/admin/` で配信します（`npm run build:admin` → `worker/admin-dist`、`wrangler.toml` の `[assets]`）。これにより管理画面と `/api/admin/*` を同じオリジンで **Cloudflare Access** の対象にでき、ブラウザの Access ログイン Cookie がそのまま管理 API に付きます。

- 注文一覧（未処理＝PAID・PROCESSING・READY、状態別、すべて）には注文日・決済日・通常／特急・発送期限・購入者名・加工内容・金額を表示し、**メールアドレス・住所・電話番号は含めません**（`GET /api/admin/orders` も返しません）。
- 「詳細を表示（配送先・通知・領収書）」で `GET /api/admin/orders/:id` を呼び、配送先（発送が必要な PAID・PROCESSING・READY・SHIPPED のときだけ）、Stripe の ID と領収書リンク、通知メールの送信状況と再送ボタン、状態の履歴を表示します。`COMPLETED` / `CANCELLED` の注文と保持期限で削除済みの注文では、詳細を開いても個人情報を返しません。
- 「SVGを表示」「SVGをダウンロード」（R2から取得）、「加工開始」「加工完了」「発送済みにする」（追跡番号・配送会社を任意入力）、「完了にする」「キャンセル」で状態を変えます。状態遷移は `NEW → PAYMENT_PENDING → PAID → PROCESSING → READY → SHIPPED → COMPLETED`（各段階から `CANCELLED`）で、許可されない遷移はWorkerが拒否します。Access でログインした管理者のメールアドレスは状態履歴に残ります。返金はStripeダッシュボードで行います。
- 「保持期限切れの個人情報・SVGの削除」から、削除対象の確認（dry run）と手動実行ができます（下記「個人情報の保持期間」）。

ローカル開発（`APP_ENV=development`、Access 未設定）では `ADMIN_TOKEN` の入力欄が出ます。`ACCESS_TEAM_DOMAIN` と `ACCESS_AUD` を設定すると Bearer トークンは受け付けなくなり、Access の JWT だけで認証します（併用はしません）。本番（`APP_ENV=production`）では `ADMIN_TOKEN` を無視し、Access が未設定なら管理 API は 503 を返して管理画面にその旨を表示します（Issue #11）。

### 個人情報の保持期間と自動削除（Issue #8）

注文が `COMPLETED` または `CANCELLED` になってから `PERSONAL_DATA_RETENTION_DAYS`（既定 90）日を過ぎると、Worker が `customer_name`・`customer_email`・`shipping_postal_code`・`shipping_prefecture`・`shipping_address1`・`shipping_address2`・`shipping_phone` を NULL にし、R2 の SVG を削除して `personal_data_deleted_at` を記録します。注文番号、金額、日付、Stripe の Checkout Session / PaymentIntent / Charge ID、加工内容、状態、追跡番号は会計と決済照合のため残します。`wrangler.toml` の `[triggers] crons = ["0 18 * * *"]`（毎日 03:00 JST）で自動実行し、管理画面と `POST /api/admin/maintenance/purge`（`{"dryRun":true}` で確認のみ）からも実行できます。メールアドレスの用途は受付メール・領収書・注文に関する連絡なので、配送用の個人情報と同じ期限で削除します。Stripe 側の決済記録（メールアドレスを含む）は Stripe の保持方針に従います。

### データフロー

```text
Browser / GitHub Pages（紹介ページ・エディタ・注文ページ・プライバシーポリシー）
  │  氏名・メールアドレス・住所・電話番号（任意）・SVG   ※HTTPS、CORS は公開サイトの origin だけ許可
  ▼
Cloudflare Workers（注文API /api/*、管理画面 /admin/、管理API /api/admin/*）
  ├── Cloudflare D1 …… 注文情報（個人情報は完了／キャンセルから90日で削除）、通知の送信記録、Webhook のイベントID
  ├── Cloudflare R2 …… SVG（同じ期限で削除）
  ├── Stripe ……………… メールアドレス・注文番号・金額・注文内容の要約。カード情報は Stripe のみ
  ├── Resend …………… 購入者への受付メール、管理者への新規注文通知（住所・電話番号は含めない）
  └── Cloudflare Access … 管理画面と管理API のログイン（許可したメールアドレス、MFA）
```

- GitHub Pages は静的ファイルだけを配信し、秘密鍵や個人情報を持ちません。エディタはフォント・文字・プロジェクトを外部へ送りません。
- 公開 API（`/api/config`・`/api/quote`・`/api/orders`・`/api/orders/:id`）の CORS は `ALLOWED_ORIGINS` に限定し、`*` は使いません。管理 API は `ADMIN_ALLOWED_ORIGINS`（本番は空＝同一オリジンのみ）と別のポリシーで、preflight を含めてテストしています。
- 購入者API は住所・メールアドレス・Stripe の ID を返しません。Worker のログとエラーメッセージに個人情報を出しません。
- 本番とローカルの違い: 本番（`APP_ENV=production`）は Access で管理画面を保護し、Resend と Stripe 本番キーを使います。ローカル（`APP_ENV=development`）は `ADMIN_TOKEN`、Stripe テストモード（またはモック）、`MAIL_MODE=console` でメールをログ出力です。下記「開発環境と本番環境」を参照。

### アーキテクチャ

| 役割 | 実装 |
| --- | --- |
| フロントエンド | GitHub Pages（`order/`・`admin/`・エディタの注文ボタン。`src/order.js`、`src/admin.js`、`src/order.css`） |
| 料金・SVG解析 | `src/pricing.js`（カタログ・料金・リードタイム・状態遷移）、`src/svganalyze.js`（寸法・カット長・検査・サニタイズ）。フロントとWorkerで共用 |
| Backend API | Cloudflare Workers（`worker/src/`）。公開: `GET /api/health`、`GET /api/config`、`POST /api/quote`、`POST /api/orders`、`POST /api/stripe/webhook`、`GET /api/orders/:id?token=`。管理（Access）: `GET /api/admin/session`、`GET /api/admin/orders`（一覧・個人情報なし）、`GET /api/admin/orders/:id`（詳細）、`GET /api/admin/orders/:id/svg`、`POST /api/admin/orders/:id/status`、`POST /api/admin/orders/:id/notify`（再送）、`POST /api/admin/maintenance/purge`。Cron: `scheduled()` が保持期限切れを削除 |
| 管理画面 | 同じ Worker の Static Assets（`worker/admin-dist`、`vite.admin.config.js`）。`/admin/` |
| Database | Cloudflare D1（`worker/schema.sql`: `orders`、`stripe_events`、`order_events`、`order_notifications`）。SVG本体は保存しない。既存DBは `worker/migrations/0002_privacy_mail_receipt.sql` を適用 |
| SVG Storage | Cloudflare R2（キーは `orders/<注文ID>/<ハッシュ>.svg`。ファイル名はメタデータのみ。保持期限で削除） |
| Payment | Stripe Checkout（JPY）＋ Webhook。秘密鍵はWorkerのSecretのみ。領収書は Stripe の `receipt_url` |
| Mail | Resend（`worker/src/mail.js`）。API キーは Secret |
| Admin auth | Cloudflare Access（`worker/src/access.js` が `Cf-Access-Jwt-Assertion` を JWKS で検証） |

GitHub Pages側には秘密鍵や決済処理を置きません。

### 開発環境と本番環境（Issue #11）

Worker の設定は「ローカル開発」と「本番」で完全に分かれています。ローカルでは Cloudflare 上の D1・R2 に接続せず、本番の Secret をローカルの設定ファイルに書く必要もありません。

```text
Development（npm run dev）              Production（cd worker && npm run deploy）
├─ Worker: wrangler dev（127.0.0.1:8787） ├─ Worker: Cloudflare Workers
├─ D1: ローカル（worker/.wrangler/state）  ├─ D1: Cloudflare D1
├─ R2: ローカル（worker/.wrangler/state）  ├─ R2: Cloudflare R2
├─ Stripe: Test Mode（sk_test_…）          ├─ Stripe: Live Mode（sk_live_…、wrangler secret）
├─ Stripe Webhook: Stripe CLI で転送        ├─ Stripe Webhook: 公開エンドポイント
├─ Mail: MAIL_MODE=console（ログに出力）     ├─ Mail: Resend
└─ 管理画面の認証: ADMIN_TOKEN              └─ 管理画面の認証: Cloudflare Access
   設定: worker/.dev.vars（git 管理外）        設定: worker/wrangler.toml [vars] + wrangler secret
```

切り替えは Worker の環境変数 `APP_ENV` です。`wrangler.toml` は `APP_ENV = "production"`、`npm run dev`（`wrangler dev --var APP_ENV:development`）と `.dev.vars.example` は `development` にしています。Worker はこの値で次のように振る舞います。

| | development | production |
| --- | --- | --- |
| 管理API（`/api/admin/*`）の認証 | Cloudflare Access が設定されていればそれ、なければ `ADMIN_TOKEN` | Cloudflare Access のみ。`ADMIN_TOKEN` は無視し、Access 未設定なら 503 |
| `STRIPE_SECRET_KEY` | `sk_live_` / `rk_live_` なら設定エラーとしてすべての API が 500 を返す（`npm run dev` は起動前にも拒否） | 本番キー |
| `MAIL_MODE=console` | メールを送らず、宛先・件名・本文を `wrangler dev` のログに出力し、送信済みとして記録 | 設定エラー（顧客のメールアドレスをログに出さないため） |
| `STRIPE_API_BASE` / `MAIL_API_BASE`（モック） | 使える | 設定エラー |

`GET /api/health` は `env`（`development` / `production`）、`mailMode`、`adminAuth`（`access` / `token` / `none`）を返すので、どちらのモードで動いているか確認できます。R2 と D1 は Worker コードでは同じバインディング（`env.SVG_BUCKET`、`env.DB`）を使い、環境による分岐はありません。`wrangler dev` がローカルのエミュレーションに向けます。

### ローカル開発（development）

初回だけ:

```sh
npm ci                                          # ルート
cd worker && npm ci && cd ..                    # wrangler
cp worker/.dev.vars.example worker/.dev.vars    # Stripe のテストキー（sk_test_…）だけ入れる。git 管理外
npm run db:local                                # ローカル D1 にスキーマを作成（worker/.wrangler/state）
```

通常:

```sh
npm run dev
```

これで Vite（http://127.0.0.1:5173/TypeFab/ ）と Worker（http://127.0.0.1:8787 ）が起動し、注文ページと管理画面はローカルの Worker を呼びます（`.env.development` の `VITE_ORDER_API_URL=http://127.0.0.1:8787` を Vite が読みます。`vite build` は読みません）。`http://127.0.0.1:8787/api/health` が `{"ok":true,"env":"development",…}` を返せば準備完了です。

- **D1 / R2**: `wrangler dev` はローカルのエミュレーションを使い、データは `worker/.wrangler/state/` に残ります。本番の D1・R2 には接続しません。スキーマの再適用は `npm run db:local`、既存 DB へのマイグレーションは `cd worker && npm run db:migrate:local` です。
- **管理画面**: `http://127.0.0.1:8787/admin/` を開き、`.dev.vars` の `ADMIN_TOKEN`（例では `local-development`）を入力します。Vite 側の `http://127.0.0.1:5173/TypeFab/admin/` からも同じ Worker を呼べます（`.dev.vars` の `ADMIN_ALLOWED_ORIGINS`）。
- **メール**: `.dev.vars.example` は `MAIL_MODE=console` です。決済完了時の購入者・管理者宛メールは Resend に送らず、`[worker]` のログに `[mail:console] customer_paid for order TF-…` のように本文ごと出力され、管理画面では送信済みと表示されます。実際に送るときだけ `MAIL_MODE=resend` と `MAIL_API_KEY` を設定します。
- **Stripe**: 必ず Test Mode の秘密鍵（`sk_test_…`）を使います。`sk_live_` を書くと `npm run dev` は Worker を起動せず、`npx wrangler dev` を直接起動した場合も API がすべて 500（設定エラー）になります。Checkout はテストカード（4242 4242 4242 4242）で完了できます。
- **Stripe Webhook**: 決済完了を受け取る（PAID にする）には別ターミナルで Stripe CLI を動かします。

  ```sh
  stripe listen --forward-to 127.0.0.1:8787/api/stripe/webhook
  ```

  表示された `whsec_…` を `.dev.vars` の `STRIPE_WEBHOOK_SECRET` に入れて `npm run dev` を再起動します。Stripe CLI を使わない場合は注文が `PAYMENT_PENDING` のままになります。
- **モック**: `.dev.vars` の `STRIPE_API_BASE` / `MAIL_API_BASE` で Stripe API・Resend API の向き先を差し替えられるため、自動テスト用のモックサーバーでも注文→決済→通知→領収書の流れを確認できます。
- **保持期限の削除**: `curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d '{"dryRun":true}' http://127.0.0.1:8787/api/admin/maintenance/purge` で試せます。
- **ビルド済みサイトで確認**: `npm run build && npm run preview`（http://127.0.0.1:4173/TypeFab/ ）。ビルドはローカル Worker の URL を含まないので、注文ページをローカル Worker につなぐには `VITE_ORDER_API_URL=http://127.0.0.1:8787 npm run build` とし、`.dev.vars` の `SITE_URL` を `http://127.0.0.1:4173/TypeFab/` にします。

`worker/.dev.vars`、`worker/.dev.vars.*`、`.env`、`.env.*`（`.env.example` と `.env.development` を除く）は `.gitignore` 済みで、コミットされません。

### 本番環境（production）: Cloudflare Workers のセットアップ

```sh
npm ci                 # ルート（Workerも src/ のモジュールを使います）
cd worker && npm ci    # wrangler
npx wrangler login
```

1. **D1**: `npx wrangler d1 create typefab-orders` を実行し、表示された `database_id` を `worker/wrangler.toml` に書きます。スキーマを適用します: `npm run db:remote`（ルートからも `npm run db:remote`）。既存 DB は `npm run db:migrate:remote`（`migrations/0002_privacy_mail_receipt.sql`）を適用します。
2. **R2**: `npx wrangler r2 bucket create typefab-order-svgs`（名前を変えた場合は `wrangler.toml` の `bucket_name` も変更）。
3. **Stripe**: ダッシュボードで本番の秘密鍵（`sk_live_…`）を取得します。Webhookエンドポイントに `https://<worker>.workers.dev/api/stripe/webhook` を登録し、イベント `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`、`checkout.session.expired` を選び、署名シークレット（`whsec_…`）を控えます。
4. **Stripe の領収書メール**: ダッシュボードの Settings → Emails で「Successful payments」を有効にします（Issue #10）。
5. **Resend**（Issue #9）: https://resend.com でアカウントを作り、送信ドメインを追加して表示された SPF / DKIM（必要なら DMARC）の DNS レコードを設定し、API キーを発行します。`MAIL_FROM`（例 `TypeFab <orders@example.com>`、検証済みドメインのアドレス）、`ADMIN_NOTIFICATION_EMAIL`（新規注文通知の宛先）、任意で `MAIL_REPLY_TO` と `ADMIN_URL`（管理画面のURL。空なら `<SITE_URL>admin/`）を `wrangler.toml` の `[vars]` に書きます。`MAIL_MODE` は `resend` のままにします。
6. **Secrets**（`worker/` で実行）: `npx wrangler secret put STRIPE_SECRET_KEY`、`npx wrangler secret put STRIPE_WEBHOOK_SECRET`、`npx wrangler secret put MAIL_API_KEY`。`ADMIN_TOKEN` は本番では使われません（設定してあれば `npx wrangler secret delete ADMIN_TOKEN` で消します）。
7. **環境変数**（`worker/wrangler.toml` の `[vars]`）: `APP_ENV = "production"`、`SITE_URL`（決済後に戻る公開サイト）、`ALLOWED_ORIGINS`（公開APIを呼べるオリジン）、`ADMIN_ALLOWED_ORIGINS`（本番は空）、`PERSONAL_DATA_RETENTION_DAYS`、`BULK_THRESHOLD`、`NORMAL_LEAD_TIME_DAYS`、`EXPRESS_LEAD_TIME_DAYS`、`CONTACT_URL`。料金表は `src/pricing.js` の `CATALOG` を編集します。ローカル用の値（`.dev.vars`）は本番に影響しません。
8. **デプロイ**: `cd worker && npm run deploy`（先に `npm run build:admin` が走り、管理画面を `worker/admin-dist` に生成します）。`https://<worker>.workers.dev/api/health` が `{"ok":true,"env":"production","stripeConfigured":true,"mailConfigured":true,"mailMode":"resend","accessConfigured":true,"adminAuth":"access"}` を返せば準備完了です。`accessConfigured` が `false`（`adminAuth` が `none`）の間は管理APIが 503 を返します。Cron Trigger はデプロイ時に登録されます。
9. **Cloudflare Access**（Issue #8、デプロイ後）:
   1. Cloudflare ダッシュボード → Zero Trust でチーム名を決めます（チームドメイン `https://<team>.cloudflareaccess.com`）。
   2. Access → Applications → Add an application → **Self-hosted**。Application domain に Worker のホスト名（`typefab-orders.<subdomain>.workers.dev`、独自ドメインなら `api.example.com`）を入れ、パスに `admin` を指定します。同じアプリケーションに **Add public hostname / path** で `/api/admin` を追加します（`/api/orders` などの公開APIは含めません）。Worker の「Access」タブの「Protect this Worker behind Access」は Worker 全体（公開APIを含む）を保護してしまうため使いません。
   3. ポリシー: Allow、Include に管理者のメールアドレス（`Emails`）だけを列挙します。Require に **Authentication method: mfa**（または OTP 以外の IdP で MFA 必須）を追加して MFA を要求します。
   4. アプリケーションの Overview に表示される **Application Audience (AUD) Tag** を `wrangler.toml` の `ACCESS_AUD` に、チームドメイン（`<team>.cloudflareaccess.com`）を `ACCESS_TEAM_DOMAIN` に書いて再デプロイします。Worker は `Cf-Access-Jwt-Assertion` を `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` の公開鍵で検証し、`aud`・`iss`・有効期限を確認します。
   5. ブラウザで `https://<worker>/admin/` を開き、Access のログイン画面 → 管理画面の順に表示され、ヘッダーに `Access: <メールアドレス>` が出ることを確認します。

### GitHub Pages 側の設定

フロントエンドはビルド時に `VITE_ORDER_API_URL`（WorkerのURL、末尾スラッシュなし）を埋め込みます。GitHubリポジトリの **Settings → Secrets and variables → Actions → Variables** に `ORDER_API_URL` を追加すると、`.github/workflows/pages.yml` がそれをビルドに渡します。未設定なら注文ページは概算のみになります。ローカルの `npm run dev` は `.env.development` でローカル Worker を指します。ローカルで本番ビルドと同じ URL を使いたいときは `.env.example` を `.env` にコピーして値を入れます。

### 本番環境の構築手順（まとめ）

1. 上記のD1・R2・Stripe・Resend・Secretsを設定し、`APP_ENV = "production"`、`SITE_URL`、`ALLOWED_ORIGINS` を公開サイトに合わせてWorkerをデプロイする。既存のD1には `npm run db:migrate:remote` を適用する。
2. Stripeダッシュボードで本番のWebhookを登録し、署名シークレットをSecretに設定する。領収書メール（Successful payments）を有効にする。
3. Cloudflare Access のアプリケーション（`/admin`・`/api/admin`）を作り、`ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` を設定して再デプロイする。これまで本番で `ADMIN_TOKEN` を使っていた場合、`APP_ENV = "production"` では使えなくなるので、Access の設定を先に済ませる。
4. GitHubのリポジトリ変数 `ORDER_API_URL` にWorkerのURLを設定し、`main` へpushしてPagesを再ビルドする。
5. `/order/` でテスト注文（Stripeテストカード）→ 購入者・管理者へのメール到着 → 注文状況ページの領収書リンク → `https://<worker>/admin/`（Access ログイン）で PAID の表示 → 詳細で配送先・通知状況 → SVGダウンロード → 状態変更 → 追跡番号入力 → COMPLETED 後に詳細で個人情報が消えることを確認する。

### MVPで行わないこと

配送会社API連携（追跡番号は手入力）、高精度な加工時間シミュレーション（`estimatedProcessingMinutes` は材料ごとの速度から算出した目安）、自動レーザー加工・機器制御、在庫管理、クーポン、会員、ポイント、AI見積もり、状態変更（加工開始・発送済みなど）のメール通知、返金状態の同期、適格請求書、D1 全カラムの独自暗号化、独自ドメイン。

## ランディングページ

https://fooping-tech.github.io/TypeFab/ はプロダクト紹介ページ（`index.html`、`src/landing.js`、`src/landing.css`）、エディタは https://fooping-tech.github.io/TypeFab/app/ （`app/index.html`）です。画面写真は `public/landing/` にある実際のエディタのスクリーンショット、Before / After の図は `scripts/landing-glyphs.mjs` が同梱フォントと `src/geometry.js` から生成した実際の輪郭と自動ブリッジ（`src/landing-glyphs.js`）です。フォントを更新したら `node scripts/landing-glyphs.mjs` で再生成してください。

紹介ページの内容は 2026-09-15 に最新の仕様（同梱フォント8書体、スマート接続、2D CAD、注文ページのしおり完成イメージ）に合わせて更新し、画面写真（`hero.webp`・`toolbar.webp`・`fonts.webp`・`smart-connect.webp`・`cad.webp`・`bookmark.webp`・`og.png`）は本番ビルド（`npm run build` → `npx vite preview`）を Playwright で操作して撮り直したものです。機能を追加したら、同じ手順で該当する画面写真と本文を更新してください。

以前の `/TypeFab/` はエディタでしたが、Issue #2 の Phase 2 で `/` を紹介ページ、`/app/` をエディタに切り替えました。ブラウザの自動保存はオリジン単位なので、以前のURLで編集していたデザインは `/app/` でそのまま復元されます。編集中のデータがあるブラウザで紹介ページを開くと、`/app/` への案内を表示します。ページの配置は `vite.config.js` の `rollupOptions.input` と `src/landing.js` の `EDITOR_URL` で決まります。加工注文の機能は実装済みですが、加工サービス側（Cloudflare Workers / Stripe）の設定が完了するまで公開サイトでは決済できないため、ページ上では Coming Soon と表示しています。

## GitHub Pages

Settings → Pages → Build and deployment → Sourceを **GitHub Actions** に設定します。`main` へのpushで `.github/workflows/pages.yml` がテスト・ビルドを実行し、Pagesへ公開します。ビルドが失敗した場合はデプロイしません。

## 検証の境界

自動テストではブリッジの線分除去、回転、複数隙間、自動配置、両書体の日本語輪郭、SVG形式、JSON入力検証を確認します。ブラウザの操作確認とGitHub Pagesへの公開確認は `PLANS.md` に記録します。実機レーザー加工・材料強度・加工ソフト全種類での互換性は未検証です。
