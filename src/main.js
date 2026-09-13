import opentype from 'opentype.js';
import './style.css';
import {flatten,worldContours,pathData,cutGeometry,exportSVG,shapeContours,bounds,automaticBridges} from './geometry.js';
import {validateProject} from './project.js';

const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fonts=new Map(), fontLabels=new Map([['zen','Zen Kaku Gothic New'],['shippori','しっぽり明朝']]);
let project={version:1,name:'はじめてのタイポグラフィ',width:240,height:160,items:[]};
let selected=null, tool='select',preview=false,snap=true,zoom=1,history=[],future=[],drag=null,saveTimer,statusTimer;
const uid=()=>crypto.randomUUID();
const selectedItem=()=>project.items.find(i=>i.id===selected);
const icons={select:'↖',text:'T',rect:'▭',circle:'◯',line:'╱',bridge:'⊣⊢'};
const labels={select:'選択',text:'文字',rect:'長方形',circle:'楕円',line:'線分',bridge:'ブリッジ'};
function notify(message){$('#message').textContent=message;clearTimeout(statusTimer);statusTimer=setTimeout(()=>$('#message').textContent='ブラウザ内で編集 · mm',7000);}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('typefab-v1',JSON.stringify(project));$('#save-status').textContent='このブラウザに保存済み';}catch{$('#save-status').textContent='自動保存できません · JSON保存を使用';}},200);}
function checkpoint(){history.push(JSON.stringify(project));if(history.length>60)history.shift();future=[];}
function commit(){render();persist();}
function undo(){if(!history.length)return;future.push(JSON.stringify(project));project=JSON.parse(history.pop());selected=null;commit();}
function redo(){if(!future.length)return;history.push(JSON.stringify(project));project=JSON.parse(future.pop());selected=null;commit();}
function textContours(item){
  const font=fonts.get(item.font);if(!font)throw Error('この文字のフォントを「フォント追加」から再読み込みしてください。');
  const missing=[...new Set([...item.text].filter(c=>!/[\s]/u.test(c)&&!font.hasChar(c)))];
  if(missing.length)throw Error(`このフォントにない文字: ${missing.join(' ')}`);
  const all=[];let x=0,y=item.size;
  for(const char of item.text){
    if(char==='\n'){if(item.vertical){x-=item.size*1.3;y=item.size;}else{x=0;y+=item.size*1.4;}continue;}
    const glyph=font.charToGlyph(char);
    all.push(...flatten(glyph.getPath(x,y,item.size).commands));
    if(item.vertical)y+=item.size+item.spacing;
    else x+=(glyph.advanceWidth||font.unitsPerEm)/font.unitsPerEm*item.size+item.spacing;
  }
  return all;
}
function addItem(type,x=35,y=45){
  try{
    let item={id:uid(),type,x,y,rotation:0,name:labels[type]};
    if(type==='text'){item={...item,text:'文字を、かたちに。',font:'zen',size:16,spacing:1,vertical:false};item.name=item.text;item.contours=textContours(item);}
    else if(type==='bridge')Object.assign(item,{w:4,h:1.5});
    else {Object.assign(item,{w:type==='line'?35:30,h:type==='line'?0:30});item.contours=shapeContours(type,item.w,item.h);}
    checkpoint();project.items.push(item);selected=item.id;tool='select';commit();
  }catch(e){notify(e.message);}
}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function withinBoard(){return project.items.filter(i=>i.type!=='bridge').every(i=>worldContours(i).flat().every(p=>p.x>=-1e-6&&p.y>=-1e-6&&p.x<=project.width+1e-6&&p.y<=project.height+1e-6));}
function exportFile(){try{if(!withinBoard())throw Error('加工エリアの外にカット線があります。位置または加工エリアを調整してください。');const result=cutGeometry(project.items);if(result.vanished)throw Error(`${result.vanished} 個の輪郭がブリッジで完全に隠れています。ブリッジを小さくしてください。`);download('typefab.svg',exportSVG(project),'image/svg+xml');notify(`SVGを書き出しました · 切り残しなしの閉輪郭 ${result.untouched} 個`);}catch(e){notify(e.message);}}

$('#app').innerHTML=`
<header><a class="brand" href="./"><span class="brand-mark">t<span>f</span></span>TypeFab<span class="beta">BETA</span></a><div class="document-title"><span id="project-name"></span><small id="save-status">ローカルプロジェクト</small></div><div class="header-actions"><button id="new-project" title="新規プロジェクト">新規</button><button id="open-project">開く</button><button id="save-project">保存</button><button id="export" class="primary">↗ SVGを書き出す</button></div></header>
<div class="workspace-tabs"><span class="workspace-title">DESIGN WORKSPACE</span><span class="tab active">スケッチ</span><span class="subtle">文字から、ものづくりへ。</span><button id="help-button">? 使い方</button></div>
<nav class="toolbar" aria-label="スケッチツール"><div class="tool-group">${Object.entries(labels).map(([id,label])=>`<button data-tool="${id}" class="tool" title="${label}"><span class="tool-icon">${icons[id]}</span>${label}</button>`).join('')}</div><div class="tool-group"><button id="auto-bridge" class="tool"><span class="tool-icon">✧</span>自動ブリッジ</button><button id="outline" class="tool"><span class="tool-icon">T̲</span>アウトライン化</button></div><div class="tool-group history"><button id="undo" title="元に戻す (Ctrl/⌘ Z)">↶</button><button id="redo" title="やり直す (Ctrl/⌘ Shift Z)">↷</button></div><button id="preview" class="preview-button">◎ 加工プレビュー</button></nav>
<main><aside class="layers-panel"><div class="panel-heading">ブラウザ<span class="eyebrow">OBJECTS</span></div><div class="document-row">▾ <span class="folder-icon">◇</span> スケッチ 01</div><div id="layers"></div><div class="layer-actions"><button id="duplicate">＋ 複製</button><button id="delete">⌫ 削除</button></div><div class="left-bottom"><div class="eyebrow">YOUR NEXT IDEA</div><h3>文字を、かたちに。</h3><p>文字と図形をならべて、<br>世界にひとつのデザインを。</p><button id="add-text" class="text-link">＋ 文字を追加</button></div></aside>
<section class="canvas-panel" aria-label="デザインキャンバス"><div class="canvas-top"><span><i class="green-dot"></i> <span id="canvas-mode">スケッチ編集中</span></span><span id="board-label"></span></div><div id="canvas-scroll"><div id="board-wrap"><svg id="canvas" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="加工エリア。ツールを選んで配置、またはオブジェクトをドラッグ"><defs><pattern id="small-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#dce2e8" stroke-width="0.12"/></pattern><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="url(#small-grid)"/><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#c4cdd7" stroke-width="0.2"/></pattern></defs><rect id="paper" width="100%" height="100%" fill="url(#grid)"/><g id="objects"></g><g id="selection"></g></svg><span class="origin-label">0, 0</span></div></div><div class="canvas-bottom"><label class="check"><input type="checkbox" id="snap" checked> 1 mm スナップ</label><div class="zoom-controls"><button id="zoom-out" aria-label="縮小">−</button><button id="zoom-reset">100%</button><button id="zoom-in" aria-label="拡大">＋</button></div><span class="axis"><b>Y</b> ↑ &nbsp; → <em>X</em></span></div><div id="hint" class="canvas-hint"></div></section>
<aside class="inspector"><div class="panel-heading">プロパティ<span class="eyebrow">INSPECTOR</span></div><div id="properties"></div><section class="board-settings"><h4>加工エリア <span>mm</span></h4><div class="fields"><label>幅<input id="board-width" type="number" min="10" max="2000"></label><label>高さ<input id="board-height" type="number" min="10" max="2000"></label></div></section><section class="cut-check"><h4><span class="check-icon">◇</span> 加工チェック</h4><div id="checks"></div><p>ブリッジは切り残しです。材料・厚さに応じて幅を調整し、テスト加工してください。</p></section></aside></main>
<footer><span id="message" role="status" aria-live="polite">フォントを読み込んでいます…</span><span><i class="legend cut"></i> カット線 <i class="legend bridge"></i> 非カット &nbsp; <span class="subtle">TypeFab / 0.1</span></span></footer>
<input hidden type="file" id="font-file" accept=".ttf,.otf,.woff"><input hidden type="file" id="project-file" accept=".json,application/json">
<dialog id="help"><button class="dialog-close" id="close-help" aria-label="閉じる">×</button><div class="eyebrow">WELCOME TO TYPEFAB</div><h2>アイデアを、切り出そう。</h2><ol><li><b>文字・図形を配置</b><p>ツールを選び、加工エリアをクリック。ドラッグや数値入力で位置を調整できます。</p></li><li><b>切り残しをつくる</b><p>ブリッジを輪郭に重ねると、その部分のカット線が途切れます。自動ブリッジは各閉輪郭に保持用の切り残しを追加します。</p></li><li><b>確認して書き出す</b><p>加工プレビューの赤線がSVGに出力されます。SVGはmm単位のパスのみ。カット設定は加工機側で指定してください。</p></li></ol><p class="help-note">閉輪郭のチェックは接続強度の保証ではありません。重なりの結合・カーフ補正・本格的な縦組み組版は未対応です。縦配置は文字を上から順に並べます。</p><button id="start" class="primary">スケッチをはじめる →</button></dialog>`;

function renderLayers(){
  $('#layers').innerHTML=project.items.length?project.items.map(i=>`<button class="layer ${i.id===selected?'selected':''} ${i.type==='bridge'?'bridge-layer':''}" data-layer="${i.id}"><span class="layer-icon">${icons[i.type]||'⌘'}</span><span>${esc(i.name)}</span><small>${i.type==='bridge'?'TAB':i.type==='text'?'TEXT':'PATH'}</small></button>`).join(''):'<p class="empty-layers">まだオブジェクトがありません。<br>文字や図形を追加しましょう。</p>';
}
function field(key,label,value,step=1,min=-2000,max=2000){return `<label>${label}<input data-prop="${key}" type="number" value="${Number(value.toFixed(3))}" step="${step}" min="${min}" max="${max}"></label>`;}
function renderProperties(){
  const i=selectedItem();
  $('#properties').innerHTML=i?`<section><div class="object-type">${i.type==='bridge'?'BRIDGE / 非カット':i.type==='text'?'TYPOGRAPHY':'SKETCH / パス'}</div><h3>${esc(i.name)}</h3><h4>配置 <span>mm</span></h4><div class="fields">${field('x','X',i.x,.5)}${field('y','Y',i.y,.5)}${field('rotation','回転 °',i.rotation,1,-360,360)}</div></section>
  ${i.type==='text'?`<section><h4>テキスト</h4><textarea id="text-content" maxlength="500" aria-label="文字内容">${esc(i.text)}</textarea><label class="full-label">フォント<select id="font-select">${[...fontLabels].map(([k,v])=>`<option value="${esc(k)}" ${i.font===k?'selected':''}>${esc(v)}</option>`).join('')}${!fontLabels.has(i.font)?`<option value="${esc(i.font)}" selected>追加フォント（再読込が必要）</option>`:''}</select></label><div id="font-preview" class="font-preview" style="font-family:${i.font==='zen'?'ZenPreview':i.font==='shippori'?'ShipporiPreview':'sans-serif'}">日本語 Aa 123</div><button id="add-font" class="wide-button">＋ フォント追加 <small>TTF / OTF / WOFF</small></button><div class="fields">${field('size','サイズ mm',i.size,.5,1,300)}${field('spacing','字間 mm',i.spacing,.1,-100,100)}</div><label class="check vertical-check"><input type="checkbox" id="vertical" ${i.vertical?'checked':''}> 縦に配置</label></section>`:''}
  ${['bridge','rect','circle','line'].includes(i.type)?`<section><h4>${i.type==='bridge'?'切り残し領域':'寸法'} <span>mm</span></h4><div class="fields">${field('w','幅',i.w,.1,i.type==='line'?0:.1)}${field('h','高さ',i.h,.1,i.type==='line'?0:.1)}</div>${i.type==='bridge'?'<p class="note">オレンジ色の領域に重なったカット線を除去します。</p>':''}</section>`:''}`:'<section class="no-selection"><span>↖</span><h3>オブジェクトを選択</h3><p>キャンバスや左の一覧から選択して、文字・位置・寸法を編集できます。</p></section>';
  $('#board-width').value=project.width;$('#board-height').value=project.height;
}
function renderCanvas(){
  const svg=$('#canvas');svg.setAttribute('viewBox',`0 0 ${project.width} ${project.height}`);
  const available=Math.max(300,$('#canvas-scroll').clientWidth-100),height=Math.max(240,$('#canvas-scroll').clientHeight-90);
  const scale=Math.min(available/project.width,height/project.height)*zoom;
  $('#board-wrap').style.width=`${project.width*scale}px`;$('#board-wrap').style.height=`${project.height*scale}px`;
  const bridges=project.items.filter(i=>i.type==='bridge'),normal=project.items.filter(i=>i.type!=='bridge');
  $('#objects').innerHTML=preview?`<path d="${pathData(cutGeometry(project.items).paths)}" fill="none" stroke="#d84435" stroke-width="0.25"/>`:normal.map(i=>`<g data-object="${i.id}" class="canvas-object"><path d="${pathData(worldContours(i))}" fill="${i.type==='line'?'none':i.id===selected?'#d9e9f5':'#354859'}" fill-opacity="${i.type==='line'?0:.9}" fill-rule="nonzero" stroke="${i.id===selected?'#276c9c':'#243b50'}" stroke-width="0.22"/><path d="${pathData(worldContours(i))}" fill="none" stroke="transparent" stroke-width="2"/></g>`).join('')+bridges.map(i=>`<rect data-object="${i.id}" class="canvas-object bridge-object" x="${-i.w/2}" y="${-i.h/2}" width="${i.w}" height="${i.h}" transform="translate(${i.x} ${i.y}) rotate(${i.rotation})" fill="#faad53" fill-opacity="0.65" stroke="#df7b21" stroke-width="0.25"/>`).join('');
  const i=selectedItem();let overlay='';
  if(i&&!preview){const b=i.type==='bridge'?{x:-i.w/2,y:-i.h/2,w:i.w,h:i.h}:bounds(i.contours);
    overlay=`<g transform="translate(${i.x} ${i.y}) rotate(${i.rotation})" pointer-events="none"><rect x="${b.x-1}" y="${b.y-1}" width="${b.w+2}" height="${b.h+2}" fill="none" stroke="#3b85b5" stroke-width="0.22" stroke-dasharray="1.2 0.8"/>${[[b.x-1,b.y-1],[b.x+b.w+1,b.y-1],[b.x-1,b.y+b.h+1],[b.x+b.w+1,b.y+b.h+1]].map(([x,y])=>`<rect x="${x-.6}" y="${y-.6}" width="1.2" height="1.2" fill="white" stroke="#3b85b5" stroke-width=".2"/>`).join('')}</g>`;}
  $('#selection').innerHTML=overlay;
  $('#canvas').style.cursor=preview?'default':tool==='select'?'default':'crosshair';
  $('#canvas-mode').textContent=preview?'加工プレビュー · 実際に出力されるカット線':'スケッチ編集中';
  $('#hint').textContent=preview?'赤い線をカットします。ブリッジ部分には線が出力されません。':tool==='select'?'ドラッグで移動  ·  矢印キーで微調整  ·  Deleteで削除':`${labels[tool]}を配置する場所をクリック`;
  $('#board-label').textContent=`${project.width} × ${project.height} mm`;
  $('#zoom-reset').textContent=`${Math.round(zoom*100)}%`;
}
function render(){
  $('#project-name').textContent=project.name;
  renderLayers();renderProperties();renderCanvas();
  document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  $('#preview').classList.toggle('active',preview);$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;
  $('#outline').disabled=selectedItem()?.type!=='text';$('#delete').disabled=$('#duplicate').disabled=!selectedItem();
  const c=cutGeometry(project.items),outside=!withinBoard();
  $('#checks').innerHTML=`<div class="check-row"><span>閉じた輪郭</span><b>${c.closed}</b></div><div class="check-row ${c.untouched?'warning':'success'}"><span>切り残しなし</span><b>${c.untouched}</b></div><div class="check-row"><span>ブリッジ</span><b>${project.items.filter(i=>i.type==='bridge').length}</b></div>${c.vanished?`<div class="check-row warning"><span>完全に隠れた輪郭</span><b>${c.vanished}</b></div>`:''}<div class="check-summary ${outside||c.vanished?'warning':''}">${c.vanished?'! ブリッジ幅を縮めて輪郭を残してください':outside?'! 加工エリア外にカット線があります':c.untouched?'! 脱落させたくない輪郭にブリッジを追加':c.closed?'✓ 全閉輪郭に切り残しあり · 強度は要確認':'図形や文字を追加してください'}</div>`;
}
function updateSelected(key,value){const old=selectedItem();if(!old)return;
  try{const next={...old,[key]:value};
    if(next.type==='text'&&['text','font','size','spacing','vertical'].includes(key)){next.contours=textContours(next);next.name=next.text||'空の文字';}
    else if(['rect','circle','line'].includes(next.type))next.contours=shapeContours(next.type,next.w,next.h);
    checkpoint();project.items[project.items.indexOf(old)]=next;commit();
  }catch(e){notify(e.message);renderProperties();}
}
$('#properties').addEventListener('change',e=>{
  const el=e.target;if(el.dataset.prop){if(!el.checkValidity()||!Number.isFinite(el.valueAsNumber)){notify('有効な数値を入力してください。');renderProperties();return;}updateSelected(el.dataset.prop,el.valueAsNumber);}
  else if(el.id==='text-content')updateSelected('text',el.value);
  else if(el.id==='font-select')updateSelected('font',el.value);
  else if(el.id==='vertical')updateSelected('vertical',el.checked);
});
$('#properties').addEventListener('click',e=>{if(e.target.closest('#add-font'))$('#font-file').click();});
$('#layers').addEventListener('click',e=>{const b=e.target.closest('[data-layer]');if(b){selected=b.dataset.layer;render();}});
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>{tool=b.dataset.tool;preview=false;render();};
$('#add-text').onclick=()=>addItem('text');
$('#preview').onclick=()=>{preview=!preview;tool='select';render();};
$('#snap').onchange=e=>snap=e.target.checked;
$('#undo').onclick=undo;$('#redo').onclick=redo;
function remove(){if(!selectedItem())return;checkpoint();project.items=project.items.filter(i=>i.id!==selected);selected=null;commit();}
$('#delete').onclick=remove;
$('#duplicate').onclick=()=>{const i=selectedItem();if(!i)return;checkpoint();const copy=structuredClone(i);copy.id=uid();copy.x+=5;copy.y+=5;project.items.push(copy);selected=copy.id;commit();};
$('#outline').onclick=()=>{const i=selectedItem();if(i?.type!=='text')return;checkpoint();i.type='outline';commit();notify('文字を固定アウトラインに変換しました。元に戻す操作で再編集できます。');};
$('#auto-bridge').onclick=()=>{
  const added=automaticBridges(project.items,1.5);if(!added.length){notify('切り残しを追加する閉輪郭はありません。');return;}
  if(project.items.length+added.length>2000){notify('オブジェクトが多すぎます。文字を減らしてください。');return;}
  checkpoint();project.items.push(...added.map(i=>({...i,id:uid()})));preview=true;selected=null;commit();notify(`${added.length} 個の保持用ブリッジを追加しました。位置と強度を確認してください。`);
};
$('#export').onclick=exportFile;
$('#save-project').onclick=()=>download('typefab-project.json',JSON.stringify(project,null,2),'application/json');
$('#open-project').onclick=()=>$('#project-file').click();
$('#new-project').onclick=()=>{checkpoint();project={version:1,name:'無題のスケッチ',width:240,height:160,items:[]};selected=null;preview=false;commit();notify('新規プロジェクトを作成しました。元に戻す操作で復元できます。');};
for(const key of ['width','height'])$(`#board-${key}`).onchange=e=>{if(!e.target.checkValidity()||!Number.isFinite(e.target.valueAsNumber)){renderProperties();return;}checkpoint();project[key]=e.target.valueAsNumber;commit();};
$('#font-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{
  if(file.size>30*1024*1024)throw Error('フォントは30 MB以下にしてください。');
  const font=opentype.parse(await file.arrayBuffer());const id=`custom-${uid()}`;
  fonts.set(id,font);fontLabels.set(id,file.name.replace(/\.[^.]+$/,''));if(selectedItem()?.type==='text')updateSelected('font',id);else render();notify('フォントを追加しました。追加フォントはこのセッション内で利用できます。');
}catch(error){notify(`フォントを読み込めません: ${error.message}`);}e.target.value='';};
$('#project-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{
  if(file.size>20*1024*1024)throw Error('プロジェクトは20 MB以下にしてください。');
  const next=validateProject(JSON.parse(await file.text()));checkpoint();project=next;selected=null;preview=false;commit();notify('プロジェクトを開きました。追加フォントの文字は保存された輪郭で表示します。');
}catch(error){notify(`開けません: ${error.message}`);}e.target.value='';};
function canvasPoint(e){const matrix=$('#canvas').getScreenCTM();return new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());}
$('#canvas').addEventListener('pointerdown',e=>{
  if(e.button!==0||preview)return;const p=canvasPoint(e);
  if(tool!=='select'){addItem(tool,snap?Math.round(p.x):p.x,snap?Math.round(p.y):p.y);return;}
  const target=e.target.closest('[data-object]');selected=target?.dataset.object||null;
  const i=selectedItem();if(i){drag={id:i.id,start:p,x:i.x,y:i.y,moved:false};$('#canvas').setPointerCapture(e.pointerId);}render();
});
$('#canvas').addEventListener('pointermove',e=>{
  if(!drag)return;const p=canvasPoint(e),i=project.items.find(i=>i.id===drag.id);if(!i)return;
  if(!drag.moved){if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)<.3)return;checkpoint();drag.moved=true;}
  i.x=drag.x+p.x-drag.start.x;i.y=drag.y+p.y-drag.start.y;if(snap){i.x=Math.round(i.x);i.y=Math.round(i.y);}renderCanvas();
});
for(const event of ['pointerup','pointercancel'])$('#canvas').addEventListener(event,()=>{if(drag?.moved)commit();drag=null;});
function setZoom(v){zoom=Math.min(4,Math.max(.25,v));renderCanvas();}
$('#zoom-in').onclick=()=>setZoom(zoom*1.25);$('#zoom-out').onclick=()=>setZoom(zoom/1.25);$('#zoom-reset').onclick=()=>setZoom(1);
new ResizeObserver(()=>renderCanvas()).observe($('#canvas-scroll'));
window.addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||$('#help').open)return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(e.key==='Escape'){selected=null;tool='select';render();}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&selectedItem()){
    e.preventDefault();checkpoint();const i=selectedItem(),d=e.shiftKey?5:.5;
    if(e.key==='ArrowUp')i.y-=d;if(e.key==='ArrowDown')i.y+=d;if(e.key==='ArrowLeft')i.x-=d;if(e.key==='ArrowRight')i.x+=d;commit();
  }
});
$('#help-button').onclick=()=>$('#help').showModal();$('#close-help').onclick=$('#start').onclick=()=>$('#help').close();
async function init(){
  render();try{
    await Promise.all([['zen','ZenKakuGothicNew-Regular.ttf'],['shippori','ShipporiMincho-Regular.ttf']].map(async([id,file])=>{
      const res=await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);if(!res.ok)throw Error(`フォント取得に失敗 (${res.status})`);fonts.set(id,opentype.parse(await res.arrayBuffer()));
    }));
    let restored=false;try{const saved=localStorage.getItem('typefab-v1');if(saved){project=validateProject(JSON.parse(saved));restored=true;}}catch{notify('自動保存データを復元できませんでした。');}
    if(!restored){
      const title={id:uid(),type:'text',name:'つくる、を自由に。',text:'つくる、を自由に。',x:30,y:47,rotation:0,font:'zen',size:20,spacing:.5,vertical:false};title.contours=textContours(title);
      const sub={id:uid(),type:'text',name:'MAKE IT YOURS',text:'MAKE IT YOURS',x:33,y:81,rotation:0,font:'zen',size:7,spacing:1.4,vertical:false};sub.contours=textContours(sub);
      const line={id:uid(),type:'line',name:'アクセントライン',x:33,y:103,rotation:0,w:170,h:0,contours:shapeContours('line',170,0)};
      project.items=[title,sub,line];selected=title.id;
    }
    commit();notify('準備ができました。文字を編集して、あなただけのデザインに。');
  }catch(e){notify(`${e.message} · ページを再読み込みしてください。`);}
}
init();
