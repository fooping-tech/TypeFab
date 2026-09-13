export function validateProject(p){
  if(!p||p.version!==1||!Number.isFinite(p.width)||!Number.isFinite(p.height)||p.width<10||p.height<10||p.width>2000||p.height>2000||!Array.isArray(p.items)||p.items.length>2000)throw Error('TypeFabプロジェクト形式またはサイズが不正です。');
  const ids=new Set();let points=0;
  for(const i of p.items){
    if(!['text','outline','rect','circle','line','bridge'].includes(i.type)||typeof i.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(i.id)||ids.has(i.id))throw Error('オブジェクト形式が不正です。');ids.add(i.id);
    for(const key of ['x','y','rotation'])if(!Number.isFinite(i[key])||Math.abs(i[key])>10000)throw Error('座標が不正です。');
    if(i.type==='bridge'||['rect','circle','line'].includes(i.type))for(const key of ['w','h'])if(!Number.isFinite(i[key])||i[key]<0||i[key]>2000||(i.type!=='line'&&i[key]===0))throw Error('寸法が不正です。');
    if(i.type==='text'&&(typeof i.text!=='string'||i.text.length>500||typeof i.font!=='string'||!Number.isFinite(i.size)||i.size<1||i.size>300||!Number.isFinite(i.spacing)||Math.abs(i.spacing)>100))throw Error('文字設定が不正です。');
    if(i.type!=='bridge'){
      if(!Array.isArray(i.contours))throw Error('輪郭がありません。');
      for(const c of i.contours){if(!Array.isArray(c)||c.length<2)throw Error('輪郭が不正です。');points+=c.length;
        if(points>300000)throw Error('輪郭データが大きすぎます。');
        for(const q of c)if(!q||!Number.isFinite(q.x)||!Number.isFinite(q.y)||Math.abs(q.x)>10000||Math.abs(q.y)>10000)throw Error('輪郭の座標が不正です。');
      }
    }
  }
  return {version:1,name:typeof p.name==='string'?p.name.slice(0,100):'無題',width:p.width,height:p.height,items:p.items};
}
