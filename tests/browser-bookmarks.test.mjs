import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {JSDOM} from 'jsdom';
import '../core.js';

const read=name=>readFileSync(new URL(`../chrome-extension/${name}`,import.meta.url),'utf8');
const context=createContext({URL});runInContext(read('bookmarks.js'),context);
const transfer=context.QiPageBookmarkTransfer;
const {createDefaults,validateBackup,validateBrowserBookmarkFile,planBrowserBookmarkImport}=globalThis.QiPageCore;
const plain=value=>JSON.parse(JSON.stringify(value));
const payload=bookmarks=>({format:'qipage.browser-bookmarks',version:1,bookmarks});
const entry=(url,title='网站',path=['书签栏','工作','工具'])=>({url,title,path});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('扩展读取树保留路径和顺序，过滤危险协议、凭据和重复网址',()=>{
  const result=plain(transfer.collect([{title:'',children:[{title:'书签栏',children:[{title:'工作',children:[{title:'A',url:'https://a.example'},{title:'工具',children:[{title:'B',url:'https://b.example/path'}]}]},{title:'重复',url:'https://a.example/'},{title:'脚本',url:'javascript:alert(1)'},{title:'本地',url:'file:///D:/private.html'},{title:'凭据',url:'https://user:pass@example.com'}]}]}]));
  assert.equal(result.skipped,4);assert.equal(result.entries.length,2);
  assert.deepEqual(result.entries[1].path,['书签栏','工作','工具']);
  assert.deepEqual(validateBrowserBookmarkFile(plain(transfer.makeFile(result.entries))),result.entries);
  assert.throws(()=>transfer.makeFile([]));assert.throws(()=>transfer.makeFile(Array(501).fill(result.entries[0])));
});

test('书签导入只追加，保留原有数据与 Dock 顺序，路径和文件夹随备份恢复',()=>{
  const original=createDefaults();original.notes='保留便签';original.todos=[{id:'todo1',text:'保留待办',done:false}];original.themeColor='#8966a6';
  const before=JSON.stringify(original),file=payload([entry(original.bookmarks[0].url,'重复'),entry('https://a.example','A'),entry('https://b.example','B',['书签栏','生活'])]);
  const plan=planBrowserBookmarkImport(original,file);assert.equal(JSON.stringify(original),before);
  assert.equal(plan.added,2);assert.equal(plan.duplicates,1);assert.equal(plan.foldersAdded,4);
  assert.equal(plan.state.bookmarks.length,14);assert.equal(plan.state.notes,original.notes);assert.deepEqual(plan.state.todos,original.todos);assert.equal(plan.state.themeColor,original.themeColor);
  assert.deepEqual(plan.state.dockOrder.slice(0,12),original.bookmarks.map(b=>b.id));
  assert.deepEqual(plan.state.dockFolders[2].sourcePath,['书签栏','工作','工具']);
  assert.deepEqual(validateBackup(plain(plan.state)),plan.state);
  const again=planBrowserBookmarkImport(plan.state,file);assert.equal(again.added,0);assert.equal(again.duplicates,3);assert.equal(again.state.groups.length,plan.state.groups.length);
});

test('导入容量不足不会部分写入，可选择已有分组或不归类文件夹',()=>{
  const original=createDefaults(),file=payload([entry('https://new.example')]);
  original.dockFolders=Array.from({length:100},(_,index)=>({id:'folder'+index,name:'文件夹',bookmarkIds:[]}));
  let before=JSON.stringify(original);assert.throws(()=>planBrowserBookmarkImport(original,file),/文件夹/);assert.equal(JSON.stringify(original),before);
  assert.equal(planBrowserBookmarkImport(original,file,{keepFolders:false,groupId:'work'}).added,1);
  original.groups.push(...Array.from({length:27},(_,index)=>({id:'group'+index,name:'分组'+index})));
  assert.throws(()=>planBrowserBookmarkImport(original,file,{keepFolders:false}),/分组/);
  assert.equal(planBrowserBookmarkImport(original,file,{keepFolders:false,groupId:'work'}).state.groups.length,30);
  original.bookmarks=Array.from({length:500},(_,index)=>({id:'bookmark'+index,name:'网站',url:`https://old.example/${index}`,group:'work',icon:''}));
  before=JSON.stringify(original);assert.throws(()=>planBrowserBookmarkImport(original,file,{keepFolders:false,groupId:'work'}),/最多再导入 0/);assert.equal(JSON.stringify(original),before);
});

test('书签文件严格校验协议、格式、路径和数量',()=>{
  for(const file of [
    {},{...payload([]),format:'other'},payload([entry('javascript:alert(1)')]),payload([entry('https://user:pass@example.com')]),payload([{title:'缺少网址',path:[]}]),payload([entry('https://a.example','A',[''])]),payload([entry('https://a.example','A',Array(33).fill('folder'))]),payload(Array(501).fill(entry('https://a.example')))
  ])assert.throws(()=>validateBrowserBookmarkFile(file));
});

test('层级备份拒绝循环、悬空上级、子文件夹占据 Dock 和超深路径',()=>{
  const state=planBrowserBookmarkImport(createDefaults(),payload([entry('https://nested.example')])).state;
  assert.equal(state.dockFolders[1].parentId,state.dockFolders[0].id);
  assert.equal(state.dockFolders[2].parentId,state.dockFolders[1].id);
  assert.equal(state.dockOrder.includes(state.dockFolders[1].id),false);
  for(const mutate of [
    s=>s.dockFolders[0].parentId=s.dockFolders[2].id,
    s=>s.dockFolders[1].parentId='missing',
    s=>s.dockOrder.push(s.dockFolders[1].id)
  ]){const bad=plain(state);mutate(bad);assert.throws(()=>validateBackup(bad));}
  const deep=createDefaults();deep.dockFolders=Array.from({length:33},(_,i)=>({id:'f'+i,name:'目录',bookmarkIds:[],...(i?{parentId:'f'+(i-1)}:{})}));
  assert.throws(()=>validateBackup(deep),/层级/);
});

test('文件夹树支持整组选取、部分选择、同名目录和容量限制',t=>{
  const dom=new JSDOM('<div id="tree"></div>',{runScripts:'outside-only'});t.after(()=>dom.window.close());
  const w=dom.window,d=w.document;w.eval(read('bookmark-tree.js'));
  const entries=[entry('https://a.example','A',['工作','工具']),entry('https://b.example','B',['工作','工具']),entry('https://c.example','C',['生活','工具'])];
  const selected=new Set([0]);let limited=0;
  const tree=w.QiPageBookmarkTree.mount(d.querySelector('#tree'),entries,selected,()=>{},2,()=>limited++);
  const root=d.querySelector('summary input');assert.equal(root.indeterminate,true);
  root.click();assert.deepEqual([...selected],[0,1]);assert.equal(root.checked,true);
  d.querySelector('input[data-bookmark-index="1"]').click();assert.equal(root.indeterminate,true);
  selected.add(1);tree.sync();
  d.querySelector('input[data-bookmark-index="2"]').click();assert.equal(limited,1);assert.deepEqual([...selected],[0,1]);
  root.click();assert.equal(selected.size,0);assert.equal(root.checked,false);
});

test('扩展只在点击时申请书签权限，拒绝不读取，授权后预览并下载',async t=>{
  const dom=new JSDOM(read('options.html'),{runScripts:'outside-only',url:'https://extension.test/'});t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,calls=[];let allowed=false,downloaded,filename;
  w.chrome={permissions:{request:async options=>{calls.push(['permission',plain(options)]);return allowed;}},bookmarks:{getTree:async()=>{calls.push(['read']);return [{title:'书签栏',children:[{title:'<img src=x onerror=alert(1)>',url:'https://safe.example'}]}];}},tabs:{create:async()=>{}},runtime:{getURL:path=>'chrome-extension://id/'+path}};
  w.Blob=Blob;w.URL.createObjectURL=blob=>{downloaded=blob;return 'blob:bookmarks';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){filename=this.download;};
  w.eval(read('bookmarks.js'));w.eval(read('bookmark-tree.js'));w.eval(read('bookmark-options.js'));assert.equal(calls.length,0);
  d.querySelector('#read-bookmarks').click();await flush();assert.equal(calls.length,1);assert.match(d.querySelector('#bookmarks-status').textContent,/未授权/);
  allowed=true;d.querySelector('#read-bookmarks').click();await flush();
  assert.equal(calls[2][0],'read');assert.equal(d.querySelector('#bookmarks-list img'),null);
  assert.equal(d.querySelector('#bookmarks-list b').textContent,'<img src=x onerror=alert(1)>');
  d.querySelector('#bookmarks-clear').click();assert.ok(d.querySelector('#bookmarks-download').disabled);
  d.querySelector('#bookmarks-select-all').click();d.querySelector('#bookmarks-download').click();
  assert.equal(filename,'栖页-浏览器书签.json');assert.equal(JSON.parse(await downloaded.text()).bookmarks[0].url,'https://safe.example/');
});
