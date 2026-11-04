import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=['core.js','engine-icons.js','chrome-extension/bookmark-tree.js','app.js','layout.js'].map(name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8'));
function setup(t,{clipboardDenied=false,now=null,saved=null,media=null}={}) {
  const dom=new JSDOM(html,{url:'https://qipage.test/',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,frames=new Map(),opened=[],errors=[],copied=[];
  let nextFrame=0,currentTime=now;
  if(now!==null){const RealDate=w.Date;w.Date=class extends RealDate{constructor(...args){if(args.length)super(...args);else super(currentTime);}static now(){return currentTime;}};}
  w.addEventListener('error',e=>errors.push(e.error));
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.load=()=>{};
  w.requestAnimationFrame=callback=>{frames.set(++nextFrame,callback);return nextFrame;};
  w.cancelAnimationFrame=id=>frames.delete(id);
  const flushFrames=()=>{const batch=[...frames.values()];frames.clear();batch.forEach(frame=>frame());};
  w.fetch=async()=>{throw new Error('Network disabled during DOM tests');};
  w.structuredClone=structuredClone;
  if(media){
    let objectId=0;w.URL.createObjectURL=()=>`blob:wallpaper-test-${++objectId}`;w.URL.revokeObjectURL=()=>{};
    w.indexedDB={open(){
      const request={};w.queueMicrotask(()=>{
        request.result={transaction(){
          const transaction={objectStore(){
            const action=(type,value)=>{
              const operation={};w.queueMicrotask(()=>{if(type==='put')media.file=value;operation.result=media.file;operation.onsuccess?.();w.queueMicrotask(()=>transaction.oncomplete?.());});return operation;
            };
            return {get:()=>action('get'),put:value=>action('put',value)};
          }};return transaction;
        }};request.onsuccess?.();
      });return request;
    }};
  }
  w.open=(...args)=>opened.push(args);
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');this.querySelector('button,input,textarea')?.focus();};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{copied.push(value);},readText:async()=>{if(clipboardDenied)throw new Error('Not allowed');return '粘贴内容';}}});
  if(saved)w.localStorage.setItem('qipage.v1',saved);
  scripts.forEach(source=>w.eval(source));
  flushFrames();
  t.after(()=>assert.deepEqual(errors,[],'Application must not throw during DOM interaction'));
  const $=selector=>d.querySelector(selector);
  $('#search-form').requestSubmit=()=>$('#search-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  function rightClick(target){const event=new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:120,clientY:100});target.dispatchEvent(event);assert.equal(event.defaultPrevented,true);return [...$('#context-menu').querySelectorAll('button')].map(button=>button.querySelector('span').textContent);}
  function menuClick(label){const button=[...$('#context-menu').querySelectorAll('button')].find(button=>button.querySelector('span').textContent===label);assert.ok(button,`Menu item: ${label}`);button.click();}
  const input=(target,value)=>{target.value=value;target.dispatchEvent(new w.Event('input',{bubbles:true}));};
  const key=(key,options={})=>d.dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options}));
  return {w,d,$,opened,copied,rightClick,menuClick,input,key,tick:milliseconds=>{currentTime+=milliseconds;flushFrames();}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('右键菜单鼠标移动与键盘导航共用一个焦点',t=>{
  const {w,d,$,rightClick,key}=setup(t);rightClick($('#bookmarks'));
  const buttons=[...$('#context-menu').querySelectorAll('button')];
  assert.equal(d.activeElement,buttons[0]);
  buttons[1].dispatchEvent(new w.Event('pointermove',{bubbles:true}));
  assert.equal(d.activeElement,buttons[1]);key('ArrowDown');
  assert.equal(d.activeElement,buttons[2]);
});

test('主 Dock 左键长按进入抖动编辑，松手不会打开网址，提前移动取消',async t=>{
  const {w,d,$,opened}=setup(t),anchor=$('#bookmarks [data-dock-id]');
  const pointer=(target,type,x=10)=>{const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:10});Object.defineProperty(event,'pointerId',{value:7});target.dispatchEvent(event);};
  pointer(anchor,'pointerdown');pointer(d,'pointermove',30);await new Promise(resolve=>setTimeout(resolve,480));
  assert.equal(d.body.classList.contains('dock-editing'),false);
  pointer(anchor,'pointerdown');await new Promise(resolve=>setTimeout(resolve,480));
  assert.equal(d.body.classList.contains('dock-editing'),true);assert.equal($('#dock-edit-toolbar').hidden,false);
  pointer(d,'pointerup');$('#bookmarks [data-dock-id]').click();assert.equal(opened.length,0);
  $('#dock-edit-done').click();assert.equal(d.body.classList.contains('dock-editing'),false);
});

test('Dock 微小滚动保留位移，停止后吸附最近格子',async t=>{
  const {w,$}=setup(t),grid=$('#bookmarks');
  Object.defineProperty(grid,'scrollWidth',{value:300});Object.defineProperty(grid,'clientWidth',{value:300});
  const first=grid.firstElementChild;
  grid.dispatchEvent(new w.WheelEvent('wheel',{deltaY:8,bubbles:true,cancelable:true}));
  assert.equal(first.style.translate,'-8px 0');
  await new Promise(resolve=>setTimeout(resolve,230));
  assert.equal(first.style.translate,'0px 0');assert.equal(grid.firstElementChild,first);
});

test('Dock 溢出显示省略按钮，滚轮双向循环且不改变顺序',t=>{
  const {w,d,$}=setup(t),grid=$('#bookmarks');let width=900;
  Object.defineProperty(grid,'scrollWidth',{get:()=>width});Object.defineProperty(grid,'clientWidth',{value:300});
  const order=[...grid.querySelectorAll('[data-dock-id]')].map(el=>el.dataset.dockId);
  w.dispatchEvent(new w.Event('resize'));
  assert.ok([...d.querySelectorAll('.dock-overflow')].every(button=>!button.hidden));
  const wheel=(delta,extra={})=>{const event=new w.WheelEvent('wheel',{deltaY:delta,bubbles:true,cancelable:true,...extra});grid.dispatchEvent(event);return event;};
  assert.ok(wheel(100).defaultPrevented);assert.equal(grid.scrollLeft,100);
  grid.scrollLeft=600;wheel(30);assert.equal(grid.scrollLeft,0);
  wheel(-30);assert.equal(grid.scrollLeft,600);
  grid.scrollLeft=0;wheel(2,{deltaMode:1});assert.equal(grid.scrollLeft,32);
  assert.equal(wheel(100,{ctrlKey:true}).defaultPrevented,false);assert.equal(grid.scrollLeft,32);
  grid.scrollLeft=600;$('.dock-overflow-right').click();assert.equal(grid.scrollLeft,0);
  $('.dock-overflow-left').click();assert.equal(grid.scrollLeft,600);
  assert.deepEqual([...grid.querySelectorAll('[data-dock-id]')].map(el=>el.dataset.dockId),order);
  width=300;w.dispatchEvent(new w.Event('resize'));
  assert.ok([...d.querySelectorAll('.dock-overflow')].every(button=>button.hidden));
  const saved=w.localStorage.getItem('qipage.v1');
  assert.equal(wheel(100).defaultPrevented,true);
  assert.deepEqual([...grid.querySelectorAll('[data-dock-id]')].map(el=>el.dataset.dockId),[...order.slice(1),order[0]]);
  wheel(-100);assert.deepEqual([...grid.querySelectorAll('[data-dock-id]')].map(el=>el.dataset.dockId),order);
  assert.equal(grid.lastElementChild.classList.contains('bookmark-add-item'),true);
  assert.equal(w.localStorage.getItem('qipage.v1'),saved);
  width=900;w.QiPageLayout.setMode('expanded');assert.ok([...d.querySelectorAll('.dock-overflow')].every(button=>button.hidden));assert.equal(wheel(100).defaultPrevented,false);
});

test('右键删除整个嵌套文件夹，取消保留，确认删除子树并可撤回且保留便签修改',t=>{
  const initial=setup(t),state=initial.w.QiPageCore.createDefaults();
  const ids=state.bookmarks.slice(0,3).map(item=>item.id);
  state.dockFolders=[{id:'root-folder',name:'根目录',bookmarkIds:[ids[0]]},{id:'child-folder',name:'子目录',parentId:'root-folder',bookmarkIds:[ids[1]]},{id:'grandchild-folder',name:'孙目录',parentId:'child-folder',bookmarkIds:[ids[2]]}];
  state.dockOrder=['root-folder',...state.bookmarks.slice(3).map(item=>item.id)];
  const env=setup(t,{saved:JSON.stringify(state)}),{w,$,rightClick,menuClick}=env;
  rightClick($('#bookmarks [data-folder-id]'));menuClick('删除文件夹及内容');
  $('#confirm-dialog .close-dialog').click();assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.length,12);
  rightClick($('#bookmarks [data-folder-id]'));menuClick('删除文件夹及内容');$('#confirm-action').click();
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.bookmarks.length,9);assert.equal(saved.dockFolders.length,0);
  assert.ok($('#toast .toast-undo'));$('#notes').value='删除后编辑的便签';$('#notes').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('#toast .toast-undo').click();saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.notes,'删除后编辑的便签');assert.deepEqual(saved.dockFolders,JSON.parse(JSON.stringify(state.dockFolders)));
  assert.deepEqual(saved.dockOrder,JSON.parse(JSON.stringify(state.dockOrder)));assert.equal(saved.bookmarks.length,12);assert.doesNotThrow(()=>w.QiPageCore.validateBackup(saved));
});

test('删除分组及网址清理关联空文件夹，可撤回；仅删分组时保留网址',t=>{
  const env=setup(t),{w,$}=env;
  const urls=new Set(w.QiPageCore.createDefaults().bookmarks.filter(item=>item.group==='work').map(item=>item.url));createDockFolder(env,'工作网址',[...$('#bookmarks').querySelectorAll('[data-bookmark-id]')].filter(item=>urls.has(item.href)).map(item=>item.dataset.bookmarkId));
  w.QiPageLayout.setMode('expanded');$('#manage-bookmarks').click();$('#group-tabs [data-group="work"]').click();
  const before=JSON.parse(w.localStorage.getItem('qipage.v1')),count=before.bookmarks.filter(item=>item.group==='work').length;
  $('#delete-group').click();assert.ok($('#group-delete-dialog').open);$('#group-delete-dialog .close-dialog').click();
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).groups.length,3);
  $('#delete-group').click();$('#group-delete-all').click();
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.groups.length,2);assert.equal(saved.bookmarks.length,12-count);assert.equal(saved.dockFolders.length,0);
  $('#toast .toast-undo').click();saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.deepEqual(saved.bookmarks,before.bookmarks);assert.deepEqual(saved.groups,before.groups);assert.deepEqual(saved.dockFolders,before.dockFolders);
  $('#delete-group').click();$('#group-delete-keep').click();saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.bookmarks.length,12);assert.equal(saved.groups.length,2);assert.equal(saved.bookmarks.some(item=>item.group==='work'),false);
  $('#toast .toast-undo').click();assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).groups.length,3);
});

test('撤回删除不会覆盖之后新增的网址',async t=>{
  const env=setup(t),{w,$,rightClick,menuClick}=env;
  const id=createDockFolder(env,'待删除');rightClick($(`[data-folder-id="${id}"]`));menuClick('删除文件夹及内容');$('#confirm-action').click();
  const undo=$('#toast .toast-undo');
  $('#add-bookmark').click();$('#bookmark-name').value='新网址';$('#bookmark-url').value='https://after-delete.example';
  // Saving another bookmark replaces the notice; the stale callback must also refuse restoration.
  await $('#bookmark-form').onsubmit({preventDefault(){},currentTarget:$('#bookmark-form')});
  undo.click();assert.match($('#toast').textContent,/无法撤回/);
  const saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.bookmarks.length,13);assert.equal(saved.dockFolders.length,0);
});

for(const mode of ['minimal','expanded'])test(`${mode}：嵌套书签可按目录选择导入、逐层打开、返回并解散而不丢失网址`,async t=>{
  const {w,d,$}=setup(t);
  w.QiPageLayout.setMode(mode);
  const data={format:'qipage.browser-bookmarks',version:1,bookmarks:[
    {title:'A',url:'https://nested-a.example',path:['书签栏','工作','工具']},
    {title:'B',url:'https://nested-b.example',path:['书签栏','工作']},
    {title:'C',url:'https://nested-c.example',path:['书签栏','生活']}
  ]};
  Object.defineProperty($('#browser-bookmarks-file'),'files',{value:[{size:500,text:async()=>JSON.stringify(data)}]});
  await $('#browser-bookmarks-file').onchange({target:$('#browser-bookmarks-file')});
  $('#browser-bookmarks-clear').click();
  const work=[...d.querySelectorAll('#browser-bookmarks-list summary')].find(item=>item.textContent.includes('工作'));
  work.querySelector('input').click();
  assert.equal($('#browser-bookmarks-list summary input').indeterminate,true);
  $('#browser-bookmarks-confirm').click();
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.bookmarks.length,14);assert.equal(saved.dockFolders.length,3);
  assert.equal(d.querySelectorAll('#bookmarks [data-folder-id]').length,1);
  $('#bookmarks [data-folder-id]').click();assert.equal($('#dock-folder-title').textContent,'书签栏');
  $('#dock-folder-items [data-folder-open]').click();assert.equal($('#dock-folder-title').textContent,'工作');
  assert.equal($('#dock-folder-items').querySelectorAll('a').length,1);
  $('#dock-folder-items [data-folder-open]').click();assert.equal($('#dock-folder-title').textContent,'工具');
  assert.equal($('#dock-folder-items a').textContent,'A');
  $('#dock-folder-breadcrumbs button').click();assert.equal($('#dock-folder-title').textContent,'书签栏');
  $('#dock-folder-items [data-folder-open]').click();
  $('#dock-folder-organize').click();$('#dock-folder-dissolve').click();$('#confirm-action').click();
  saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.bookmarks.length,14);assert.equal(saved.dockFolders.length,2);
  assert.equal(saved.dockFolders[1].parentId,saved.dockFolders[0].id);
  assert.equal(saved.dockFolders[0].bookmarkIds.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(w.QiPageCore.validateBackup(saved))),saved);
  const reloaded=setup(t,{saved:JSON.stringify(saved)});reloaded.$('#bookmarks [data-folder-id]').click();
  assert.equal(reloaded.$('#dock-folder-items').querySelectorAll('a').length,1);
  reloaded.$('#dock-folder-items [data-folder-open]').click();assert.equal(reloaded.$('#dock-folder-title').textContent,'工具');
});

test('完整模式按分组筛选文件夹子树，切换布局和刷新保留层级',t=>{
  const initial=setup(t),state=initial.w.QiPageCore.createDefaults();
  const work=state.bookmarks.find(b=>b.group==='work'),other=state.bookmarks.find(b=>b.group!=='work');
  state.dockFolders=[
    {id:'root',name:'书签栏',bookmarkIds:[other.id]},
    {id:'work-child',name:'工作目录',parentId:'root',bookmarkIds:[work.id]},
    {id:'other-child',name:'其他目录',parentId:'root',bookmarkIds:[state.bookmarks.find(b=>b.group===other.group&&b.id!==other.id).id]}
  ];
  const {w,d,$}=setup(t,{saved:JSON.stringify(state)});
  w.QiPageLayout.setMode('expanded');$('#group-tabs [data-group="work"]').click();
  assert.equal(d.querySelectorAll('#bookmarks [data-folder-id]').length,1);
  assert.equal($(`#bookmarks [data-bookmark-id="${work.id}"]`),null);
  assert.equal($('#bookmarks [data-folder-id]').title,'书签栏');
  $('#bookmarks [data-folder-id]').click();
  assert.equal(d.querySelectorAll('#dock-folder-items [data-folder-open]').length,1);
  assert.equal($('#dock-folder-items a'),null);
  $('#dock-folder-items [data-folder-open]').click();
  assert.equal($('#dock-folder-items a').dataset.bookmarkId,work.id);
  $('#dock-folder-dialog .close-dialog').click();
  $('#group-tabs [data-group="all"]').click();$('#bookmarks [data-folder-id]').click();
  assert.equal(d.querySelectorAll('#dock-folder-items [data-folder-open]').length,2);
  assert.equal($('#dock-folder-items a').dataset.bookmarkId,other.id);
  $('#dock-folder-dialog .close-dialog').click();
  w.QiPageLayout.setMode('minimal');w.QiPageLayout.setMode('expanded');
  assert.equal(d.querySelectorAll('#bookmarks [data-folder-id]').length,1);
  const reloaded=setup(t,{saved:w.localStorage.getItem('qipage.v1')});reloaded.w.QiPageLayout.setMode('expanded');
  assert.equal(reloaded.d.querySelectorAll('#bookmarks [data-folder-id]').length,1);
});

test('极简 Dock 右键与编辑工具栏可直接导入层级书签',async t=>{
  const {w,d,$,rightClick,menuClick}=setup(t);let picks=0;
  $('#browser-bookmarks-file').click=()=>picks++;
  rightClick($('#bookmarks'));menuClick('导入浏览器书签');assert.equal(picks,1);
  rightClick($('#bookmarks'));menuClick('编辑模式');
  assert.equal($('#dock-edit-toolbar').hidden,false);$('#dock-import-bookmarks').click();assert.equal(picks,2);
  assert.equal(d.body.dataset.view,'minimal');
  const data={format:'qipage.browser-bookmarks',version:1,bookmarks:[{title:'入口测试',url:'https://dock-import.example',path:['书签栏','工具']}]};
  Object.defineProperty($('#browser-bookmarks-file'),'files',{value:[{size:500,text:async()=>JSON.stringify(data)}]});
  await $('#browser-bookmarks-file').onchange({target:$('#browser-bookmarks-file')});
  assert.ok($('#browser-bookmarks-dialog').open);assert.ok($('#browser-bookmarks-folders').checked);
  $('#browser-bookmarks-confirm').click();$('#dock-edit-done').click();
  $('#bookmarks [data-folder-id]').click();$('#dock-folder-items [data-folder-open]').click();
  assert.equal($('#dock-folder-items a').textContent,'入口测试');
  assert.equal(d.body.dataset.view,'minimal');
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).dockFolders.length,2);
});

test('浏览器书签先预览，取消不写入，确认追加并保留便签，重复导入不新增',async t=>{
  const {w,d,$}=setup(t);
  $('#notes').value='已有便签';$('#notes').dispatchEvent(new w.Event('input',{bubbles:true}));
  const file={size:500,text:async()=>JSON.stringify({format:'qipage.browser-bookmarks',version:1,bookmarks:[{title:'重复',url:'https://github.com/',path:['书签栏']},{title:'导入网站',url:'https://import.example/',path:['书签栏','工作']}]})};
  Object.defineProperty($('#browser-bookmarks-file'),'files',{value:[file],configurable:true});
  const before=w.localStorage.getItem('qipage.v1');await $('#browser-bookmarks-file').onchange({target:$('#browser-bookmarks-file')});
  assert.ok($('#browser-bookmarks-dialog').open);assert.equal(w.localStorage.getItem('qipage.v1'),before);
  assert.equal($('#browser-bookmarks-list').querySelectorAll('input[data-bookmark-index]:checked').length,1);
  $('#browser-bookmarks-dialog .close-dialog').click();assert.equal(w.localStorage.getItem('qipage.v1'),before);
  await $('#browser-bookmarks-file').onchange({target:$('#browser-bookmarks-file')});$('#browser-bookmarks-confirm').click();
  const saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.bookmarks.length,13);assert.equal(saved.notes,'已有便签');
  assert.deepEqual(saved.dockFolders[1].sourcePath,['书签栏','工作']);assert.ok($('#bookmarks [data-folder-id]'));
  await $('#browser-bookmarks-file').onchange({target:$('#browser-bookmarks-file')});assert.equal($('#browser-bookmarks-list').querySelectorAll('input:checked').length,0);assert.ok($('#browser-bookmarks-confirm').disabled);
  assert.equal(d.querySelectorAll('#browser-bookmarks-list img').length,0);
});

test('完整模式导航底色与文字一起随主题切换，面板不再继承旧绿色',t=>{
  const {w,d,$}=setup(t);w.QiPageLayout.setMode('expanded');$('#settings-open').click();
  $('#theme-color-picker').value='#8966a6';$('#theme-color-picker').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('#theme').value='light';$('#theme').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(d.body.style.getPropertyValue('--text'),'#000000');assert.equal(d.body.style.getPropertyValue('--theme-surface-text'),'#000000');
  const surface=d.body.style.getPropertyValue('--theme-surface');assert.equal(d.body.style.getPropertyValue('--panel'),surface);
  const rgb=[1,3,5].map(i=>parseInt(surface.slice(i,i+2),16));assert.ok(rgb[2]>rgb[0]&&rgb[0]>rgb[1],'紫色主题面板保持紫色系');
  $('#opacity').value='15';$('#opacity').dispatchEvent(new w.Event('input',{bubbles:true}));assert.notEqual(d.body.style.getPropertyValue('--theme-surface'),surface);assert.equal(d.body.style.getPropertyValue('--text'),'#000000');
  $('#theme').value='dark';$('#theme').dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(d.body.style.getPropertyValue('--text'),'#ffffff');assert.equal(d.body.style.getPropertyValue('--theme-dialog-text'),'#ffffff');assert.equal(d.body.style.getPropertyValue('--theme-search-text'),'#000000');
  const saved=w.localStorage.getItem('qipage.v1'),reloaded=setup(t,{saved});assert.equal(reloaded.d.body.style.getPropertyValue('--panel'),d.body.style.getPropertyValue('--panel'));
});

test('时钟有轻微底板，右键可快速选择黑白或打开颜色设置，修改后刷新保留',t=>{
  const {w,d,$,rightClick,menuClick}=setup(t);
  assert.ok($('.clock-surface #clock'));assert.equal(d.body.style.getPropertyValue('--clock-background-alpha'),'0.14');
  assert.deepEqual(rightClick($('#clock')),['时钟外观','自动高对比文字','白色文字','黑色文字']);
  menuClick('黑色文字');assert.equal(d.body.style.getPropertyValue('--clock-text-color'),'#000000');
  rightClick($('#date'));menuClick('白色文字');assert.equal(d.body.style.getPropertyValue('--clock-text-color'),'#ffffff');
  rightClick($('#clock'));menuClick('时钟外观');assert.ok($('#clock-settings-dialog').open);
  $('#clock-color').value='#d4b0ed';$('#clock-color').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('#clock-background-color').value='#102030';$('#clock-background-color').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('#clock-background-opacity-value').value='23.45';$('#clock-background-opacity-value').dispatchEvent(new w.Event('input',{bubbles:true}));$('#clock-background-opacity-value').dispatchEvent(new w.Event('blur'));
  assert.equal($('#clock-background-opacity-value').value,'23.45');assert.equal(d.body.style.getPropertyValue('--clock-background-alpha'),'0.2345');assert.equal(d.body.style.getPropertyValue('--clock-background-rgb'),'16 32 48');
  const saved=w.localStorage.getItem('qipage.v1'),reloaded=setup(t,{saved});assert.equal(reloaded.d.body.style.getPropertyValue('--clock-text-color'),'#d4b0ed');
  $('#clock-background-opacity').value='0';$('#clock-background-opacity').dispatchEvent(new w.Event('input',{bubbles:true}));assert.ok(d.body.classList.contains('clock-panel-off'));
});

test('时钟自动字色独立于主题色，按局部壁纸背景选高对比，并保留手动字色',async t=>{
  const {w,d,$,rightClick,menuClick}=setup(t,{media:{file:{type:'image/png'}}});
  let pixels=new w.Uint8ClampedArray(64*64*4);
  for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
  // 整张图以黑色为主，仅时钟下方是亮色；时钟应选黑字。
  for(let y=5;y<=20;y++)for(let x=22;x<=41;x++){const i=(y*64+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;}
  $('.clock-surface').getBoundingClientRect=()=>({left:400,top:100,width:200,height:100});
  w.createImageBitmap=async()=>({width:w.innerWidth,height:w.innerHeight,close(){}});
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},getImageData:()=>({data:pixels})});
  Object.defineProperty($('#wallpaper-upload'),'files',{value:[{name:'局部亮色.png',type:'image/png',size:100}],configurable:true});
  await $('#wallpaper-upload').onchange({target:$('#wallpaper-upload')});
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).themeColorMode,'manual');assert.equal(d.body.style.getPropertyValue('--clock-text-color'),'#000000');
  pixels=new w.Uint8ClampedArray(64*64*4);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
  rightClick($('#clock'));menuClick('自动高对比文字');await flush();assert.equal(d.body.style.getPropertyValue('--clock-text-color'),'#ffffff');
  rightClick($('#clock'));menuClick('时钟外观');$('#clock-color').value='#ffcc00';$('#clock-color').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('[data-wallpaper="ocean"]').click();await flush();assert.equal(d.body.style.getPropertyValue('--clock-text-color'),'#ffcc00');
});

test('视频时钟字色低频检测画面，手动颜色和隐藏页面不进行检测',async t=>{
  const {w,d,$,tick}=setup(t,{now:10000,media:{file:{type:'video/mp4'}}});const video=$('#video-wallpaper');let bright=true,samples=0;
  w.HTMLMediaElement.prototype.play=async()=>{};Object.defineProperty(video,'readyState',{value:2,configurable:true});
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){samples++;},getImageData:()=>({data:new w.Uint8ClampedArray(bright?[255,255,255,255]:[0,0,0,255])})});
  Object.defineProperty($('#wallpaper-upload'),'files',{value:[{name:'对比.mp4',type:'video/mp4',size:100}],configurable:true});
  await $('#wallpaper-upload').onchange({target:$('#wallpaper-upload')});assert.equal(d.body.style.getPropertyValue('--clock-text-color'),'#000000');
  bright=false;video.dispatchEvent(new w.Event('timeupdate'));assert.equal(samples,1);
  tick(2100);video.dispatchEvent(new w.Event('timeupdate'));assert.equal(samples,2);assert.equal(d.body.style.getPropertyValue('--clock-text-color'),'#ffffff');
  $('#clock-settings-open').click();$('#clock-color').value='#ddddff';$('#clock-color').dispatchEvent(new w.Event('input',{bubbles:true}));
  tick(2100);video.dispatchEvent(new w.Event('timeupdate'));assert.equal(samples,2);
  $('#clock-color-mode').value='auto';$('#clock-color-mode').dispatchEvent(new w.Event('change',{bubbles:true}));await flush();const before=samples;
  Object.defineProperty(d,'hidden',{value:true,configurable:true});tick(2100);video.dispatchEvent(new w.Event('timeupdate'));assert.equal(samples,before);
});

test('手动主题色即时保存并应用到主题变量，浅深主题和刷新保留颜色，壁纸不覆盖手动色',t=>{
  const {w,d,$}=setup(t);$('#settings-open').click();
  $('#theme-color-picker').value='#8966a6';$('#theme-color-picker').dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).themeColor,'#8966a6');assert.equal($('#theme-color-mode').value,'manual');
  const dark=d.body.style.getPropertyValue('--dialog');assert.equal(d.body.style.getPropertyValue('--theme-rgb'),'137 102 166');
  $('#theme').value='light';$('#theme').dispatchEvent(new w.Event('change',{bubbles:true}));assert.notEqual(d.body.style.getPropertyValue('--dialog'),dark);
  $('[data-wallpaper="ocean"]').click();assert.equal($('#theme-color-picker').value,'#8966a6');
  $('#theme-color-hex').value='537EA5';$('#theme-color-hex').dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal($('#theme-color-picker').value,'#537ea5');
  const reloaded=setup(t,{saved:w.localStorage.getItem('qipage.v1')});assert.equal(reloaded.d.body.style.getPropertyValue('--theme-rgb'),'83 126 165');
});

test('跟随内置壁纸更换主题色，手动选色退出自动，保留原有手动颜色',async t=>{
  const {w,d,$}=setup(t);$('#settings-open').click();
  $('#theme-color-mode').value='wallpaper';$('#theme-color-mode').dispatchEvent(new w.Event('change',{bubbles:true}));await flush();
  assert.equal($('#theme-color-picker').value,'#55796d');
  $('[data-wallpaper="dusk"]').click();await flush();assert.equal($('#theme-color-picker').value,'#8c6178');assert.equal(d.body.style.getPropertyValue('--theme-rgb'),'140 97 120');
  $('[data-wallpaper="ocean"]').click();await flush();assert.equal($('#theme-color-picker').value,'#477d92');
  $('#theme-color-mode').value='manual';$('#theme-color-mode').dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal($('#theme-color-picker').value,'#3b6957');
  $('#theme-color-refresh').click();await flush();assert.equal($('#theme-color-mode').value,'wallpaper');
  $('[data-theme-color="#b18045"]').click();assert.equal($('#theme-color-mode').value,'manual');assert.equal($('#theme-color-picker').value,'#b18045');
});

test('自定义图片从本地像素提色，切换到手动后迟到的解码不会覆盖，失败保留旧色',async t=>{
  const {w,d,$}=setup(t,{media:{file:{type:'image/png'}}});let decode;
  const pixels=new w.Uint8ClampedArray([180,70,100,255,182,72,102,255]);
  w.createImageBitmap=()=>new Promise(resolve=>{decode=resolve;});
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},getImageData:()=>({data:pixels})});
  $('#settings-open').click();$('#theme-color-mode').value='wallpaper';$('#theme-color-mode').dispatchEvent(new w.Event('change',{bubbles:true}));
  Object.defineProperty($('#wallpaper-upload'),'files',{value:[{name:'测试图片.png',type:'image/png',size:100}],configurable:true});
  const upload=$('#wallpaper-upload').onchange({target:$('#wallpaper-upload')});await flush();assert.equal(typeof decode,'function');
  $('[data-theme-color="#8966a6"]').click();decode({close(){}});await upload;
  assert.equal($('#theme-color-picker').value,'#8966a6');assert.equal(d.body.style.getPropertyValue('--theme-rgb'),'137 102 166');
  w.createImageBitmap=async()=>({close(){}});$('#theme-color-refresh').click();await flush();
  assert.equal($('#theme-color-picker').value,'#b54765');assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).wallpaperThemeColor,'#b54765');
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){throw new Error('Cannot read canvas');}});
  $('#theme-color-refresh').click();await flush();assert.equal($('#theme-color-picker').value,'#b54765');assert.match($('#theme-color-status').textContent,/保留上次/);
});

test('视频壁纸只在加载画面后取色，不随播放反复更改主题',async t=>{
  const {w,$}=setup(t,{media:{file:{type:'video/mp4'}}});const video=$('#video-wallpaper');let samples=0;
  w.HTMLMediaElement.prototype.play=async()=>{};
  Object.defineProperty(video,'readyState',{value:2,configurable:true});
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(source){assert.equal(source,video);samples++;},getImageData:()=>({data:new w.Uint8ClampedArray([60,110,180,255])})});
  $('#settings-open').click();$('#theme-color-mode').value='wallpaper';$('#theme-color-mode').dispatchEvent(new w.Event('change',{bubbles:true}));
  Object.defineProperty($('#wallpaper-upload'),'files',{value:[{name:'视频.mp4',type:'video/mp4',size:100}],configurable:true});
  await $('#wallpaper-upload').onchange({target:$('#wallpaper-upload')});assert.equal($('#theme-color-picker').value,'#3c6eb4');assert.equal(samples,1);
  video.dispatchEvent(new w.Event('timeupdate'));video.dispatchEvent(new w.Event('timeupdate'));assert.equal(samples,1);
});

function mockWebsiteImage(env){
  const {w}=env,pixels=new w.Uint8ClampedArray(128*128*4).fill(255);
  for(let y=32;y<96;y++)for(let x=32;x<96;x++){const i=(y*128+x)*4;pixels[i]=25;pixels[i+1]=40;pixels[i+2]=50;}
  w.createImageBitmap=async()=>({width:128,height:128,close(){}});
  w.ImageData=class{constructor(data){this.data=data;}};
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},clearRect(){},getImageData:()=>({data:pixels}),putImageData(){}});
  let output=0;w.HTMLCanvasElement.prototype.toDataURL=()=>output++%2===0?'data:image/png;base64,U09VUkNF':'data:image/png;base64,TUFTSw==';
}

test('Dock 加号打开添加，自动解析并缓存网站图标，保留可调灰度，保存与刷新保持',async t=>{
  const env=setup(t),{w,$}=env;mockWebsiteImage(env);
  const requests=[];
  w.fetch=async(url,options)=>{
    requests.push([url,options]);
    if(url==='https://site.example/path')return {ok:true,url,text:async()=>'<html><head><link rel="icon" href="/assets/mark.png"></head></html>'};
    return {ok:true,blob:async()=>new w.Blob(['image'],{type:'image/png'})};
  };
  $('#grid-add').click();assert.ok($('#bookmark-dialog').open);
  $('#bookmark-name').value='新网站';$('#bookmark-url').value='https://site.example/path';
  $('#bookmark-url').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  assert.deepEqual(requests.map(([url])=>url),['https://site.example/path','https://site.example/assets/mark.png']);
  assert.ok(requests.every(([,options])=>options.credentials==='omit'&&options.referrerPolicy==='no-referrer'));
  const saved=w.localStorage.getItem('qipage.v1'),bookmark=JSON.parse(saved).bookmarks.at(-1);
  assert.equal(bookmark.websiteIcon,true);assert.equal(bookmark.siteIconUrl,'https://site.example/assets/mark.png');assert.equal(bookmark.iconMask,'data:image/png;base64,TUFTSw==');
  assert.equal($('#bookmarks [aria-label="新网站"] img').src,'data:image/png;base64,U09VUkNF');assert.equal(bookmark.iconGrayscale,20);
  const reloaded=setup(t,{saved});assert.equal(reloaded.$('#bookmarks [aria-label="新网站"] img').style.getPropertyValue('--site-icon-gray'),'0.2');
});

test('输入网址即可自动填网站名，优先网站元数据，保存无需手填名称',async t=>{
  const env=setup(t),{w,$}=env;mockWebsiteImage(env);
  w.fetch=async(url)=>url==='https://www.name.example/'?{ok:true,text:async()=>'<title>网页标题</title><meta property="og:site_name" content="  自动   网站名  ">'}:{ok:true,blob:async()=>new w.Blob(['icon'],{type:'image/png'})};
  $('#grid-add').click();$('#bookmark-url').value='https://www.name.example';$('#bookmark-url').dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal($('#bookmark-name').value,'name.example');
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.at(-1).name,'自动 网站名');
  assert.ok($('#bookmarks [aria-label="自动 网站名"]'));
});

test('标题响应迟到不覆盖手动名称，新网址响应不会被旧网址结果覆盖',async t=>{
  const env=setup(t),{w,$}=env;mockWebsiteImage(env);
  let resolveOld;
  w.fetch=async(url)=>url==='https://old.example/'?await new Promise(resolve=>{resolveOld=resolve;}):url==='https://new.example/'?{ok:true,text:async()=>'<title>新网站标题</title>'}:{ok:true,blob:async()=>new w.Blob(['icon'],{type:'image/png'})};
  $('#grid-add').click();$('#bookmark-url').value='https://old.example';$('#bookmark-url').dispatchEvent(new w.Event('input',{bubbles:true}));$('#bookmark-fetch-icon').click();
  $('#bookmark-name').value='我的自定义名称';$('#bookmark-name').dispatchEvent(new w.Event('input',{bubbles:true}));
  resolveOld({ok:true,text:async()=>'<title>迟到的网站名</title>'});await flush();assert.equal($('#bookmark-name').value,'我的自定义名称');
  $('#bookmark-dialog .close-dialog').click();$('#grid-add').click();
  $('#bookmark-url').value='https://old.example';$('#bookmark-fetch-icon').click();
  $('#bookmark-url').value='https://new.example';$('#bookmark-url').dispatchEvent(new w.Event('input',{bubbles:true}));$('#bookmark-fetch-icon').click();await flush();
  resolveOld({ok:true,text:async()=>'<title>旧网站标题</title>'});await flush();assert.equal($('#bookmark-name').value,'新网站标题');
});

test('无法读取网页名时保留域名，手选图标不影响名称自动获取',async t=>{
  const {w,$}=setup(t);w.fetch=async()=>{throw new Error('CORS blocked');};
  $('#grid-add').click();$('#bookmark-url').value='https://www.offline.example/path';$('#bookmark-url').dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal($('#bookmark-name').value,'offline.example');
  $('#bookmark-icon-picker [data-bookmark-glyph="code"]').click();
  w.fetch=async()=>({ok:true,text:async()=>'<title>手选图标的网站</title>'});
  $('#bookmark-url').value='https://manual.example';$('#bookmark-url').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  const bookmark=JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.at(-1);
  assert.equal(bookmark.name,'手选图标的网站');assert.equal(bookmark.glyph,'code');assert.equal(bookmark.websiteIcon,undefined);
});

test('图标灰度默认轻度去色，可调原色或黑白，缓存图片、编辑和备份同步',async t=>{
  const env=setup(t),{w,$,rightClick,menuClick}=env;mockWebsiteImage(env);
  w.fetch=async(url)=>url==='https://gray.example/'?{ok:true,text:async()=>'<title>灰度测试</title>'}:{ok:true,blob:async()=>new w.Blob(['icon'],{type:'image/png'})};
  $('#grid-add').click();assert.equal($('#bookmark-icon-gray-value').value,'20.00');
  $('#bookmark-url').value='https://gray.example';$('#bookmark-fetch-icon').click();await flush();
  $('#bookmark-icon-gray-value').value='0';$('#bookmark-icon-gray-value').dispatchEvent(new w.Event('input',{bubbles:true}));$('#bookmark-icon-gray-value').dispatchEvent(new w.Event('blur'));
  assert.equal($('#bookmark-icon-gray-value').value,'0.00');assert.equal($('#bookmark-icon-preview img').style.getPropertyValue('--site-icon-gray'),'0');
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.bookmarks.at(-1).iconGrayscale,0);
  rightClick($('#bookmarks [aria-label="灰度测试"]'));menuClick('编辑此快捷方式');assert.equal($('#bookmark-icon-gray-value').value,'0.00');
  $('#bookmark-icon-gray').value='100';$('#bookmark-icon-gray').dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal($('#bookmark-icon-preview img').style.getPropertyValue('--site-icon-gray'),'1');
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.bookmarks.at(-1).iconGrayscale,100);
  const reloaded=setup(t,{saved:JSON.stringify(saved)});assert.equal(reloaded.$('#bookmarks [aria-label="灰度测试"] img').style.getPropertyValue('--site-icon-gray'),'1');
});

test('网站不允许跨域读取时使用灰度站点图标，加载失败最终回退本地图形',async t=>{
  const {w,$}=setup(t);w.fetch=async()=>{throw new Error('CORS blocked');};
  $('#grid-add').click();$('#bookmark-name').value='跨域站点';$('#bookmark-url').value='https://blocked.example/page';
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  const anchor=$('#bookmarks [aria-label="跨域站点"]'),img=anchor.querySelector('img.bookmark-site-icon');
  assert.equal(img.src,'https://blocked.example/favicon.ico');assert.equal(img.getAttribute('referrerpolicy'),'no-referrer');
  img.dispatchEvent(new w.Event('error'));assert.equal(img.src,'https://blocked.example/apple-touch-icon.png');
  img.dispatchEvent(new w.Event('error'));assert.equal(anchor.querySelector('img'),null);assert.ok(anchor.querySelector('svg.engine-glyph'));
  const saved=w.localStorage.getItem('qipage.v1');assert.equal(JSON.parse(saved).bookmarks.at(-1).websiteIcon,true);
  assert.doesNotThrow(()=>w.QiPageCore.validateBackup(JSON.parse(saved)));
});

test('网站图标请求取消或迟到不能覆盖手动图形，也不能污染下一次编辑',async t=>{
  const {w,$}=setup(t);let resolvePage,signal;
  w.fetch=(url,options)=>{signal=options.signal;return new Promise(resolve=>{resolvePage=resolve;});};
  $('#grid-add').click();$('#bookmark-name').value='手动优先';$('#bookmark-url').value='https://slow.example';$('#bookmark-fetch-icon').click();
  $('#bookmark-icon-picker [data-bookmark-glyph="code"]').click();assert.ok(signal.aborted);
  resolvePage({ok:true,url:'https://slow.example/',text:async()=>'<link rel="icon" href="/late.png">'});await flush();
  assert.equal($('#bookmark-icon-preview img'),null);
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  let bookmark=JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.at(-1);assert.equal(bookmark.glyph,'code');assert.equal(bookmark.websiteIcon,undefined);
  $('#grid-add').click();$('#bookmark-url').value='https://slow.example';$('#bookmark-fetch-icon').click();
  $('#bookmark-dialog .close-dialog').click();assert.ok(signal.aborted);
  $('#grid-add').click();resolvePage({ok:true,text:async()=>'<link rel="icon" href="/late.png">'});await flush();
  assert.equal($('#bookmark-url').value,'');assert.equal($('#bookmark-icon-preview img'),null);
});

test('自动获取图标拒绝危险网址，不请求跨站元数据图标',async t=>{
  const {w,$}=setup(t),requests=[];
  w.fetch=async(url)=>{requests.push(url);return {ok:true,text:async()=>'<link rel="icon" href="https://tracking.example/icon.png">',blob:async()=>{throw new Error('No image');}};};
  $('#grid-add').click();$('#bookmark-url').value='javascript:alert(1)';$('#bookmark-fetch-icon').click();await flush();assert.deepEqual(requests,[]);assert.equal($('#bookmark-icon-preview img'),null);
  $('#bookmark-url').value='https://safe.example';$('#bookmark-fetch-icon').click();await flush();
  assert.deepEqual(requests,['https://safe.example/','https://safe.example/favicon.ico']);
});

test('编辑模式直接修改图标下方名称，保留选择、网址与分组，提示和刷新同步',t=>{
  const {w,d,$,rightClick,menuClick}=setup(t);
  const id=$('[data-bookmark-id]').dataset.bookmarkId;
  rightClick($('#bookmarks'));menuClick('编辑模式');
  $('[data-dock-select]').click();const rename=$('[data-dock-rename]');
  assert.equal(rename.tagName,'BUTTON');assert.equal(rename.getAttribute('aria-hidden'),null);
  rename.click();assert.ok($('#dock-rename-dialog').open);
  assert.equal($('#dock-rename-name').value,'GitHub');assert.equal($('#dock-selection-count').textContent,'已选 1 项');
  $('#dock-rename-name').value='  我的代码 <站点>  ';$('#dock-rename-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal($('#dock-rename-dialog').open,false);assert.equal($('#dock-selection-count').textContent,'已选 1 项');
  assert.equal($('[data-dock-rename]').textContent,'我的代码 <站点>');assert.equal(d.activeElement,$('[data-dock-rename]'));
  const saved=w.localStorage.getItem('qipage.v1'),bookmark=JSON.parse(saved).bookmarks.find(b=>b.id===id);
  assert.equal(bookmark.name,'我的代码 <站点>');assert.equal(bookmark.url,'https://github.com/');assert.equal(bookmark.group,'work');
  $('#dock-edit-done').click();const anchor=$('[data-bookmark-id]');
  assert.equal(anchor.getAttribute('aria-label'),bookmark.name);assert.equal($('.dock-item-name').textContent,bookmark.name);
  anchor.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:100}));assert.equal($('#dock-tooltip').textContent,bookmark.name);
  const reloaded=setup(t,{saved});assert.equal(reloaded.$('.dock-item-name').textContent,bookmark.name);
});

test('文件夹名称可从下方编辑，取消与空名称不保存，面板标题同步更新',t=>{
  const env=setup(t),{w,$,rightClick,menuClick}=env;
  const id=createDockFolder(env,'工具');rightClick($('#bookmarks'));menuClick('编辑模式');
  const rename=()=>[...$('#bookmarks').querySelectorAll('[data-dock-rename]')].find(button=>button.dataset.dockRename===id);
  const before=w.localStorage.getItem('qipage.v1');rename().click();$('#dock-rename-name').value='  ';
  $('#dock-rename-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.ok($('#dock-rename-dialog').open);assert.equal(w.localStorage.getItem('qipage.v1'),before);
  $('#dock-rename-name').value='取消';$('#dock-rename-dialog .close-dialog').click();assert.equal(rename().textContent,'工具');assert.equal(w.localStorage.getItem('qipage.v1'),before);
  rename().click();$('#dock-rename-name').value='常用工具';$('#dock-rename-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(rename().textContent,'常用工具');$('#dock-edit-done').click();$('[data-folder-id]').click();
  assert.equal($('#dock-folder-title').textContent,'常用工具');
});

test('名称字号支持直接输入、预览、放弃与保存，并随备份恢复',t=>{
  const {w,d,$}=setup(t);
  $('#dock-settings-open').click();assert.equal($('#dock-name-size-value').value,'12.00');
  $('#dock-name-size-value').value='24.5';$('#dock-name-size-value').dispatchEvent(new w.Event('input',{bubbles:true}));$('#dock-name-size-value').dispatchEvent(new w.Event('blur'));
  assert.equal(d.documentElement.style.getPropertyValue('--dock-name-size'),'24.5px');assert.equal($('#dock-name-size-value').value,'24.50');
  assert.ok(parseFloat(d.documentElement.style.getPropertyValue('--dock-name-space'))>60);
  $('#dock-settings-dialog .close-dialog').click();$('#dock-discard').click();assert.equal(d.documentElement.style.getPropertyValue('--dock-name-size'),'12px');
  $('#dock-settings-open').click();$('#dock-name-size').value='20.25';$('#dock-name-size').dispatchEvent(new w.Event('input',{bubbles:true}));$('#dock-save').click();
  const saved=w.localStorage.getItem('qipage.v1');assert.equal(JSON.parse(saved).dockNameSize,20.25);
  const reloaded=setup(t,{saved});assert.equal(reloaded.d.documentElement.style.getPropertyValue('--dock-name-size'),'20.25px');
});

test('浮动名称贴近图标本身定位，不跟随 Dock 留白区域',t=>{
  const {w,$,tick}=setup(t),anchor=$('[data-bookmark-id]'),tooltip=$('#dock-tooltip');
  anchor.querySelector('.site-icon').getBoundingClientRect=()=>({left:100,right:160,top:200,bottom:260,width:60,height:60});
  tooltip.getBoundingClientRect=()=>({width:80,height:30});
  anchor.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:130}));tick(16);
  assert.equal(tooltip.style.left,'90px');assert.equal(tooltip.style.top,'160px');
});

function createDockFolder(env,name,ids=[]){
  const {w,$,rightClick,menuClick}=env;
  rightClick($('#bookmarks'));menuClick('新建文件夹');
  $('#dock-folder-name').value=name;
  $('#dock-folder-picker').querySelectorAll('input').forEach(input=>{input.checked=ids.includes(input.value);});
  $('#dock-folder-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  return [...$('#bookmarks').querySelectorAll('[data-folder-id]')].find(item=>item.getAttribute('aria-label')===name).dataset.folderId;
}

test('Dock 文件夹封面展示三个图标与剩余数量，聚焦展开，刷新与完整模式保留网址',t=>{
  const env=setup(t),{w,d,$}=env;
  const ids=[...d.querySelectorAll('#bookmarks [data-bookmark-id]')].map(item=>item.dataset.bookmarkId);
  const folderId=createDockFolder(env,'工作 <常用>',ids.slice(0,5));
  const folder=$('[data-folder-id]');
  assert.equal(folder.querySelectorAll('.folder-preview-cell').length,4);
  assert.equal(folder.querySelectorAll('.folder-preview-cell .site-icon').length,3);
  assert.equal(folder.querySelector('.folder-preview-count').textContent,'+2');
  assert.equal(d.querySelectorAll('#bookmarks [data-bookmark-id]').length,7);
  const click=new w.MouseEvent('click',{bubbles:true,cancelable:true});folder.dispatchEvent(click);
  assert.ok(click.defaultPrevented);assert.ok($('#dock-folder-dialog').open);assert.ok(d.body.classList.contains('dock-folder-open'));
  assert.equal($('#dock-folder-title').textContent,'工作 <常用>');assert.equal($('#dock-folder-count').textContent,'5 个网址');
  assert.equal($('#dock-folder-items').querySelectorAll('a').length,5);
  assert.equal($('#dock-folder-items a').href,'https://github.com/');
  $('#dock-folder-dialog .close-dialog').click();assert.equal(d.body.classList.contains('dock-folder-open'),false);
  assert.equal(d.activeElement,folder);
  const saved=w.localStorage.getItem('qipage.v1'),reloaded=setup(t,{saved});
  assert.equal(reloaded.$('[data-folder-id]').dataset.folderId,folderId);
  assert.equal(reloaded.$('.folder-preview-count').textContent,'+2');
  w.QiPageLayout.setMode('expanded');assert.equal(d.querySelectorAll('#bookmarks [data-bookmark-id]').length,7);
  assert.equal(d.querySelectorAll('#bookmarks [data-folder-id]').length,1);
  w.QiPageLayout.setMode('minimal');assert.equal($('[data-folder-id]').dataset.folderId,folderId);
  assert.deepEqual(JSON.parse(saved).bookmarks.map(b=>b.group),Array.from(w.QiPageCore.createDefaults().bookmarks,b=>b.group));
});

for(const view of ['grid','list'])test(`${view} 长按进入文件夹抖动编辑，拖动混合排序并刷新恢复`,async t=>{
  const initial=setup(t),state=initial.w.QiPageCore.createDefaults();state.folderView=view;
  const ids=state.bookmarks.slice(0,2).map(b=>b.id);
  state.dockFolders=[{id:'root',name:'根目录',bookmarkIds:ids},{id:'child',name:'子目录',parentId:'root',bookmarkIds:[]}];
  const {w,d,$,opened,rightClick,menuClick}=setup(t,{saved:JSON.stringify(state)});$('#bookmarks [data-folder-id=root]').click();
  rightClick($('#dock-folder-items'));menuClick('进入编辑模式');assert.ok($('#dock-folder-items').classList.contains('folder-editing'));
  rightClick($('#dock-folder-items'));menuClick('退出编辑模式');assert.equal($('#dock-folder-items').classList.contains('folder-editing'),false);
  const grid=$('#dock-folder-items'),first=grid.children[0],last=grid.children[2];
  const pointer=(target,type,x=10)=>{const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:10});Object.defineProperty(event,'pointerId',{value:1});target.dispatchEvent(event);};
  pointer(first,'pointerdown');await new Promise(resolve=>setTimeout(resolve,480));
  assert.ok(grid.classList.contains('folder-editing'));assert.equal($('#folder-sort-done').hidden,false);
  d.elementFromPoint=()=>last;pointer(d,'pointermove',40);pointer(d,'pointerup',40);
  const saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.deepEqual(saved.dockFolders[0].itemOrder,[...ids,'child']);
  grid.querySelector('a').click();assert.equal(opened.length,0);
  $('#folder-sort-done').click();assert.equal(grid.classList.contains('folder-editing'),false);
  assert.doesNotThrow(()=>w.QiPageCore.validateBackup(saved));
  const reloaded=setup(t,{saved:JSON.stringify(saved)});reloaded.$('#bookmarks [data-folder-id=root]').click();
  assert.equal(reloaded.$('#dock-folder-items').lastElementChild.querySelector('button').dataset.folderOpen,'child');
});

for(const view of ['grid','list'])test(`${view} 子文件夹右键移动到 Dock 保留子树，删除可撤回`,t=>{
  const initial=setup(t),state=initial.w.QiPageCore.createDefaults();state.folderView=view;
  const id=state.bookmarks[0].id;
  state.dockFolders=[{id:'a',name:'A',bookmarkIds:[]},{id:'b',name:'B',parentId:'a',bookmarkIds:[]},{id:'c',name:'C',parentId:'b',bookmarkIds:[id]}];
  const {w,$,rightClick,menuClick}=setup(t,{saved:JSON.stringify(state)});
  $('#bookmarks [data-folder-id="a"]').click();
  assert.ok(rightClick($('#dock-folder-items [data-folder-open="b"] .site-icon')).includes('移动到 Dock 栏'));
  menuClick('删除文件夹及内容');$('#confirm-dialog .close-dialog').click();
  assert.ok($('#dock-folder-items [data-folder-open="b"]'));
  rightClick($('#dock-folder-items [data-folder-open="b"]'));menuClick('删除文件夹及内容');$('#confirm-action').click();
  assert.equal($('#dock-folder-items [data-folder-open="b"]'),null);$('#toast .toast-undo').click();
  rightClick($('#dock-folder-items [data-folder-open="b"]'));menuClick('移动到 Dock 栏');
  const saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.dockFolders.find(f=>f.id==='b').parentId,undefined);
  assert.equal(saved.dockFolders.find(f=>f.id==='c').parentId,'b');
  assert.deepEqual(saved.dockFolders.find(f=>f.id==='c').bookmarkIds,[id]);
  assert.ok(saved.dockOrder.includes('b'));assert.ok($('#bookmarks [data-folder-id="b"]'));
  assert.equal($('#dock-folder-items [data-folder-open="b"]'),null);
  assert.doesNotThrow(()=>w.QiPageCore.validateBackup(saved));
});

test('文件夹网址默认隐藏移出按钮，右键删除可取消并撤回',t=>{
  const env=setup(t),{w,$,rightClick,menuClick}=env;
  const id=$('#bookmarks [data-bookmark-id]').dataset.bookmarkId;
  const folder=createDockFolder(env,'测试',[id]);$(`[data-folder-id="${folder}"]`).click();
  assert.equal($('#dock-folder-items [data-folder-remove]').hidden,true);
  assert.ok(rightClick($('#dock-folder-items a')).includes('删除网址'));menuClick('删除网址');
  $('#confirm-dialog .close-dialog').click();assert.ok($('#dock-folder-items a'));
  rightClick($('#dock-folder-items a'));menuClick('删除网址');$('#confirm-action').click();
  assert.equal($('#dock-folder-items a'),null);
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.bookmarks.some(b=>b.id===id),false);
  $('#toast .toast-undo').click();saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.ok(saved.bookmarks.some(b=>b.id===id));assert.ok(saved.dockFolders.find(f=>f.id===folder).bookmarkIds.includes(id));
  assert.doesNotThrow(()=>w.QiPageCore.validateBackup(saved));
});

test('文件夹图标和详细列表可切换，列表显示路径与网址并保存偏好',t=>{
  const env=setup(t),{w,$}=env;
  const bookmark=$('#bookmarks [data-bookmark-id]').dataset.bookmarkId;
  const root=createDockFolder(env,'A',[bookmark]);$(`[data-folder-id="${root}"]`).click();
  $('#dock-folder-create-child').click();$('#dock-folder-name').value='B';
  $('#dock-folder-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal($('#dock-folder-items').dataset.view,'grid');
  assert.equal($('#dock-folder-view').parentElement,$('#dock-folder-breadcrumbs').parentElement);
  assert.equal($('#dock-folder-items a>span:last-child').textContent,'GitHub');
  $('#dock-folder-fetch-icons').click();
  assert.equal($('#dock-folder-items a img').getAttribute('src'),'https://github.com/favicon.ico');
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.find(b=>b.id===bookmark).websiteIcon,true);
  $('#dock-folder-view [data-folder-view=list]').click();
  assert.equal($('#dock-folder-items').dataset.view,'list');
  assert.equal($('#dock-folder-items .folder-open-button small').textContent,'文件夹 · A/B');
  assert.equal($('#dock-folder-items a small').textContent,'https://github.com/');
  $('#dock-folder-items .folder-open-button').click();assert.equal($('#dock-folder-title').textContent,'B');
  assert.equal($('#dock-folder-items').dataset.view,'list');
  const saved=w.localStorage.getItem('qipage.v1');assert.equal(w.QiPageCore.validateBackup(JSON.parse(saved)).folderView,'list');
  const reload=setup(t,{saved});reload.$(`[data-folder-id="${root}"]`).click();assert.equal(reload.$('#dock-folder-items').dataset.view,'list');
  reload.$('#dock-folder-view [data-folder-view=grid]').click();assert.equal(reload.$('#dock-folder-items small'),null);
});

test('手动创建子文件夹展示 A/B 路径，调整上级保留子树并禁止循环',t=>{
  const env=setup(t),{w,$}=env;
  const root=createDockFolder(env,'A');
  $(`[data-folder-id="${root}"]`).click();$('#dock-folder-create-child').click();
  assert.equal($('#dock-folder-parent').value,root);
  $('#dock-folder-name').value='B';$('#dock-folder-name').dispatchEvent(new w.Event('input'));
  assert.equal($('#dock-folder-path').textContent,'路径：A/B');
  $('#dock-folder-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1')),child=saved.dockFolders.find(f=>f.name==='B');
  assert.equal(child.parentId,root);assert.equal(saved.dockOrder.includes(child.id),false);
  $('#dock-folder-items [data-folder-open]').click();$('#dock-folder-create-child').click();
  assert.equal($('#dock-folder-parent option:checked').textContent,'A/B');
  $('#dock-folder-name').value='C';$('#dock-folder-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  $('#dock-folder-organize').click();
  assert.equal([...$('#dock-folder-parent').options].some(o=>o.value===child.id),false);
  assert.equal([...$('#dock-folder-parent').options].some(o=>o.textContent==='A/B/C'),false);
  $('#dock-folder-parent').value='';$('#dock-folder-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.dockFolders.find(f=>f.id===child.id).parentId,undefined);
  assert.equal(saved.dockFolders.find(f=>f.name==='C').parentId,child.id);
  assert.ok(saved.dockOrder.includes(child.id));assert.doesNotThrow(()=>w.QiPageCore.validateBackup(saved));
  const reloaded=setup(t,{saved:JSON.stringify(saved)});
  reloaded.$(`[data-folder-id="${child.id}"]`).click();
  assert.equal(reloaded.$('#dock-folder-items [data-folder-open]').textContent,'C');
});

test('编辑模式选择网址创建文件夹，移入现有文件夹，移出与解散均保留网址',t=>{
  const env=setup(t),{w,d,$,rightClick,menuClick}=env;
  const ids=[...d.querySelectorAll('#bookmarks [data-bookmark-id]')].map(item=>item.dataset.bookmarkId);
  rightClick($('#bookmarks'));menuClick('编辑模式');
  d.querySelectorAll('[data-dock-select]')[0].click();d.querySelectorAll('[data-dock-select]')[1].click();
  $('#dock-create-folder').click();
  assert.equal($('#dock-folder-picker').querySelectorAll('input:checked').length,2);
  $('#dock-folder-name').value='常用';$('#dock-folder-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  const folderId=$('[data-folder-id]').dataset.folderId;
  [...d.querySelectorAll('[data-dock-select]')].find(input=>input.dataset.dockSelect===ids[2]).click();
  assert.equal($('#dock-move-folder').disabled,false);$('#dock-move-folder').value=folderId;$('#dock-move-folder').dispatchEvent(new w.Event('change',{bubbles:true}));
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.deepEqual(saved.dockFolders[0].bookmarkIds,ids.slice(0,3));assert.equal(saved.bookmarks.length,12);
  $('#dock-edit-done').click();$('[data-folder-id]').click();
  assert.equal($('#dock-folder-items [data-folder-remove]').hidden,true);
  rightClick($('#dock-folder-items a'));menuClick('移出文件夹');
  assert.equal($('#dock-folder-items').querySelectorAll('a').length,2);
  assert.ok([...$('#bookmarks').querySelectorAll('[data-bookmark-id]')].some(item=>item.dataset.bookmarkId===ids[0]));
  $('#dock-folder-organize').click();$('#dock-folder-name').value='已改名';
  $('#dock-folder-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal($('#dock-folder-title').textContent,'已改名');
  $('#dock-folder-organize').click();$('#dock-folder-dissolve').click();$('#confirm-action').click();
  saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.dockFolders.length,0);assert.equal(saved.bookmarks.length,12);
  assert.equal($('#dock-folder-dialog').open,false);assert.equal(d.querySelectorAll('#bookmarks [data-bookmark-id]').length,12);
});

test('空文件夹可打开，网址可跨文件夹移动，删除网址会清理内容引用',t=>{
  const env=setup(t),{w,$,rightClick,menuClick}=env;
  const ids=[...$('#bookmarks').querySelectorAll('[data-bookmark-id]')].map(item=>item.dataset.bookmarkId);
  createDockFolder(env,'第一组',ids.slice(0,4));const second=createDockFolder(env,'第二组');
  const folder=()=>[...$('#bookmarks').querySelectorAll('[data-folder-id]')].find(item=>item.dataset.folderId===second);
  folder().click();assert.equal($('#dock-folder-empty').hidden,false);
  $('#dock-folder-organize').click();$('#dock-folder-picker input').checked=true;
  $('#dock-folder-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.dockFolders[0].bookmarkIds.length,3);assert.deepEqual(saved.dockFolders[1].bookmarkIds,[ids[0]]);
  assert.equal($('#dock-folder-empty').hidden,true);$('#dock-folder-dialog .close-dialog').click();
  w.QiPageLayout.setMode('expanded');folder().click();rightClick($('#dock-folder-items [data-bookmark-id]'));menuClick('编辑此快捷方式');$('#delete-bookmark').click();$('#confirm-action').click();
  saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.bookmarks.length,11);assert.deepEqual(saved.dockFolders[1].bookmarkIds,[]);
  assert.doesNotThrow(()=>w.QiPageCore.validateBackup(saved));
});

test('Dock 悬停放大在点击、窗口失焦与后台切换时清除，取消待执行帧',t=>{
  const {w,d,$,tick}=setup(t),grid=$('#bookmarks'),item=grid.querySelector('.bookmark'),anchor=item.querySelector('a');
  item.getBoundingClientRect=()=>({left:100,width:42,height:42});
  const move=()=>grid.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:121}));
  move();tick(16);assert.ok(grid.classList.contains('dock-active'));
  anchor.addEventListener('click',event=>event.preventDefault());anchor.click();
  assert.equal(item.style.getPropertyValue('--dock-scale'),'');assert.equal(grid.classList.contains('dock-active'),false);
  move();w.dispatchEvent(new w.Event('blur'));tick(16);assert.equal(grid.classList.contains('dock-active'),false);
  move();tick(16);w.dispatchEvent(new w.Event('blur'));assert.equal(item.style.getPropertyValue('--dock-scale'),'');
  move();tick(16);Object.defineProperty(d,'hidden',{configurable:true,value:true});d.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(grid.classList.contains('dock-active'),false);assert.equal($('#dock-tooltip').hidden,true);
});

test('Dock 自动恢复焦点不放大，键盘 Tab 聚焦仍可放大，焦点移出后恢复',t=>{
  const {w,d,$,tick,key}=setup(t),grid=$('#bookmarks'),item=grid.querySelector('.bookmark'),anchor=item.querySelector('a');
  item.getBoundingClientRect=()=>({left:100,width:42,height:42});
  anchor.focus();tick(16);assert.equal(grid.classList.contains('dock-active'),false);
  $('#search').focus();key('Tab');anchor.focus();tick(16);assert.ok(grid.classList.contains('dock-active'));
  $('#search').focus();tick(16);assert.equal(grid.classList.contains('dock-active'),false);
  key('Tab');anchor.focus();tick(16);w.dispatchEvent(new w.Event('blur'));$('#search').focus();anchor.focus();tick(16);
  assert.equal(grid.classList.contains('dock-active'),false);assert.equal(item.style.getPropertyValue('--dock-scale'),'');
});

function dockSortFixture(t){
  const env=setup(t),{w,d,$,rightClick,menuClick}=env;
  const grid=$('#bookmarks');
  grid.getBoundingClientRect=()=>({left:90,right:810,top:50,bottom:150,width:720,height:100});
  function geometry(){
    [...grid.querySelectorAll('[data-dock-id]')].forEach(anchor=>{
      const rect=()=>{const index=[...grid.querySelectorAll('[data-dock-id]')].indexOf(anchor);return {left:100+index*54,right:142+index*54,top:70,bottom:112,width:42,height:42};};
      anchor.getBoundingClientRect=rect;anchor.closest('.bookmark').getBoundingClientRect=rect;
    });
  }
  const pointer=(target,type,x,y=90,pointerType='mouse')=>{
    const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});
    Object.defineProperties(event,{pointerId:{value:1},pointerType:{value:pointerType}});target.dispatchEvent(event);return event;
  };
  const ids=()=>[...grid.querySelectorAll('[data-bookmark-id]')].map(anchor=>anchor.dataset.bookmarkId);
  rightClick(grid);menuClick('编辑模式');geometry();
  return {...env,grid,geometry,pointer,ids};
}

test('文件夹参与 Dock 排序和批量选择，删除文件夹只解散并保留内容',t=>{
  const env=dockSortFixture(t),{w,d,$,geometry,pointer,rightClick,menuClick}=env;
  $('#dock-edit-done').click();
  const bookmarks=[...$('#bookmarks').querySelectorAll('[data-bookmark-id]')].map(item=>item.dataset.bookmarkId);
  const folderId=createDockFolder(env,'排序文件夹',bookmarks.slice(0,4));
  rightClick($('#bookmarks'));menuClick('编辑模式');geometry();
  const folder=$('[data-folder-id]'),initial=[...$('#bookmarks').querySelectorAll('[data-dock-id]')].map(item=>item.dataset.dockId);
  pointer(folder,'pointerdown',121);pointer(d,'pointermove',250);pointer(d,'pointerup',250);
  const expected=[initial[1],initial[2],initial[0],...initial.slice(3)];
  assert.deepEqual([...$('#bookmarks').querySelectorAll('[data-dock-id]')].map(item=>item.dataset.dockId),expected);
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.deepEqual(saved.dockOrder,expected);assert.equal(saved.bookmarks.length,12);
  const reloaded=setup(t,{saved:JSON.stringify(saved)});
  assert.deepEqual([...reloaded.$('#bookmarks').querySelectorAll('[data-dock-id]')].map(item=>item.dataset.dockId),expected);
  // 拖动后的首次点击会被拦截，复选框的正常点击由下一次 pointerdown 开始。
  pointer(folder,'pointerdown',250);pointer(d,'pointerup',250);
  [...$('#bookmarks').querySelectorAll('[data-dock-select]')].find(item=>item.dataset.dockSelect===folderId).click();
  assert.equal($('#dock-selection-count').textContent,'已选 1 项');
  $('#dock-delete-selected').click();$('#confirm-action').click();
  saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.deepEqual(saved.dockFolders,[]);assert.equal(saved.bookmarks.length,12);
  assert.equal($('#bookmarks').querySelectorAll('[data-bookmark-id]').length,12);assert.doesNotThrow(()=>w.QiPageCore.validateBackup(saved));
});

test('编辑模式拖动图标排序，拖动后不误选，保留批量选择并刷新恢复顺序',t=>{
  const {w,d,$,pointer,ids}=dockSortFixture(t);
  const original=ids(),first=$('[data-bookmark-id]');
  $('[data-dock-select]').click();assert.equal($('#dock-selection-count').textContent,'已选 1 项');
  pointer(first,'pointerdown',121);pointer(d,'pointermove',250);
  assert.ok($('.dock-sort-ghost'));assert.ok(d.body.classList.contains('dock-sorting'));
  assert.deepEqual(ids().slice(0,3),[original[1],original[2],original[0]]);
  assert.equal(w.localStorage.getItem('qipage.v1'),null,'拖动预览不保存中间状态');
  pointer(d,'pointerup',250);
  first.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  assert.equal($('#dock-selection-count').textContent,'已选 1 项');
  assert.equal($('.dock-sort-ghost'),null);
  const saved=w.localStorage.getItem('qipage.v1');
  assert.deepEqual(JSON.parse(saved).bookmarks.map(b=>b.id),ids());
  const reloaded=setup(t,{saved});
  assert.deepEqual([...reloaded.d.querySelectorAll('[data-bookmark-id]')].map(a=>a.dataset.bookmarkId),ids());
  $('#dock-delete-selected').click();$('#confirm-action').click();assert.equal(d.querySelectorAll('[data-bookmark-id]').length,11);
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.some(b=>b.id===original[0]),false);
});

for(const pointerType of ['mouse','touch'])test(`排序移动 DOM 节点时保持指针捕获并保存顺序（${pointerType}）`,t=>{
  const {w,d,$,grid,pointer,ids}=dockSortFixture(t);
  let capture=null;
  const lostCapture=()=>{
    const target=capture;capture=null;
    if(target)pointer(target,'lostpointercapture',250,90,pointerType);
  };
  w.HTMLElement.prototype.setPointerCapture=function(){capture=this;};
  w.HTMLElement.prototype.hasPointerCapture=function(){return capture===this;};
  w.HTMLElement.prototype.releasePointerCapture=function(){if(capture===this)lostCapture();};
  const insertBefore=grid.insertBefore;
  grid.insertBefore=function(item,next){
    // 浏览器移动捕获节点或其祖先时会丢失捕获；jsdom 不实现此行为。
    const losesCapture=capture&&item.contains(capture);
    const result=insertBefore.call(this,item,next);
    if(losesCapture)lostCapture();
    return result;
  };
  const original=ids(),first=$('[data-bookmark-id]');
  pointer(first,'pointerdown',121,90,pointerType);
  pointer(capture||d,'pointermove',250,90,pointerType);
  assert.ok(d.body.classList.contains('dock-sorting'),'移动图标不应取消排序');
  assert.equal(capture,grid,'由不会在排序时移动的容器捕获指针');
  pointer(capture,'pointermove',310,90,pointerType);
  pointer(capture,'pointerup',310,90,pointerType);
  assert.deepEqual(ids().slice(0,4),[original[1],original[2],original[3],original[0]]);
  assert.deepEqual(JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.map(b=>b.id),ids());
  assert.equal(capture,null);assert.equal($('.dock-sort-ghost'),null);

  pointer(first,'pointerdown',310,90,pointerType);
  pointer(capture,'pointermove',121,90,pointerType);
  lostCapture();
  assert.deepEqual(ids(),JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.map(b=>b.id));
  assert.equal($('.dock-sort-ghost'),null);
});

test('取消排序或在 Dock 外释放恢复原顺序，微小移动仍是选择点击',t=>{
  const {w,d,$,pointer,ids,geometry,key}=dockSortFixture(t);
  const original=ids();
  let first=$('[data-bookmark-id]');pointer(first,'pointerdown',121);pointer(d,'pointermove',250);key('Escape');
  assert.deepEqual(ids(),original);assert.ok(d.body.classList.contains('dock-editing'));assert.equal($('.dock-sort-ghost'),null);
  geometry();first=$('[data-bookmark-id]');pointer(first,'pointerdown',121);pointer(d,'pointermove',300);pointer(d,'pointerup',300,400);
  assert.deepEqual(ids(),original);assert.equal(w.localStorage.getItem('qipage.v1'),null);
  geometry();first=$('[data-bookmark-id]');pointer(first,'pointerdown',121);pointer(d,'pointermove',124);pointer(d,'pointerup',124);first.click();
  assert.deepEqual(ids(),original);assert.equal($('#dock-selection-count').textContent,'已选 1 项');assert.equal($('.dock-sort-ghost'),null);
});

test('排序支持触摸取消、边缘滚动，退出编辑后不可拖动排序',t=>{
  const {w,d,$,pointer,ids,geometry,tick}=dockSortFixture(t),grid=$('#bookmarks');
  const original=ids();let first=$('[data-bookmark-id]');
  pointer(first,'pointerdown',121,90,'touch');pointer(d,'pointermove',795,90,'touch');tick(16);
  assert.ok(grid.scrollLeft>0);pointer(d,'pointercancel',795,90,'touch');
  assert.deepEqual(ids(),original);assert.equal($('.dock-sort-ghost'),null);
  geometry();first=$('[data-bookmark-id]');pointer(first,'pointerdown',121);pointer(d,'pointermove',250);
  $('#dock-edit-done').click();assert.deepEqual(ids(),original);assert.equal($('.dock-sort-ghost'),null);
  first=$('[data-bookmark-id]');pointer(first,'pointerdown',121);pointer(d,'pointermove',250);pointer(d,'pointerup',250);
  assert.deepEqual(ids(),original);assert.equal(w.localStorage.getItem('qipage.v1'),null);
});

test('Dock 专属右键只包含 Dock 操作，名称开关移到 Dock 设置',t=>{
  const {$,d,rightClick,menuClick}=setup(t);
  assert.deepEqual(rightClick($('#bookmarks')),['添加快捷方式','新建文件夹','导入浏览器书签','编辑模式','Dock 设置']);
  const actions=rightClick($('[data-bookmark-id]'));
  for(const item of ['展开完整主页','个性化设置','更换壁纸','管理搜索引擎','管理网址与分组'])assert.equal(actions.includes(item),false);
  menuClick('Dock 设置');assert.ok($('#dock-settings-dialog').open);
  assert.ok($('#dock-settings-dialog #dock-show-names'));assert.equal($('#settings-dialog #dock-show-names'),null);
  assert.equal(d.body.dataset.view,'minimal');
});

test('Dock 放大倍率和影响范围实际参与动画，禁用后复位',t=>{
  const {w,$,rightClick,menuClick,tick}=setup(t);
  rightClick($('#bookmarks'));menuClick('Dock 设置');
  $('#dock-scale').value='2';$('#dock-scale').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('#dock-radius').value='60';$('#dock-radius').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('#dock-save').click();
  const items=[...$('#bookmarks').querySelectorAll('.bookmark:not(.bookmark-add-item)')];
  items.forEach((item,index)=>item.getBoundingClientRect=()=>({left:100+index*54,width:42,height:42}));
  $('#bookmarks').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:121}));tick(16);
  assert.equal(Number(items[0].style.getPropertyValue('--dock-scale')),2);
  assert.ok(Number(items[1].style.getPropertyValue('--dock-scale'))<1.03);
  rightClick($('#bookmarks'));menuClick('Dock 设置');$('#dock-zoom').click();$('#dock-save').click();
  $('#bookmarks').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:121}));tick(16);
  assert.equal($('#bookmarks').classList.contains('dock-active'),false);
  assert.equal(items[0].style.getPropertyValue('--dock-scale'),'');
});

test('Dock 参数实时预览并显式保存，放大与提示可关闭，重置不影响网址和主页偏好',t=>{
  const {w,d,$,rightClick,menuClick}=setup(t);
  rightClick($('#bookmarks'));menuClick('Dock 设置');
  const change=(id,value)=>{const el=$(id);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event(el.type==='range'?'input':'change',{bubbles:true}));};
  change('#dock-gap',25);change('#dock-size',56);change('#dock-opacity',80);change('#dock-scale',2.2);change('#dock-x',30);change('#dock-y',40);
  assert.equal(d.documentElement.style.getPropertyValue('--dock-gap'),'25px');
  assert.equal(d.documentElement.style.getPropertyValue('--dock-size'),'56px');
  assert.equal(d.documentElement.style.getPropertyValue('--dock-tray-alpha'),'0.8');
  assert.equal(w.localStorage.getItem('qipage.v1'),null,'预览不写入存储');
  change('#dock-zoom',false);change('#dock-tooltip-enabled',false);
  assert.ok(d.body.classList.contains('dock-no-zoom'));assert.equal($('#dock-scale').disabled,true);
  $('#dock-save').click();
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.dockScale,2.2);assert.equal(saved.dockPosition,'custom');assert.equal(saved.dockX,30);
  $('[data-bookmark-id]').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:100}));
  assert.equal($('#dock-tooltip').hidden,true);
  rightClick($('#bookmarks'));menuClick('Dock 设置');$('#dock-reset').click();$('#dock-save').click();
  saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.bookmarks.length,12);assert.equal(saved.theme,'dark');assert.equal(saved.dockGap,12);assert.equal(saved.dockPosition,'bottom');assert.equal(saved.dockZoom,true);
});

test('Dock 数字可直接输入，范围扩展、显示两位小数并支持备份恢复',t=>{
  const {w,d,$}=setup(t);
  $('#dock-settings-open').click();
  assert.equal($('#dock-size-value').value,'42.00');
  const change=(id,value)=>{const input=$(id);input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));input.dispatchEvent(new w.Event('blur'));};
  for(const [id,value]of [['size',128.25],['gap',100.5],['width',3000.75],['scale',3.5],['radius',500.25],['speed',1500.5],['x',48.4378]])change(`#dock-${id}-value`,value);
  assert.equal($('#dock-x-value').value,'48.44');
  assert.equal($('#dock-gap-value').value,'100.50');
  assert.equal($('#dock-gap').value,'100.5');
  assert.equal(d.documentElement.style.getPropertyValue('--dock-size'),'128.25px');
  change('#dock-size-value',999);assert.equal($('#dock-size-value').value,'128.25','越界输入恢复上次有效值');
  change('#dock-size-value','');assert.equal($('#dock-size-value').value,'128.25','空值不变为零');
  assert.equal(w.localStorage.getItem('qipage.v1'),null);
  $('#dock-save').click();
  const saved=w.localStorage.getItem('qipage.v1'),reloaded=setup(t,{saved});
  reloaded.$('#dock-settings-open').click();
  assert.equal(reloaded.$('#dock-width-value').value,'3000.75');
  assert.equal(reloaded.$('#dock-scale-value').value,'3.50');
  assert.equal(reloaded.$('#dock-x-value').value,'48.44');
});

test('关闭 Dock 设置确认保存，继续编辑、放弃与 Esc、右键、遮罩关闭均保留正确状态',t=>{
  const {w,d,$,rightClick,menuClick}=setup(t);
  const edit=()=>{$('#dock-settings-open').click();$('#dock-gap').value='80';$('#dock-gap').dispatchEvent(new w.Event('input',{bubbles:true}));};
  const close=$('#dock-settings-dialog .close-dialog');
  edit();close.click();assert.ok($('#dock-save-dialog').open);
  $('#dock-save-dialog .close-dialog').click();assert.ok($('#dock-settings-dialog').open);assert.equal($('#dock-gap-value').value,'80.00');
  const cancel=new w.Event('cancel',{cancelable:true});$('#dock-settings-dialog').dispatchEvent(cancel);
  assert.ok(cancel.defaultPrevented);assert.ok($('#dock-save-dialog').open);
  $('#dock-discard').click();assert.equal($('#dock-settings-dialog').open,false);
  assert.equal(d.documentElement.style.getPropertyValue('--dock-gap'),'12px');assert.equal(w.localStorage.getItem('qipage.v1'),null);
  edit();rightClick($('#dock-settings-dialog'));menuClick('关闭当前窗口');assert.ok($('#dock-save-dialog').open);
  $('#dock-confirm-save').click();assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).dockGap,80);
  $('#dock-settings-open').click();$('#dock-reset').click();
  $('#dock-settings-dialog').dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:-10,clientY:-10}));
  assert.ok($('#dock-save-dialog').open);$('#dock-discard').click();
  assert.equal(d.documentElement.style.getPropertyValue('--dock-gap'),'80px');
  $('#dock-settings-open').click();close.click();assert.equal($('#dock-save-dialog').open,false);assert.equal($('#dock-settings-dialog').open,false);
});

test('Dock 预览期间其他设置的保存不写入未确认的 Dock 修改',t=>{
  const {w,$}=setup(t);
  $('#dock-settings-open').click();$('#dock-gap').value='90';$('#dock-gap').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('#notes').value='保留便签';$('#notes').dispatchEvent(new w.Event('input',{bubbles:true}));
  const saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.notes,'保留便签');assert.equal(saved.dockGap,12);
  $('#dock-settings-dialog .close-dialog').click();$('#dock-discard').click();
  assert.equal(w.QiPageDock.getSettings().dockGap,12);
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).notes,'保留便签');
});

test('Dock 拖动保存有界位置，取消拖动不保存，锁定后不可移动',t=>{
  const {w,d,$,rightClick,menuClick}=setup(t);
  const dashboard=$('.dashboard'),handle=$('#dock-drag-handle');
  dashboard.getBoundingClientRect=()=>({left:100,top:100,width:200,height:100,right:300,bottom:200});
  const pointer=(type,x,y)=>{const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:1});handle.dispatchEvent(event);};
  rightClick($('#bookmarks'));menuClick('Dock 设置');$('#dock-movable').click();$('#dock-save').click();
  pointer('pointerdown',110,120);pointer('pointermove',-500,-500);pointer('pointerup',-500,-500);
  let saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.dockPosition,'custom');assert.ok(saved.dockX>0&&saved.dockX<100);assert.ok(saved.dockY>0&&saved.dockY<100);
  assert.ok(Math.abs(parseFloat(dashboard.style.getPropertyValue('--dock-center-x'))-112)<.001);assert.ok(Math.abs(parseFloat(dashboard.style.getPropertyValue('--dock-center-y'))-62)<.001);
  const original=w.localStorage.getItem('qipage.v1');
  pointer('pointerdown',110,120);pointer('pointermove',900,600);pointer('pointercancel',900,600);
  assert.equal(w.localStorage.getItem('qipage.v1'),original);assert.equal(d.body.classList.contains('dock-dragging'),false);
  handle.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  saved=JSON.parse(w.localStorage.getItem('qipage.v1'));assert.equal(saved.dockX,210/w.innerWidth*100);
  rightClick($('#bookmarks'));menuClick('Dock 设置');$('#dock-movable').click();$('#dock-save').click();
  const locked=w.localStorage.getItem('qipage.v1');pointer('pointerdown',110,120);pointer('pointermove',500,600);pointer('pointerup',500,600);
  assert.equal(w.localStorage.getItem('qipage.v1'),locked);
});

test('Dock 右键进入编辑，复选框与图标点击选择不导航，退出不改数据',t=>{
  const {w,d,$,rightClick,menuClick,key,opened}=setup(t);
  assert.equal(rightClick($('#search')).includes('编辑模式'),false);
  assert.ok(rightClick($('#bookmarks')).includes('编辑模式'));
  menuClick('编辑模式');
  assert.equal(w.QiPageLayout.getMode(),'minimal');
  assert.ok(d.body.classList.contains('dock-editing'));
  assert.equal($('#dock-edit-toolbar').hidden,false);
  assert.equal(d.querySelectorAll('[data-dock-select]').length,12);
  assert.equal($('#dock-delete-selected').disabled,true);
  const anchor=$('[data-bookmark-id]');
  const click=new w.MouseEvent('click',{bubbles:true,cancelable:true});anchor.dispatchEvent(click);
  assert.equal(click.defaultPrevented,true);
  assert.equal($('[data-dock-select]').checked,true);
  assert.equal($('#dock-selection-count').textContent,'已选 1 项');
  const check=d.querySelectorAll('[data-dock-select]')[1];check.click();
  assert.equal($('#dock-selection-count').textContent,'已选 2 项');
  assert.equal(opened.length,0);
  key('Escape');
  assert.equal($('#dock-edit-toolbar').hidden,true);
  assert.equal(d.querySelectorAll('[data-dock-select]').length,0);
  assert.equal(d.querySelectorAll('[data-bookmark-id]').length,12);
});

test('Dock 批量删除仅删除确认时选中项，取消保留全部网址，结果持久保存',t=>{
  const {w,d,$,rightClick,menuClick}=setup(t);
  rightClick($('#bookmarks'));menuClick('编辑模式');
  const inputs=[...d.querySelectorAll('[data-dock-select]')];
  const removed=inputs.slice(0,2).map(input=>input.dataset.dockSelect);
  inputs[0].click();inputs[1].click();
  $('#dock-delete-selected').click();
  assert.match($('#confirm-title').textContent,/2/);
  $('#confirm-dialog .close-dialog').click();
  assert.equal(d.querySelectorAll('[data-bookmark-id]').length,12);
  assert.equal($('#dock-selection-count').textContent,'已选 2 项');
  $('#dock-delete-selected').click();$('#confirm-action').click();
  assert.equal(d.querySelectorAll('[data-bookmark-id]').length,10);
  const saved=JSON.parse(w.localStorage.getItem('qipage.v1'));
  assert.equal(saved.bookmarks.length,10);
  assert.ok(saved.bookmarks.every(b=>!removed.includes(b.id)));
  assert.ok(saved.groups.length>0);
  assert.equal($('#dock-selection-count').textContent,'已选 0 项');
  assert.equal($('#dock-delete-selected').disabled,true);
});

test('Dock 全选可取消，全部删除后可退出，切换模式清空临时选择',t=>{
  const {w,d,$,rightClick,menuClick}=setup(t);
  rightClick($('#bookmarks'));menuClick('编辑模式');
  $('#dock-select-all').click();
  assert.equal(d.querySelectorAll('[data-dock-select]:checked').length,12);
  assert.equal($('#dock-select-all').textContent,'取消全选');
  $('#dock-select-all').click();
  assert.equal(d.querySelectorAll('[data-dock-select]:checked').length,0);
  $('#dock-select-all').click();
  w.QiPageLayout.setMode('expanded');
  assert.equal(d.body.classList.contains('dock-editing'),false);
  w.QiPageLayout.setMode('minimal');
  rightClick($('#bookmarks'));menuClick('编辑模式');
  assert.equal($('#dock-selection-count').textContent,'已选 0 项');
  $('#dock-select-all').click();$('#dock-delete-selected').click();$('#confirm-action').click();
  assert.equal(d.querySelectorAll('[data-bookmark-id]').length,0);
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.length,0);
  rightClick($('#bookmarks'));menuClick('退出编辑模式');
  assert.equal($('#dock-edit-toolbar').hidden,true);
});

test('默认极简，自动聚焦不自动模糊背景；点击和输入才触发聚焦效果',t=>{
  const {w,d,$,input}=setup(t);
  assert.equal(w.QiPageLayout.getMode(),'minimal');assert.equal(d.activeElement,$('#search'));
  assert.equal(d.body.classList.contains('search-focused'),false);
  $('#search').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
  assert.equal(d.body.classList.contains('search-focused'),true);
  d.body.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
  assert.equal(d.body.classList.contains('search-focused'),false);
  input($('#search'),'正在搜索');assert.equal(d.body.classList.contains('search-focused'),true);
});

test('右键只打开菜单，点击展开操作才切换完整主页',t=>{
  const {w,d,$,rightClick,menuClick}=setup(t);
  assert.deepEqual(rightClick($('#search')),['复制','粘贴','剪切','转到']);
  assert.equal(w.QiPageLayout.getMode(),'minimal');
  const actions=rightClick(d.body);
  assert.equal(w.QiPageLayout.getMode(),'minimal');
  for(const label of ['展开完整主页','添加快捷方式','管理网址与分组','管理搜索引擎','更换壁纸','个性化设置'])assert.ok(actions.includes(label));
  menuClick('展开完整主页');assert.equal(w.QiPageLayout.getMode(),'expanded');
  rightClick(d.body);menuClick('收起为极简主页');assert.equal(w.QiPageLayout.getMode(),'minimal');
});

test('右键快捷方式可直接编辑原网址',t=>{
  const {$,rightClick,menuClick}=setup(t);
  const bookmark=$('[data-bookmark-id]');
  assert.ok(rightClick(bookmark).includes('编辑此快捷方式'));
  menuClick('编辑此快捷方式');
  assert.equal($('#bookmark-dialog').open,true);assert.equal($('#bookmark-name').value,'GitHub');
});

test('复制和剪切使用打开菜单前的选区，剪切后保存正确内容',async t=>{
  const {$,copied,rightClick,menuClick,input}=setup(t);
  input($('#search'),'hello world');$('#search').setSelectionRange(0,5);
  rightClick($('#search'));menuClick('复制');await flush();assert.equal(copied.at(-1),'hello');
  $('#search').setSelectionRange(6,11);rightClick($('#search'));menuClick('剪切');await flush();
  assert.equal(copied.at(-1),'world');assert.equal($('#search').value,'hello ');
});

test('粘贴替换原选区，转到使用选中文字并通过现有安全搜索逻辑',async t=>{
  const {$,rightClick,menuClick,input,opened}=setup(t);
  input($('#search'),'a replace b');$('#search').setSelectionRange(2,9);
  rightClick($('#search'));menuClick('粘贴');await flush();assert.equal($('#search').value,'a 粘贴内容 b');
  input($('#search'),'before example.com after');$('#search').setSelectionRange(7,18);
  rightClick($('#search'));menuClick('转到');
  assert.equal(opened.at(-1)[0],'https://example.com/');
});

test('剪贴板读取失败时提供手动粘贴窗口，确认后插入原选区',async t=>{
  const {w,$,rightClick,menuClick,input}=setup(t,{clipboardDenied:true});
  input($('#search'),'a old b');$('#search').setSelectionRange(2,5);
  rightClick($('#search'));menuClick('粘贴');await flush();assert.equal($('#paste-dialog').open,true);
  $('#paste-content').value='手动粘贴';
  $('#paste-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal($('#search').value,'a 手动粘贴 b');assert.equal($('#paste-dialog').open,false);
});

test('无选区时复制剪切禁用，空输入时转到禁用',t=>{
  const {$,rightClick}=setup(t);rightClick($('#search'));
  const buttons=[...$('#context-menu').querySelectorAll('button')];
  assert.deepEqual(buttons.map(b=>b.disabled),[true,false,true,true]);
});

test('Esc 分别关闭右键菜单、聚焦效果及完整模式；Alt+Z 可切换',t=>{
  const {w,d,$,rightClick,key}=setup(t);
  rightClick($('#search'));key('Escape');assert.equal($('#context-menu').hidden,true);
  key('Escape');assert.equal(d.body.classList.contains('search-focused'),false);
  w.QiPageLayout.setMode('expanded');key('Escape');assert.equal(w.QiPageLayout.getMode(),'minimal');
  key('z',{altKey:true,code:'KeyZ'});assert.equal(w.QiPageLayout.getMode(),'expanded');
});

test('弹窗右键菜单位于同一弹窗顶层，关闭操作不泄漏为浏览器菜单',t=>{
  const {$,rightClick,menuClick}=setup(t);
  $('#settings-open').click();assert.equal($('#settings-dialog').open,true);
  assert.deepEqual(rightClick($('#settings-dialog')),['关闭当前窗口']);
  assert.equal($('#context-menu').parentElement,$('#settings-dialog'));
  menuClick('关闭当前窗口');assert.equal($('#settings-dialog').open,false);
});

test('完整模式的便签提供编辑菜单，粘贴后自动持久保存',async t=>{
  const {w,$,rightClick,menuClick,input}=setup(t);
  w.QiPageLayout.setMode('expanded');input($('#notes'),'便签');$('#notes').setSelectionRange(2,2);
  rightClick($('#notes'));menuClick('粘贴');await flush();
  assert.equal($('#notes').value,'便签粘贴内容');
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).notes,'便签粘贴内容');
});

test('右键可打开引擎管理，新增引擎真实接入搜索和备份数据',t=>{
  const {w,d,$,rightClick,menuClick,input,opened}=setup(t);
  rightClick(d.body);menuClick('管理搜索引擎');assert.equal($('#engine-manager-dialog').open,true);
  $('#engine-add').click();$('#custom-engine-name').value='测试搜索';$('#custom-engine-key').value='cs';$('#custom-engine-url').value='https://example.com/?q={query}';
  $('#engine-editor-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal($('#engine-editor-dialog').open,false);
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).engines.length,19);
  $('#engine-manager-dialog').close();input($('#search'),'cs 中文');$('#search-form').requestSubmit();
  assert.equal(opened.at(-1)[0],'https://example.com/?q=%E4%B8%AD%E6%96%87');
});

test('时钟显示时分秒及三位毫秒，按实际时间更新且搜索聚焦不替换时钟区域',t=>{
  const {w,d,$,tick,input}=setup(t,{now:new Date(2026,9,28,11,4,5,7).getTime()});
  const clock=$('#clock-region'),millis=$('#clock-milliseconds');
  assert.equal($('#clock-hours').textContent,'11');assert.equal($('#clock-minutes').textContent,'04');assert.equal($('#clock-seconds').textContent,'05');assert.equal(millis.textContent,'007');
  assert.match($('#date').textContent,/2026年10月28日/);
  input($('#search'),'搜索');tick(16);assert.equal(millis.textContent,'023');
  tick(1000);assert.equal($('#clock-seconds').textContent,'06');assert.equal(millis.textContent,'023');
  assert.equal($('#clock-region'),clock);assert.equal($('#clock-milliseconds'),millis);assert.equal(clock.closest('#search-form'),null);
  assert.equal(d.body.classList.contains('search-focused'),true);
  w.QiPageLayout.setMode('expanded');assert.equal($('#clock-region'),clock);
});

test('时钟跨午夜同步日期；从后台返回后立即校准，不累积后台延迟',t=>{
  const {w,d,$,tick}=setup(t,{now:new Date(2026,9,28,23,59,59,999).getTime()});
  tick(1);assert.equal($('#clock-hours').textContent,'00');assert.equal($('#clock-milliseconds').textContent,'000');assert.match($('#date').textContent,/10月29日/);
  Object.defineProperty(d,'hidden',{configurable:true,value:true});d.dispatchEvent(new w.Event('visibilitychange'));
  tick(2345);assert.equal($('#clock-seconds').textContent,'00');
  Object.defineProperty(d,'hidden',{configurable:true,value:false});d.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal($('#clock-seconds').textContent,'02');assert.equal($('#clock-milliseconds').textContent,'345');
});

test('展开入口位于页面顶层，不再占据底部 Dock',t=>{
  const {w,d,$}=setup(t);
  assert.equal($('#expand-home').parentElement,d.body);
  assert.equal($('.shortcut-strip').contains($('#expand-home')),false);
  $('#expand-home').click();assert.equal(w.QiPageLayout.getMode(),'expanded');
});

test('Dock 按指针距离放大相邻图标并分配横向间距，离开或切换模式后复位',t=>{
  const {w,$,tick}=setup(t);
  const items=[...$('#bookmarks').querySelectorAll('.bookmark:not(.bookmark-add-item)')];
  items.forEach((item,index)=>item.getBoundingClientRect=()=>({left:100+index*54,width:42,height:42}));
  $('#bookmarks').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:283}));tick(16);
  const scale=index=>Number(items[index].style.getPropertyValue('--dock-scale')||1);
  assert.equal(scale(3),1.65);assert.ok(scale(2)>scale(1));assert.ok(scale(2)<scale(3));assert.equal(scale(0),1);
  assert.ok(parseFloat(items[0].style.getPropertyValue('--dock-shift'))<0);
  assert.ok(parseFloat(items[6].style.getPropertyValue('--dock-shift'))>0);
  $('#bookmarks').dispatchEvent(new w.Event('pointerleave'));assert.equal(scale(3),1);
  $('#bookmarks').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:283}));tick(16);assert.equal(scale(3),1.65);
  w.QiPageLayout.setMode('expanded');assert.equal(scale(3),1);
  $('#bookmarks').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:283}));tick(16);
  assert.equal($('#bookmarks').classList.contains('dock-active'),false);
});

test('触摸操作不触发 Dock 放大，打开右键菜单会复位动画',t=>{
  const {w,$,tick,rightClick}=setup(t);
  const items=[...$('#bookmarks').querySelectorAll('.bookmark:not(.bookmark-add-item)')];
  items.forEach((item,index)=>item.getBoundingClientRect=()=>({left:100+index*54,width:42,height:42}));
  const touch=new w.MouseEvent('pointermove',{bubbles:true,clientX:283});Object.defineProperty(touch,'pointerType',{value:'touch'});
  $('#bookmarks').dispatchEvent(touch);tick(16);assert.equal($('#bookmarks').classList.contains('dock-active'),false);
  $('#bookmarks').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:283}));tick(16);assert.equal($('#bookmarks').classList.contains('dock-active'),true);
  rightClick(items[3].querySelector('a'));assert.equal($('#bookmarks').classList.contains('dock-active'),false);
});

test('搜索框、引擎菜单、快捷栏与常见网站 Dock 使用本地图形',t=>{
  const {$}=setup(t);
  assert.ok($('#engine-symbol svg.engine-glyph'));
  assert.equal($('#engine-menu').querySelectorAll('.engine-badge svg').length,18);
  assert.equal($('#engine-tabs').querySelectorAll('svg.engine-glyph').length,7);
  assert.ok($('#bookmarks [aria-label="GitHub"] svg.engine-glyph'));
  assert.equal($('#bookmarks [aria-label="GitHub"] img'),null);
});

test('编辑引擎可选择图形并持久保存，输入自定义 Emoji 可切换回字符模式',t=>{
  const {w,$,input}=setup(t);
  $('#engine-settings-open').click();
  $('#engine-manager-list [data-engine-action="edit"][data-id="google"]').click();
  assert.equal($('#engine-icon-picker').querySelectorAll('button').length,24);
  $('#engine-icon-picker [data-engine-icon="globe"]').click();
  $('#engine-editor-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).engines[0].icon,'globe');
  $('#engine-manager-list [data-engine-action="edit"][data-id="google"]').click();
  input($('#custom-engine-symbol'),'🌿');
  assert.equal($('#custom-engine-preview').textContent,'🌿');
  $('#engine-editor-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  const engine=JSON.parse(w.localStorage.getItem('qipage.v1')).engines[0];assert.equal(engine.icon,'symbol');assert.equal(engine.symbol,'🌿');
  assert.equal($('#engine-symbol').textContent,'🌿');
});

test('所有 Dock 快捷方式使用统一本地图形，新增未知网址也没有彩色 img',async t=>{
  const {w,$}=setup(t);
  assert.equal($('#bookmarks').querySelectorAll('img').length,0);
  assert.equal($('#bookmarks').querySelectorAll('.unified-bookmark-icon svg').length,12);
  $('#add-bookmark').click();$('#bookmark-name').value='新站点';$('#bookmark-url').value='https://unknown.example';
  $('#bookmark-icon-picker [data-bookmark-glyph="code"]').click();
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  assert.equal($('#bookmarks').querySelectorAll('img').length,0);
  assert.ok($('#bookmarks [aria-label="新站点"] .unified-bookmark-icon svg'));
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.at(-1).glyph,'code');
});

test('上传保留原色缩略图并生成单色蒙版，Dock 不渲染原色图片，清除后恢复自动图形',async t=>{
  const {w,$,rightClick,menuClick}=setup(t);
  const original='data:image/png;base64,U09VUkNF',mask='data:image/png;base64,TUFTSw==';
  const pixels=new w.Uint8ClampedArray(128*128*4).fill(255);
  for(let y=32;y<96;y++)for(let x=32;x<96;x++){const at=(y*128+x)*4;pixels[at+1]=10;pixels[at+2]=30;}
  let exported=0,maskPixels;
  w.createImageBitmap=async()=>({width:128,height:128,close(){}});
  w.ImageData=class{constructor(data){this.data=data;}};
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},clearRect(){},getImageData:()=>({data:pixels}),putImageData:image=>{maskPixels=image.data;}});
  w.HTMLCanvasElement.prototype.toDataURL=()=>exported++===0?original:mask;
  $('#add-bookmark').click();$('#bookmark-name').value='自定义上传';$('#bookmark-url').value='https://upload.example';
  Object.defineProperty($('#bookmark-icon'),'files',{configurable:true,value:[new w.File(['file'],'logo.png',{type:'image/png'})]});
  $('#bookmark-icon').onchange();await flush();assert.ok($('#bookmark-icon-preview .bookmark-upload-mask'));
  assert.equal(maskPixels[(64*128+64)*4],255);assert.equal(maskPixels[3],0);
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  const bookmark=JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.at(-1);
  assert.equal(bookmark.icon,original);assert.equal(bookmark.iconMask,mask);
  assert.equal($('#bookmarks').querySelectorAll('img').length,0);
  assert.ok($('#bookmarks [aria-label="自定义上传"] .bookmark-upload-mask').style.getPropertyValue('--bookmark-mask').includes('TUFTSw=='));
  rightClick($('#bookmarks [aria-label="自定义上传"]'));menuClick('编辑此快捷方式');$('#remove-icon').click();
  $('#bookmark-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).bookmarks.at(-1).icon,'');
  assert.ok($('#bookmarks [aria-label="自定义上传"] svg.engine-glyph'));
});

test('Dock 悬停与键盘聚焦显示浮动网站名称，移开和右键时隐藏',t=>{
  const {w,$,rightClick}=setup(t);const anchor=$('#bookmarks [aria-label="GitHub"]');
  anchor.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:200}));
  assert.equal($('#dock-tooltip').hidden,false);assert.equal($('#dock-tooltip').textContent,'GitHub');
  assert.equal(anchor.getAttribute('aria-describedby'),'dock-tooltip');assert.equal(anchor.title,'');
  $('#bookmarks').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:200}));assert.equal($('#dock-tooltip').hidden,true);
  anchor.focus();assert.equal($('#dock-tooltip').hidden,false);
  $('#bookmarks').dispatchEvent(new w.Event('pointerleave'));assert.equal($('#dock-tooltip').hidden,true);
  anchor.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:200}));rightClick(anchor);assert.equal($('#dock-tooltip').hidden,true);
});

test('Dock 下方网站名称开关持久保存，与浮动名称独立',t=>{
  const {w,d,$}=setup(t);assert.equal(d.body.classList.contains('dock-show-names'),false);
  $('#dock-settings-open').click();$('#dock-show-names').checked=true;$('#dock-show-names').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(d.body.classList.contains('dock-show-names'),true);$('#dock-save').click();assert.equal(JSON.parse(w.localStorage.getItem('qipage.v1')).dockShowNames,true);
  $('#dock-settings-open').click();
  assert.equal($('#bookmarks').querySelectorAll('.dock-item-name').length,12);
  $('#dock-show-names').checked=false;$('#dock-show-names').dispatchEvent(new w.Event('change',{bubbles:true}));$('#dock-save').click();
  const anchor=$('#bookmarks [aria-label="GitHub"]');anchor.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:200}));
  assert.equal(d.body.classList.contains('dock-show-names'),false);assert.equal($('#dock-tooltip').hidden,false);
});
