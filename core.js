(() => {
'use strict';
const ENGINES = [
  { id:'google', name:'Google', key:'g', symbol:'G', url:'https://www.google.com/search?q=' },
  { id:'bing', name:'Bing', key:'b', symbol:'b', url:'https://www.bing.com/search?q=' },
  { id:'baidu', name:'百度', key:'bd', symbol:'百', url:'https://www.baidu.com/s?wd=' },
  { id:'github', name:'GitHub', key:'gh', symbol:'⌘', url:'https://github.com/search?q=' },
  { id:'bilibili', name:'哔哩哔哩', key:'bi', symbol:'哔', url:'https://search.bilibili.com/all?keyword=' },
  { id:'zhihu', name:'知乎', key:'zh', symbol:'知', url:'https://www.zhihu.com/search?type=content&q=' },
  { id:'douban', name:'豆瓣', key:'db', symbol:'豆', url:'https://www.douban.com/search?q=' },
  { id:'taobao', name:'淘宝', key:'tb', symbol:'淘', url:'https://s.taobao.com/search?q=' },
  { id:'translate', name:'翻译', key:'tr', symbol:'译', url:'https://translate.google.com/?sl=auto&tl=zh-CN&op=translate&text=' },
  { id:'duckduckgo', name:'DuckDuckGo', key:'dd', symbol:'D', url:'https://duckduckgo.com/?q=' },
  { id:'brave', name:'Brave', key:'br', symbol:'B', url:'https://search.brave.com/search?q=' },
  { id:'yahoo', name:'Yahoo', key:'yh', symbol:'Y', url:'https://search.yahoo.com/search?p=' },
  { id:'youtube', name:'YouTube', key:'yt', symbol:'▶', url:'https://www.youtube.com/results?search_query=' },
  { id:'wikipedia', name:'维基百科', key:'wk', symbol:'W', url:'https://zh.wikipedia.org/w/index.php?search=' },
  { id:'stackoverflow', name:'Stack Overflow', key:'so', symbol:'S', url:'https://stackoverflow.com/search?q=' },
  { id:'npm', name:'npm', key:'npm', symbol:'n', url:'https://www.npmjs.com/search?q=' },
  { id:'scholar', name:'Google 学术', key:'gs', symbol:'学', url:'https://scholar.google.com/scholar?q=' },
  { id:'sogou', name:'搜狗', key:'sg', symbol:'搜', url:'https://www.sogou.com/web?query=' },
].map(engine=>Object.freeze({...engine,icon:engine.id,url:engine.url+'{query}',pinned:['google','bing','baidu','github','bilibili','zhihu','douban'].includes(engine.id)}));
Object.freeze(ENGINES);
const ENGINE_ICON_IDS=Object.freeze([...ENGINES.map(engine=>engine.id),'search','globe','book','shopping','code','sparkles','symbol']);
const BOOKMARK_ICON_IDS=Object.freeze([...ENGINE_ICON_IDS.filter(id=>id!=='symbol'),'mail','note','design','docs','deploy']);
function resolveBookmarkIcon(bookmark){
  if(BOOKMARK_ICON_IDS.includes(bookmark.glyph))return bookmark.glyph;
  const hostname=new URL(bookmark.url).hostname.replace(/^www\./,'');
  const known={'mail.google.com':'mail','notion.so':'note','figma.com':'design','developer.mozilla.org':'docs','vercel.com':'deploy'};
  return (Object.hasOwn(known,hostname)?known[hostname]:undefined)||ENGINES.find(engine=>new URL(engine.url.replace('{query}','search')).hostname.replace(/^www\./,'')===hostname)?.icon||'globe';
}
function buildMonochromeMask(data,width,height,preserveAlpha=false){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length!==width*height*4)throw new Error('图标像素数据无效');
  const pixels=new Uint8ClampedArray(data.length);
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)return {pixels,bounds:null};
  let translucent=0;const samples=[[],[],[]];
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const at=(y*width+x)*4;if(data[at+3]<245)translucent++;
    if((x===left||x===right||y===top||y===bottom)&&data[at+3]>=245)for(let channel=0;channel<3;channel++)samples[channel].push(data[at+channel]);
  }
  const useAlpha=preserveAlpha||translucent/((right-left+1)*(bottom-top+1))>.02;
  const background=samples.map(values=>{values.sort((a,b)=>a-b);return values.length?values[Math.floor(values.length/2)]:255;});
  let minX=width,minY=height,maxX=-1,maxY=-1;
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const at=(y*width+x)*4;
    const distance=Math.hypot(data[at]-background[0],data[at+1]-background[1],data[at+2]-background[2]);
    const alpha=Math.round(data[at+3]*(useAlpha?1:Math.min(1,Math.max(0,(distance-22)/50))));
    pixels[at]=pixels[at+1]=pixels[at+2]=255;pixels[at+3]=alpha;
    if(alpha>16){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  }
  return {pixels,bounds:maxX<minX?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}};
}
const uid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return Array.from(bytes, (b, i) => ([4,6,8,10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0')).join('');
};
function normalizeUrl(value) {
  const text=String(value).trim();
  if (!text || text.length>4096) throw new Error('请输入有效的网址');
  const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(text)?text:`https://${text}`);
  if (!['http:','https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('网址仅支持 HTTP 或 HTTPS，且不能包含账号密码');
  return url.href;
}
function searchTarget(input, engineId, engines=ENGINES) {
  let query=input.trim();
  if (!query) return null;
  const shortcut=query.match(/^(\w+)\s+([\s\S]*)$/);
  let engine=engines.find(e=>e.id===engineId)||engines[0];
  if (!engine) return null;
  if (shortcut) {const match=engines.find(e=>e.key&&e.key===shortcut[1].toLowerCase()); if(match){engine=match;query=shortcut[2].trim();}}
  if(!query)return null;
  if (/^https?:\/\//i.test(query) || /^(?:localhost(?::\d+)?|(?:[\w-]+\.)+[a-z]{2,})(?:[/:?#][^\s]*)?$/i.test(query)) {
    try{return normalizeUrl(query);}catch{ /* Use a search for malformed URLs. */ }
  }
  return engine.url.replace('{query}',encodeURIComponent(query));
}
const DOCK_DEFAULTS={dockShowNames:false,dockNameSize:12,dockTooltip:true,dockMovable:false,dockZoom:true,dockSize:42,dockGap:12,dockScale:1.65,dockRadius:120,dockSpeed:180,dockOpacity:20,dockWidth:880,dockPosition:'bottom',dockX:50,dockY:85};
const DOCK_RANGES={dockNameSize:[8,32],dockSize:[16,160],dockGap:[0,160],dockScale:[1,4],dockRadius:[20,600],dockSpeed:[0,2000],dockOpacity:[0,100],dockWidth:[120,3840],dockX:[0,100],dockY:[0,100]};
function createDefaults() {
  const sites=[['GitHub','https://github.com','work'],['Gmail','https://mail.google.com','work'],['Notion','https://www.notion.so','work'],['Figma','https://www.figma.com','work'],['哔哩哔哩','https://www.bilibili.com','fun'],['知乎','https://www.zhihu.com','fun'],['豆瓣','https://www.douban.com','fun'],['YouTube','https://www.youtube.com','fun'],['MDN','https://developer.mozilla.org/zh-CN/','dev'],['Stack Overflow','https://stackoverflow.com','dev'],['npm','https://www.npmjs.com','dev'],['Vercel','https://vercel.com','dev']];
  return { version:1, groups:[{id:'work',name:'工作空间'},{id:'fun',name:'生活娱乐'},{id:'dev',name:'开发工具'}],dockFolders:[],dockOrder:[],folderView:'grid',bookmarks:sites.map(([name,url,group])=>({id:uid(),name,url:normalizeUrl(url),group,icon:''})),todos:[],notes:'',activeGroup:'all',engines:ENGINES.map(e=>({...e})),engine:'google',theme:'dark',clockColorMode:'auto',clockColor:'#ffffff',clockBackgroundColor:'#000000',clockBackgroundOpacity:14,clockBackdropColor:'#90aaa1',themeColorMode:'manual',themeColor:'#3b6957',wallpaperThemeColor:'#55796d',wallpaper:'forest',iconSize:48,columns:8,opacity:64,showWidgets:true,showDiscovery:true,...DOCK_DEFAULTS,newTab:true,zen:false,weatherEnabled:false,location:{name:'新加坡',latitude:1.3,longitude:103.9},rss:'',timer:{minutes:25,remaining:1500,deadline:null}};
}
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const bounded=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
const str=(value,max)=>typeof value==='string'&&value.length<=max;
function validateEngines(raw) {
  if(!Array.isArray(raw)||raw.length<1||raw.length>64)throw new Error('请保留 1 至 64 个搜索引擎');
  const ids=new Set(),keys=new Set();
  return raw.map(engine=>{
    if(!plain(engine)||!str(engine.id,80)||!/^[a-z\d_-]+$/i.test(engine.id)||!str(engine.name,32)||!engine.name.trim()||!str(engine.symbol,8)||!engine.symbol.trim()||!str(engine.key,8)||!str(engine.url,2048)||typeof engine.pinned!=='boolean')throw new Error('搜索引擎信息无效，请检查名称、图标和网址');
    const key=engine.key.trim().toLowerCase(),url=engine.url.trim();
    const builtin=ENGINES.find(item=>item.id===engine.id);
    const icon=engine.icon??(builtin&&builtin.symbol===engine.symbol?builtin.icon:'symbol');
    if(!ENGINE_ICON_IDS.includes(icon))throw new Error('搜索引擎图标无效，请从内置图标中选择');
    if(key&&!/^[a-z][a-z\d]{0,7}$/.test(key))throw new Error('快捷指令须为 1 至 8 位英文字母或数字，以字母开头');
    if(ids.has(engine.id)||key&&keys.has(key))throw new Error('搜索引擎编号或快捷指令重复');
    if((url.match(/\{query\}/g)||[]).length!==1)throw new Error('搜索网址必须包含一个 {query}，用于替换关键词');
    const sample=normalizeUrl(url.replace('{query}','qipagekeyword'));
    if(!/^https?:\/\//i.test(url)||new URL(sample).host.includes('qipagekeyword'))throw new Error('请填写完整 HTTP/HTTPS 搜索网址，关键词不能放在域名中');
    ids.add(engine.id);if(key)keys.add(key);
    return {id:engine.id,name:engine.name.trim(),key,symbol:engine.symbol.trim(),icon,url,pinned:engine.pinned};
  });
}
function coarseLocation(location) {
  if(!plain(location)||!str(location.name,100)||!bounded(location.latitude,-90,90)||!bounded(location.longitude,-180,180))throw new Error('城市坐标无效');
  return {name:location.name,latitude:Number(location.latitude.toFixed(1))||0,longitude:Number(location.longitude.toFixed(1))||0};
}
function validateBackup(raw) {
  if(!plain(raw)||raw.version!==1)throw new Error('备份版本不受支持');
  const s=createDefaults();
  if(!Array.isArray(raw.groups)||!raw.groups.length||raw.groups.length>30||!raw.groups.every(g=>plain(g)&&str(g.id,80)&&g.id&&g.id!=='all'&&str(g.name,16)&&g.name.trim()))throw new Error('备份分组无效');
  const ids=new Set(raw.groups.map(g=>g.id));
  if(ids.size!==raw.groups.length)throw new Error('备份分组重复');
  s.groups=raw.groups.map(({id,name})=>({id,name:name.trim()}));
  if(!Array.isArray(raw.bookmarks)||raw.bookmarks.length>500)throw new Error('备份网址无效');
  s.bookmarks=raw.bookmarks.map(b=>{
    if(!plain(b)||!str(b.id,80)||!b.id||!str(b.name,32)||!b.name.trim()||!ids.has(b.group)||!str(b.url,4096))throw new Error('备份中有无效的网址');
    const icon=b.icon||'';
    if(!str(icon,150000)||icon&&!/^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(icon))throw new Error('备份中有无效的图标');
    if(b.glyph!==undefined&&!BOOKMARK_ICON_IDS.includes(b.glyph))throw new Error('备份中有无效的快捷方式图形');
    if(b.iconMask!==undefined&&(!icon||!str(b.iconMask,150000)||!/^data:image\/png;base64,[a-z\d+/=]+$/i.test(b.iconMask)))throw new Error('备份中有无效的图标蒙版');
    const siteIconUrl=b.siteIconUrl===undefined?'':normalizeUrl(b.siteIconUrl);
    if(siteIconUrl&&(!b.websiteIcon||new URL(siteIconUrl).origin!==new URL(normalizeUrl(b.url)).origin))throw new Error('网站图标须来自同一站点');
    if(b.websiteIcon!==undefined&&typeof b.websiteIcon!=='boolean')throw new Error('网站图标设置无效');
    return {id:b.id,name:b.name.trim(),url:normalizeUrl(b.url),group:b.group,icon,...(b.websiteIcon?{websiteIcon:true,...(bounded(b.iconGrayscale,0,100)?{iconGrayscale:Math.round(b.iconGrayscale*100)/100}:{}),...(siteIconUrl?{siteIconUrl}:{})}:{}),...(b.glyph?{glyph:b.glyph}:{}),...(b.iconMask?{iconMask:b.iconMask}:{})};
  });
  if(new Set(s.bookmarks.map(b=>b.id)).size!==s.bookmarks.length)throw new Error('备份网址编号重复');
  const bookmarkIds=new Set(s.bookmarks.map(b=>b.id)),folderIds=new Set(),contained=new Set();
  s.folderView=raw.folderView==='list'?'list':'grid';
  if(raw.dockFolders!==undefined){
    if(!Array.isArray(raw.dockFolders)||raw.dockFolders.length>100)throw new Error('备份 Dock 文件夹无效');
    s.dockFolders=raw.dockFolders.map(folder=>{
      if(!plain(folder)||!str(folder.id,80)||!folder.id||bookmarkIds.has(folder.id)||folderIds.has(folder.id)||!str(folder.name,32)||!folder.name.trim()||!Array.isArray(folder.bookmarkIds)||folder.bookmarkIds.length>500)throw new Error('备份 Dock 文件夹无效');
      folderIds.add(folder.id);
      for(const id of folder.bookmarkIds){
        if(!bookmarkIds.has(id)||contained.has(id))throw new Error('文件夹中有无效或重复的网址');
        contained.add(id);
      }
      if(folder.sourcePath!==undefined&&!validBookmarkPath(folder.sourcePath))throw new Error('备份文件夹路径无效');
      if(folder.parentId!==undefined&&(!str(folder.parentId,80)||!folder.parentId))throw new Error('备份文件夹上级无效');
      if(folder.itemOrder!==undefined&&(!Array.isArray(folder.itemOrder)||folder.itemOrder.length>600||folder.itemOrder.some(id=>!str(id,80))||new Set(folder.itemOrder).size!==folder.itemOrder.length))throw new Error('备份文件夹排序无效');
      return {id:folder.id,name:folder.name.trim(),bookmarkIds:[...folder.bookmarkIds],...(folder.itemOrder?{itemOrder:[...folder.itemOrder]}:{}),...(folder.parentId?{parentId:folder.parentId}:{}),...(folder.sourcePath?{sourcePath:[...folder.sourcePath]}:{})};
    });
  }
  const folderMap=new Map(s.dockFolders.map(folder=>[folder.id,folder]));
  for(const folder of s.dockFolders){
    const seen=new Set([folder.id]);let parent=folder.parentId;
    while(parent){if(!folderMap.has(parent)||seen.has(parent)||seen.size>=32)throw new Error('备份文件夹层级无效');seen.add(parent);parent=folderMap.get(parent).parentId;}
  }
  const nestedIds=new Set(s.dockFolders.filter(folder=>folder.parentId).map(folder=>folder.id));
  if(raw.dockOrder!==undefined){
    if(!Array.isArray(raw.dockOrder)||raw.dockOrder.length>600||new Set(raw.dockOrder).size!==raw.dockOrder.length||raw.dockOrder.some(id=>!folderIds.has(id)&&(!bookmarkIds.has(id)||contained.has(id))))throw new Error('备份 Dock 顺序无效');
    if(raw.dockOrder.some(id=>nestedIds.has(id)))throw new Error('备份 Dock 顺序包含子文件夹');
    s.dockOrder=[...raw.dockOrder];
  }
  if(!Array.isArray(raw.todos)||raw.todos.length>300||!raw.todos.every(t=>plain(t)&&str(t.id,80)&&t.id&&str(t.text,160)&&t.text.trim()&&typeof t.done==='boolean'))throw new Error('备份待办无效');
  s.todos=raw.todos.map(({id,text,done})=>({id,text,done}));
  if(new Set(s.todos.map(t=>t.id)).size!==s.todos.length)throw new Error('备份待办编号重复');
  if(!str(raw.notes,12000))throw new Error('备份便签无效');s.notes=raw.notes;
  s.activeGroup=raw.activeGroup==='all'||ids.has(raw.activeGroup)?raw.activeGroup:'all';
  if(raw.engines!==undefined)s.engines=validateEngines(raw.engines);
  s.engine=s.engines.some(e=>e.id===raw.engine)?raw.engine:s.engines[0].id;
  if(['dark','light','system'].includes(raw.theme))s.theme=raw.theme;
  if(['auto','manual'].includes(raw.clockColorMode))s.clockColorMode=raw.clockColorMode;
  for(const key of ['clockColor','clockBackgroundColor','clockBackdropColor'])if(typeof raw[key]==='string'&&/^#[a-f\d]{6}$/i.test(raw[key]))s[key]=raw[key].toLowerCase();
  if(bounded(raw.clockBackgroundOpacity,0,60))s.clockBackgroundOpacity=raw.clockBackgroundOpacity;
  if(['manual','wallpaper'].includes(raw.themeColorMode))s.themeColorMode=raw.themeColorMode;
  for(const key of ['themeColor','wallpaperThemeColor'])if(typeof raw[key]==='string'&&/^#[a-f\d]{6}$/i.test(raw[key]))s[key]=raw[key].toLowerCase();
  if(['forest','dusk','ocean','custom'].includes(raw.wallpaper))s.wallpaper=raw.wallpaper;
  if(bounded(raw.iconSize,36,68))s.iconSize=raw.iconSize;
  if([6,8,10].includes(raw.columns))s.columns=raw.columns;
  if(bounded(raw.opacity,15,95))s.opacity=raw.opacity;
  for(const [key,value]of Object.entries(DOCK_DEFAULTS)){
    if(typeof value==='boolean'&&typeof raw[key]==='boolean')s[key]=raw[key];
    else if(typeof value==='number'){
      const range=DOCK_RANGES[key];
      if(range&&bounded(raw[key],...range))s[key]=raw[key];
    }
  }
  if(['bottom','top','left','right','custom'].includes(raw.dockPosition))s.dockPosition=raw.dockPosition;
  for(const key of ['showWidgets','showDiscovery','dockShowNames','newTab','zen','weatherEnabled'])if(typeof raw[key]==='boolean')s[key]=raw[key];
  if(plain(raw.location)&&str(raw.location.name,100)&&bounded(raw.location.latitude,-90,90)&&bounded(raw.location.longitude,-180,180))s.location=coarseLocation(raw.location);
  if(raw.rss)s.rss=normalizeUrl(raw.rss);
  if(plain(raw.timer)&&[5,15,25].includes(raw.timer.minutes)&&bounded(raw.timer.remaining,0,raw.timer.minutes*60)&&(raw.timer.deadline===null||bounded(raw.timer.deadline,0,8640000000000000)))s.timer={minutes:raw.timer.minutes,remaining:raw.timer.remaining,deadline:raw.timer.deadline};
  return s;
}
function validBookmarkPath(path){return Array.isArray(path)&&path.length<=32&&path.every(name=>str(name,256)&&name.trim())&&path.join('/').length<=4096;}
function validateBrowserBookmarkFile(raw){
  if(!plain(raw)||raw.format!=='qipage.browser-bookmarks'||raw.version!==1||!Array.isArray(raw.bookmarks)||raw.bookmarks.length>500)throw new Error('请选择扩展下载的书签导入文件，每次最多 500 项');
  return raw.bookmarks.map(entry=>{
    if(!plain(entry)||!str(entry.title,1024)||!str(entry.url,4096)||!entry.url.trim()||!validBookmarkPath(entry.path??[]))throw new Error('书签名称、网址或文件夹路径无效');
    const url=normalizeUrl(entry.url);
    return {title:entry.title.trim()||new URL(url).hostname,url,path:(entry.path||[]).map(name=>name.trim())};
  });
}
function planBrowserBookmarkImport(current,raw,options={}){
  const entries=validateBrowserBookmarkFile(raw),urls=new Set(current.bookmarks.map(b=>b.url)),add=[];
  let duplicates=0;
  for(const entry of entries){if(urls.has(entry.url)){duplicates++;continue;}urls.add(entry.url);add.push(entry);}
  if(add.length+current.bookmarks.length>500)throw new Error(`最多再导入 ${500-current.bookmarks.length} 个网址，请减少选择`);
  const contained=new Set(current.dockFolders.flatMap(folder=>folder.bookmarkIds));
  const visible=[...current.bookmarks.filter(b=>!contained.has(b.id)),...current.dockFolders.filter(folder=>!folder.parentId)].map(item=>item.id);
  const next={...current,groups:[...current.groups],bookmarks:[...current.bookmarks],dockFolders:current.dockFolders.map(folder=>({...folder,bookmarkIds:[...folder.bookmarkIds]})),dockOrder:[...current.dockOrder,...visible.filter(id=>!current.dockOrder.includes(id))]};
  let group=options.groupId==='new'||!options.groupId?next.groups.find(group=>group.name==='浏览器书签'):next.groups.find(group=>group.id===options.groupId);
  if(!group&&add.length){
    if(options.groupId&&options.groupId!=='new')throw new Error('请选择有效的导入分组');
    if(next.groups.length>=30)throw new Error('分组已达上限，请选择现有分组');
    group={id:uid(),name:'浏览器书签'};next.groups.push(group);
  }
  let foldersAdded=0;
  for(const entry of add){
    const bookmark={id:uid(),name:entry.title.slice(0,32),url:entry.url,group:group.id,icon:''};next.bookmarks.push(bookmark);
    if(options.keepFolders!==false&&entry.path.length){
      let folder,parentId;
      for(let depth=0;depth<entry.path.length;depth++){
        const sourcePath=entry.path.slice(0,depth+1),key=JSON.stringify(sourcePath);
        folder=next.dockFolders.find(item=>item.parentId===parentId&&item.sourcePath&&JSON.stringify(item.sourcePath)===key);
        if(!folder){
          if(next.dockFolders.length>=100)throw new Error('文件夹已达上限，请减少选择或关闭保留层级');
          folder={id:uid(),name:entry.path[depth].slice(0,32),sourcePath,bookmarkIds:[],...(parentId?{parentId}:{})};
          next.dockFolders.push(folder);if(!parentId)next.dockOrder.push(folder.id);foldersAdded++;
        }
        parentId=folder.id;
      }
      folder.bookmarkIds.push(bookmark.id);
    }else next.dockOrder.push(bookmark.id);
  }
  if(add.length)next.activeGroup=group.id;
  return {state:next,added:add.length,duplicates,foldersAdded};
}
function bestClockColor(background,panel='#000000',opacity=14){
  const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
  const behind=rgb(background),surface=rgb(panel),alpha=Math.max(0,Math.min(60,opacity))/100;
  const linear=behind.map((value,index)=>(value*(1-alpha)+surface[index]*alpha)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  const luminance=linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
  return (luminance+.05)/.05>=1.05/(luminance+.05)?'#000000':'#ffffff';
}
function extractThemeColor(pixels){
  if(!pixels||pixels.length%4)return null;
  const buckets=new Map();let opaque=0;
  for(let i=0;i<pixels.length;i+=4){
    if(pixels[i+3]<128)continue;opaque++;
    const r=pixels[i],g=pixels[i+1],b=pixels[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);
    if(max<24||min>235)continue;
    const weight=.3+(max-min)/255,key=[r,g,b].map(value=>Math.floor(value/32)).join(',');
    const entry=buckets.get(key)||{weight:0,r:0,g:0,b:0};
    entry.weight+=weight;entry.r+=r*weight;entry.g+=g*weight;entry.b+=b*weight;buckets.set(key,entry);
  }
  const best=[...buckets.values()].sort((a,b)=>b.weight-a.weight)[0];
  if(!best)return opaque?'#657387':null;
  return '#'+['r','g','b'].map(key=>Math.round(best[key]/best.weight).toString(16).padStart(2,'0')).join('');
}
function themePalette(hex,light=false,strength=64){
  if(typeof hex!=='string'||!/^#[a-f\d]{6}$/i.test(hex))throw new Error('主题色须为六位 HEX 色值');
  const rgb=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
  const mix=(target,amount)=>'#'+rgb.map(value=>Math.round(value*(1-amount)+target*amount).toString(16).padStart(2,'0')).join('');
  const contrast=color=>bestClockColor(color,'#000000',0);
  const level=Math.max(0,Math.min(1,(strength-15)/80));
  const surface=light?mix(255,.94-.12*level):mix(0,.78-.18*level);
  const dialog=mix(light?255:0,light ? .94 : .78),control=mix(light?255:0,light ? .76 : .65);
  const luminance=color=>{const c=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  let amount=light?.6:.65,accent=mix(light?0:255,amount);
  while([surface,dialog,control].some(background=>ratio(accent,background)<4.5)&&amount<1){amount=Math.min(1,amount+.02);accent=mix(light?0:255,amount);}
  const iconBackground=mix(255,.78),search=mix(255,.9);
  return {accent,dialog,surface,control,text:contrast(surface),muted:contrast(surface),dialogText:contrast(dialog),controlText:contrast(control),primaryText:contrast(accent),searchText:contrast(search),iconText:contrast(iconBackground),panel:[1,3,5].map(index=>parseInt(surface.slice(index,index+2),16)).join(','),iconBackground,iconInk:mix(0,.55),folderBackground:mix(255,.7),search,rgb:rgb.join(' ')};
}
function secondsLeft(timer, now=Date.now()) {return timer.deadline===null?timer.remaining:Math.max(0,Math.ceil((timer.deadline-now)/1000));}
function weatherLabel(code) {
  if(code===0)return ['晴朗','sun'];if([1,2].includes(code))return ['晴间多云','cloud-sun'];if(code===3)return ['多云','cloud'];if([45,48].includes(code))return ['有雾','cloud'];if([71,73,75,77,85,86].includes(code))return ['降雪','snow'];if([95,96,99].includes(code))return ['雷雨','storm'];return ['有雨','rain'];
}

globalThis.QiPageCore = Object.freeze({validateBrowserBookmarkFile,planBrowserBookmarkImport,bestClockColor,extractThemeColor,themePalette,DOCK_DEFAULTS,DOCK_RANGES,ENGINES,ENGINE_ICON_IDS,BOOKMARK_ICON_IDS,resolveBookmarkIcon,buildMonochromeMask,uid,normalizeUrl,searchTarget,createDefaults,validateBackup,validateEngines,coarseLocation,secondsLeft,weatherLabel});
})();
