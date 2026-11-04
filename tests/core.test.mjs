import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import '../core.js';
const {ENGINES,ENGINE_ICON_IDS,BOOKMARK_ICON_IDS,resolveBookmarkIcon,buildMonochromeMask,createDefaults,normalizeUrl,searchTarget,validateBackup,validateEngines,secondsLeft,weatherLabel} = globalThis.QiPageCore;

test('网址补全协议，并拒绝脚本及带凭据的网址',()=>{
  assert.equal(normalizeUrl('github.com'), 'https://github.com/');
  assert.equal(normalizeUrl('http://localhost:3000/path'),'http://localhost:3000/path');
  for(const url of ['javascript:alert(1)','data:text/html,hello','file:///etc/passwd','https://user:password@example.com',''])assert.throws(()=>normalizeUrl(url));
});

test('时钟根据合成底板后的亮度选择黑白最强对比，设置可备份且旧数据有默认值',()=>{
  const {bestClockColor}=globalThis.QiPageCore;
  assert.equal(bestClockColor('#ffffff'),'#000000');assert.equal(bestClockColor('#000000'),'#ffffff');
  assert.equal(bestClockColor('#ffffff','#000000',60),'#ffffff');assert.equal(bestClockColor('#000000','#ffffff',60),'#000000');
  const state=createDefaults();Object.assign(state,{clockColorMode:'manual',clockColor:'#dabcef',clockBackgroundColor:'#123456',clockBackgroundOpacity:22.5,clockBackdropColor:'#cccccc'});
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))),state);
  for(const key of ['clockColorMode','clockColor','clockBackgroundColor','clockBackgroundOpacity','clockBackdropColor'])delete state[key];
  let restored=validateBackup(state);assert.equal(restored.clockColorMode,'auto');assert.equal(restored.clockBackgroundOpacity,14);
  Object.assign(state,{clockColorMode:'bad',clockColor:'url(evil)',clockBackgroundColor:'#123',clockBackgroundOpacity:101,clockBackdropColor:'red'});
  restored=validateBackup(state);assert.equal(restored.clockColor,'#ffffff');assert.equal(restored.clockBackgroundColor,'#000000');assert.equal(restored.clockBackgroundOpacity,14);
});

test('壁纸主色忽略透明和极亮暗像素，按主要色块取色，主题调色板保持文字对比',()=>{
  const {extractThemeColor,themePalette}=globalThis.QiPageCore;
  const pixels=new Uint8ClampedArray([210,60,80,255,212,62,82,255,20,180,40,255,0,0,0,255,255,255,255,255,0,255,0,0]);
  assert.equal(extractThemeColor(pixels),'#d33d51');assert.equal(extractThemeColor(new Uint8ClampedArray(8)),null);
  assert.equal(extractThemeColor(new Uint8ClampedArray([0,0,0,255])),'#657387');
  const luminance=hex=>{
    const c=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return c[0]*.2126+c[1]*.7152+c[2]*.0722;
  };
  for(const color of ['#ffffff','#000000','#ff0000','#0000ff','#00ff00'])for(const light of [true,false]){
    const palette=themePalette(color,light),a=luminance(palette.text),b=luminance(palette.dialog);
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>4.5);
    assert.match(palette.iconBackground,/^#[a-f\d]{6}$/);assert.notEqual(palette.iconBackground,palette.iconInk);
    const background=luminance(palette.iconBackground),ink=luminance(palette.iconInk);
    assert.ok((background+.05)/(ink+.05)>4.5);
  }
  assert.throws(()=>themePalette('url(evil)'));
});

test('主题色模式和颜色随备份保留，旧设置和无效颜色补齐默认值',()=>{
  const state=createDefaults();Object.assign(state,{themeColorMode:'wallpaper',themeColor:'#8966a6',wallpaperThemeColor:'#b56c83'});
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))),state);
  for(const key of ['themeColorMode','themeColor','wallpaperThemeColor'])delete state[key];
  let restored=validateBackup(state);assert.equal(restored.themeColorMode,'manual');assert.equal(restored.themeColor,'#3b6957');
  Object.assign(state,{themeColorMode:'invalid',themeColor:'red;background:url(evil)',wallpaperThemeColor:'#123'});
  restored=validateBackup(state);assert.equal(restored.themeColorMode,'manual');assert.equal(restored.themeColor,'#3b6957');assert.equal(restored.wallpaperThemeColor,'#55796d');
});

test('所有主题表面在不同明暗和底色强度下都配对黑白高对比文字',()=>{
  const {themePalette}=globalThis.QiPageCore;
  const luminance=hex=>{
    const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return c[0]*.2126+c[1]*.7152+c[2]*.0722;
  };
  for(const color of ['#ffffff','#000000','#ff0000','#00ff00','#0000ff','#8966a6','#b56c83','#777777'])for(const light of [true,false])for(const strength of [15,64,95]){
    const p=themePalette(color,light,strength);
    for(const background of [p.surface,p.dialog,p.control]){
      const a=luminance(background),b=luminance(p.accent);
      assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`强调色 ${color} ${light} ${strength}`);
    }
    for(const [background,foreground]of [[p.surface,p.text],[p.dialog,p.dialogText],[p.control,p.controlText],[p.search,p.searchText],[p.accent,p.primaryText],[p.iconBackground,p.iconText]]){
      assert.ok(['#000000','#ffffff'].includes(foreground));
      const a=luminance(background),b=luminance(foreground);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${color} ${light} ${strength} ${background}/${foreground}`);
    }
  }
});

test('网站图标偏好与缓存支持备份往返，拒绝跨站图标地址和危险协议',()=>{
  const state=createDefaults(),bookmark=state.bookmarks[0];
  Object.assign(bookmark,{websiteIcon:true,siteIconUrl:'https://github.com/assets/icon.png',icon:'data:image/png;base64,QUJD',iconMask:'data:image/png;base64,REVG'});
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))),state);
  for(const value of ['https://other.example/icon.png','javascript:alert(1)','https://user:pass@github.com/icon.png']){
    bookmark.siteIconUrl=value;assert.throws(()=>validateBackup(state));
  }
  bookmark.siteIconUrl='https://github.com/favicon.ico';bookmark.websiteIcon='true';assert.throws(()=>validateBackup(state));
});
test('搜索快捷指令、中文转义和网址直达',()=>{
  assert.equal(searchTarget('gh 栖页','bing'),'https://github.com/search?q=%E6%A0%96%E9%A1%B5');
  assert.equal(searchTarget('tb 机械键盘','google'),'https://s.taobao.com/search?q=%E6%9C%BA%E6%A2%B0%E9%94%AE%E7%9B%98');
  assert.equal(searchTarget('翻译 & 你好','bing'),'https://www.bing.com/search?q=%E7%BF%BB%E8%AF%91%20%26%20%E4%BD%A0%E5%A5%BD');
  assert.equal(searchTarget('github.com/openai','google'),'https://github.com/openai');
  assert.equal(searchTarget('https://example.com:8080','google'),'https://example.com:8080/');
  assert.equal(searchTarget('   ','google'),null);
  assert.match(searchTarget('javascript:alert(1)','google'),/^https:\/\/www.google.com\/search\?q=/);
});
test('备份完整往返且不保留未知字段',()=>{
  const original=createDefaults();original.notes='我的便签\n新的一行';original.todos=[{id:'task',text:'测试待办',done:true}];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify({...original,unknown:'ignored'}))),original);
});
test('导入拒绝无效版本、重复编号、悬空分组及恶意网址或图标',()=>{
  const mutations=[s=>s.version=99,s=>s.groups=[],s=>s.groups.push(s.groups[0]),s=>s.bookmarks[0].group='missing',s=>s.bookmarks[0].url='javascript:alert(1)',s=>s.bookmarks[0].icon='https://tracking.example/image.png',s=>s.bookmarks.push(s.bookmarks[0]),s=>s.todos=[{id:'x',text:'a',done:'false'}],s=>s.notes='x'.repeat(12001)];
  for(const mutate of mutations){const s=createDefaults();mutate(s);assert.throws(()=>validateBackup(s));}
});
test('导入不安全设置回退默认值，地理坐标保留合法值',()=>{
  const s=createDefaults();s.opacity=200;s.theme='invalid';s.location={name:'bad',latitude:1000,longitude:0};s.timer={minutes:25,remaining:1500,deadline:'not-time'};
  const restored=validateBackup(s);assert.equal(restored.opacity,64);assert.equal(restored.theme,'dark');assert.equal(restored.location.name,'新加坡');assert.equal(restored.timer.deadline,null);
});
test('计时基于绝对时间，后台和重新加载不会延长计时',()=>{
  assert.equal(secondsLeft({remaining:1200,deadline:25000},10000),15);
  assert.equal(secondsLeft({remaining:1200,deadline:25000},30000),0);
  assert.equal(secondsLeft({remaining:45,deadline:null},90000),45);
  assert.equal(secondsLeft({remaining:1,deadline:10500},10001),1);
});

test('Dock 文件夹和排序备份往返，旧备份补默认，拒绝重复归属和无效引用',()=>{
  const state=createDefaults(),ids=state.bookmarks.map(b=>b.id);
  state.dockFolders=[{id:'folder-1',name:'工作',bookmarkIds:ids.slice(0,5)},{id:'folder-2',name:'空文件夹',bookmarkIds:[]}];
  state.dockOrder=[ids[6],'folder-1','folder-2',ids[5]];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))),state);
  const legacy=createDefaults();delete legacy.dockFolders;delete legacy.dockOrder;
  assert.deepEqual(validateBackup(legacy).dockFolders,[]);assert.deepEqual(validateBackup(legacy).dockOrder,[]);
  for(const mutate of [
    s=>s.dockFolders.push(s.dockFolders[0]),
    s=>s.dockFolders[0].id=ids[0],
    s=>s.dockFolders[0].bookmarkIds.push(ids[0]),
    s=>s.dockFolders[1].bookmarkIds.push(ids[0]),
    s=>s.dockFolders[0].bookmarkIds.push('missing'),
    s=>s.dockFolders[0].bookmarkIds.push('folder-2'),
    s=>s.dockOrder.push('folder-1'),
    s=>s.dockOrder.push(ids[0]),
    s=>s.dockOrder.push('missing'),
    s=>s.dockFolders[0].name=' ',
  ]){const invalid=JSON.parse(JSON.stringify(state));mutate(invalid);assert.throws(()=>validateBackup(invalid));}
});
test('天气代码映射',()=>{assert.deepEqual(weatherLabel(0),['晴朗','sun']);assert.deepEqual(weatherLabel(95),['雷雨','storm']);assert.deepEqual(weatherLabel(71),['降雪','snow']);});

test('位置精度归一化覆盖负数、边界和无效输入；联网开关只接受布尔值',()=>{
  const {coarseLocation}=globalThis.QiPageCore;
  assert.deepEqual(coarseLocation({name:'边界',latitude:-90,longitude:180}),{name:'边界',latitude:-90,longitude:180});
  assert.deepEqual(coarseLocation({name:'测试',latitude:-0.0123,longitude:103.8567}),{name:'测试',latitude:0,longitude:103.9});
  for(const latitude of [NaN,Infinity,91,'31.2'])assert.throws(()=>coarseLocation({name:'无效',latitude,longitude:0}));
  const raw=createDefaults();raw.weatherEnabled='true';assert.equal(validateBackup(raw).weatherEnabled,false);
});

test('生产脚本可按普通脚本解析，入口引用的本地资源均存在',()=>{
  for(const name of ['core.js','engine-icons.js','chrome-extension/bookmark-tree.js','app.js','layout.js'])new Script(readFileSync(new URL(`../${name}`,import.meta.url),'utf8'),{filename:name});
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/<script[^>]*type=["']module["']/i);
  const scripts=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(scripts,['core.js','engine-icons.js','chrome-extension/bookmark-tree.js','app.js','layout.js']);
  for(const [,resource] of html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|svg))"/g))assert.ok(existsSync(new URL(`../${resource}`,import.meta.url)),resource);
});

test('没有 randomUUID 时也能在普通脚本环境生成唯一的标准 UUID',()=>{
  const context=createContext({crypto:{getRandomValues:array=>webcrypto.getRandomValues(array)},URL});
  new Script(readFileSync(new URL('../core.js',import.meta.url),'utf8')).runInContext(context);
  const ids=Array.from({length:100},()=>context.QiPageCore.uid());
  assert.equal(new Set(ids).size,100);
  ids.forEach(id=>assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  assert.equal(context.QiPageCore.createDefaults().bookmarks.length,12);
});

test('18 个内置引擎配置有效，默认配置之间互不共享可变数据',()=>{
  assert.equal(ENGINES.length,18);assert.equal(validateEngines(ENGINES).length,18);
  const a=createDefaults(),b=createDefaults();a.engines[0].name='我的谷歌';a.engines.reverse();
  assert.equal(b.engines[0].name,'Google');assert.equal(ENGINES[0].name,'Google');
});

test('自定义引擎支持路径及参数模板，中文和特殊字符只编码一次',()=>{
  const engines=validateEngines([{id:'custom-test',name:'自定义',symbol:'🔍',key:'ZZ',url:'https://example.com/find/{query}?mode=all',pinned:true}]);
  assert.equal(engines[0].key,'zz');
  assert.equal(searchTarget('zz 中文 & a/b','missing',engines),'https://example.com/find/%E4%B8%AD%E6%96%87%20%26%20a%2Fb?mode=all');
  assert.equal(searchTarget('关键词','custom-test',engines),'https://example.com/find/%E5%85%B3%E9%94%AE%E8%AF%8D?mode=all');
  assert.equal(searchTarget('example.com','custom-test',engines),'https://example.com/');
});

test('编辑、删除后的引擎与快捷指令以当前配置为准',()=>{
  const engines=validateEngines([{...ENGINES[0],key:'web',url:'https://example.com/?q={query}'},ENGINES[1]]);
  assert.equal(searchTarget('web test','bing',engines),'https://example.com/?q=test');
  assert.equal(searchTarget('gh test','google',engines),'https://example.com/?q=gh%20test');
  assert.equal(searchTarget('test','deleted',engines),'https://example.com/?q=test');
  assert.equal(searchTarget('test','deleted',[]),null);
});

test('旧版备份补齐内置引擎，保留原选中引擎及其他数据',()=>{
  const old=createDefaults();delete old.engines;old.engine='taobao';old.notes='保留便签';
  const restored=validateBackup(old);assert.equal(restored.engines.length,18);assert.equal(restored.engine,'taobao');assert.equal(restored.notes,'保留便签');
});

test('备份保留自定义名称、模板、顺序、快捷栏和选中引擎',()=>{
  const s=createDefaults();s.engines=validateEngines([{id:'custom',name:'测试引擎',symbol:'测',key:'cs',url:'https://example.com/?q={query}&lang=zh',pinned:false},ENGINES[1]]);s.engine='custom';
  const restored=validateBackup(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,s);
  s.engine='deleted';assert.equal(validateBackup(s).engine,'custom');
});

test('引擎配置拒绝重复快捷指令、危险协议、错误模板和无效列表',()=>{
  const engine={...ENGINES[0]};
  for(const url of ['javascript:alert({query})','data:text/html,{query}','file:///{query}','https://user:pass@example.com/?q={query}','https://example.com/search','https://example.com/?a={query}&b={query}','https://{query}.example.com/','example.com/?q={query}'])assert.throws(()=>validateEngines([{...engine,url}]));
  for(const key of ['a b','1a','abcdefghi','<x>'])assert.throws(()=>validateEngines([{...engine,key}]));
  assert.throws(()=>validateEngines([{...engine}, {...ENGINES[1],key:'G'}]));
  assert.throws(()=>validateEngines([{...engine}, {...engine}]));
  for(const value of [[],null,{},Array.from({length:65},()=>engine)])assert.throws(()=>validateEngines(value));
  assert.equal(validateEngines([{...engine,key:''}])[0].key,'');
  const backup=createDefaults();backup.engines=[];assert.throws(()=>validateBackup(backup));
});

test('全部内置图标有本地矢量资源，图标配置不能注入 URL 或 HTML',()=>{
  for(const id of ENGINE_ICON_IDS.filter(id=>id!=='symbol')){
    const svg=readFileSync(new URL(`../assets/engines/${id}.svg`,import.meta.url),'utf8');
    assert.match(svg,/viewBox="0 0 32 32"/);assert.match(svg,/<path|<circle/);assert.doesNotMatch(svg,/<script|<text|<foreignObject|https?:\/\/(?!www.w3.org)/i);
  }
  for(const icon of ['javascript:alert(1)','https://example.com/x.svg','<img>','unknown'])assert.throws(()=>validateEngines([{...ENGINES[0],icon}]));
});

test('旧内置引擎迁移到图形图标，自定义字符标识保留，图标可随备份恢复',()=>{
  const original={...ENGINES[0]};delete original.icon;
  assert.equal(validateEngines([original])[0].icon,'google');
  assert.equal(validateEngines([{...original,symbol:'🌿'}])[0].icon,'symbol');
  const s=createDefaults();s.engines[0].icon='globe';assert.equal(validateBackup(JSON.parse(JSON.stringify(s))).engines[0].icon,'globe');
});

test('所有默认快捷方式及新网址都解析为本地图形，未知网站不回退到 favicon',()=>{
  const defaults=createDefaults();
  for(const bookmark of defaults.bookmarks)assert.ok(BOOKMARK_ICON_IDS.includes(resolveBookmarkIcon(bookmark)));
  assert.equal(resolveBookmarkIcon({url:'https://mail.google.com'}),'mail');
  assert.equal(resolveBookmarkIcon({url:'https://figma.com'}),'design');
  assert.equal(resolveBookmarkIcon({url:'https://unknown.example'}),'globe');
  assert.equal(resolveBookmarkIcon({url:'https://constructor'}),'globe');
  assert.equal(resolveBookmarkIcon({url:'https://unknown.example',glyph:'code'}),'code');
  for(const id of BOOKMARK_ICON_IDS)assert.ok(existsSync(new URL(`../assets/engines/${id}.svg`,import.meta.url)));
});

test('不透明彩色图片提取背景外的轮廓，输出白色 alpha 蒙版',()=>{
  const pixels=new Uint8ClampedArray(8*8*4).fill(255);
  for(let y=2;y<6;y++)for(let x=2;x<6;x++){const at=(y*8+x)*4;pixels[at]=240;pixels[at+1]=40;pixels[at+2]=20;}
  const mask=buildMonochromeMask(pixels,8,8);
  assert.deepEqual(mask.bounds,{x:2,y:2,width:4,height:4});assert.equal(mask.pixels[3],0);
  const at=(3*8+3)*4;assert.deepEqual([...mask.pixels.slice(at,at+4)],[255,255,255,255]);
  assert.equal(buildMonochromeMask(new Uint8ClampedArray(8*8*4).fill(255),8,8).bounds,null);
});

test('透明上传图案保留 alpha 轮廓，空图与错误像素输入妥善处理',()=>{
  const pixels=new Uint8ClampedArray(8*8*4);
  for(let y=2;y<6;y++)for(let x=2;x<6;x++){const at=(y*8+x)*4;pixels[at+1]=220;pixels[at+3]=255;}
  const mask=buildMonochromeMask(pixels,8,8,true);assert.deepEqual(mask.bounds,{x:2,y:2,width:4,height:4});
  assert.equal(mask.pixels[(3*8+3)*4+3],255);assert.equal(mask.pixels[3],0);
  assert.equal(buildMonochromeMask(new Uint8ClampedArray(16),2,2).bounds,null);
  assert.throws(()=>buildMonochromeMask(pixels,4,4));
});

test('快捷方式原图、统一蒙版和所选图形随备份保留，拒绝外部蒙版或未知图形',()=>{
  const state=createDefaults();state.bookmarks[0].icon='data:image/png;base64,AAAA';state.bookmarks[0].iconMask='data:image/png;base64,BBBB';state.bookmarks[0].glyph='code';
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))),state);
  state.bookmarks[0].iconMask='https://example.com/x.png';assert.throws(()=>validateBackup(state));
  delete state.bookmarks[0].iconMask;state.bookmarks[0].glyph='javascript:alert(1)';assert.throws(()=>validateBackup(state));
});

test('Dock 名称显示偏好随备份恢复，旧配置默认关闭',()=>{
  const state=createDefaults();delete state.dockShowNames;assert.equal(validateBackup(state).dockShowNames,false);
  state.dockShowNames=true;assert.equal(validateBackup(JSON.parse(JSON.stringify(state))).dockShowNames,true);
  state.dockShowNames='true';assert.equal(validateBackup(state).dockShowNames,false);
});

test('Dock 新偏好备份往返，旧配置补默认，非法尺寸和位置回退',()=>{
  const defaults=globalThis.QiPageCore.DOCK_DEFAULTS,state=createDefaults();
  Object.assign(state,{dockPosition:'custom',dockX:8,dockY:90,dockMovable:true,dockGap:24,dockSize:60,dockScale:2.1,dockRadius:200,dockSpeed:350,dockWidth:1100,dockOpacity:75,dockTooltip:false,dockZoom:false});
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))),state);
  for(const key of Object.keys(defaults))delete state[key];
  const restored=validateBackup(state);for(const [key,value]of Object.entries(defaults))assert.equal(restored[key],value);
  Object.assign(state,{dockSize:1000,dockGap:-5,dockScale:Infinity,dockX:101,dockY:-1,dockWidth:'800',dockPosition:'url(evil)',dockTooltip:'false'});
  const validated=validateBackup(state);for(const key of Object.keys(defaults))assert.equal(validated[key],defaults[key]);
});
