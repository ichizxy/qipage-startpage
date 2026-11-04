(() => {
'use strict';
const {ENGINES,ENGINE_ICON_IDS,BOOKMARK_ICON_IDS,resolveBookmarkIcon,buildMonochromeMask,uid,normalizeUrl,searchTarget,createDefaults,validateBackup,validateEngines,coarseLocation,secondsLeft,weatherLabel} = globalThis.QiPageCore;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const paths={search:'m21 21-4.8-4.8 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',settings:'m12 3 2 3 3-.2.5 3.2 2.5 2-2 2.5.2 3.2-3.2.5-2 2.5-2.5-2-3.2.2-.5-3.2-2.5-2 2-2.5-.2-3.2 3.2-.5Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',maximize:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',minimize:'M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5','chevron-down':'m7 10 5 5 5-5',plus:'M12 5v14M5 12h14',sliders:'M4 7h8m4 0h4M4 17h3m4 0h9 M12 4v6 M7 14v6',refresh:'M20 7a8 8 0 1 0 0 10M20 3v5h-5',pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0 M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5','cloud-sun':'M12 3v2M3 12h2m0-7 1.5 1.5M19 5l-1.5 1.5M15 9a5 5 0 1 0-7 7M8 20h10a4 4 0 1 0-1-8 5 5 0 0 0-9 2 3 3 0 0 0 0 6',cloud:'M6 19h12a4 4 0 1 0-1-8A6 6 0 0 0 5 11a4 4 0 0 0 1 8',rain:'M5 16a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4 4 0 0 1 2 8M8 17l-1 3m6-3-1 3m6-3-1 3',snow:'M5 15a4 4 0 0 1 0-7 6 6 0 0 1 11-1 4 4 0 0 1 2 8M8 19v2m-1-1h2m6-1v2m-1-1h2',storm:'M5 16a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4 4 0 0 1 2 8m-6-3-3 5h5l-3 5','check-square':'M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8M9 10l3 3L21 4',sweep:'m7 4 10 10m0-10L6 15l-2 5h8l5-6M5 17l4 3 M16 20h5',timer:'M9 2h6m-3 0v3m7 1 2 2M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0M12 9v5l3 2',play:'m9 5 11 7-11 7Z',pause:'M8 5v14M16 5v14',note:'M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h5',sparkles:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4',image:'M3 3h18v18H3ZM3 17l6-6 5 5 3-3 4 4M16 7h.01',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',download:'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',x:'m6 6 12 12M6 18 18 6','arrow-right':'M4 12h16m-6-6 6 6-6 6',edit:'m4 16 12-12 4 4L8 20H4Zm10-10 4 4'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.plus}"/></svg>`;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='qipage.v1';
let state=createDefaults(),storageAvailable=true,restoreWarning='';
try{const saved=localStorage.getItem(KEY);if(saved){state=validateBackup(JSON.parse(saved));if(saved!==JSON.stringify(state))localStorage.setItem(KEY,JSON.stringify(state));}}catch{restoreWarning='本地数据读取失败，已使用默认设置。可从备份恢复。';}
let engineIconChoice='search',bookmarkGlyph='auto',customIconMask='',pendingBookmarkIcon=null,bookmarkIconRequest=0;
let websiteIconEnabled=false,websiteIconUrl='',websiteIconTimer=null,websiteIconController=null,bookmarkEditorSession=0,bookmarkAutoName='',bookmarkNameTouched=false,websiteIconGray=20;
const pendingMasks=new Map(),failedMasks=new Set();
const dockControls={'dock-position':'dockPosition','dock-movable':'dockMovable','dock-x':'dockX','dock-y':'dockY','dock-size':'dockSize','dock-gap':'dockGap','dock-width':'dockWidth','dock-opacity':'dockOpacity','dock-zoom':'dockZoom','dock-scale':'dockScale','dock-radius':'dockRadius','dock-speed':'dockSpeed','dock-show-names':'dockShowNames','dock-name-size':'dockNameSize','dock-tooltip-enabled':'dockTooltip'};
let dockDraft=null;
const savedDockSettings=()=>Object.fromEntries(Object.keys(globalThis.QiPageCore.DOCK_DEFAULTS).map(key=>[key,state[key]]));
const dockSettings=()=>dockDraft||savedDockSettings();
globalThis.QiPageDock=Object.freeze({getSettings:()=>({...dockSettings()})});
function applyDockPreferences(){
  const state=dockSettings();
  document.body.classList.toggle('dock-show-names',state.dockShowNames);
  const style=document.documentElement.style;
  for(const [key,value]of Object.entries({size:state.dockSize,gap:state.dockGap,width:state.dockWidth,speed:state.dockSpeed}))style.setProperty(`--dock-${key}`,`${value}${key==='speed'?'ms':'px'}`);
  style.setProperty('--dock-name-size',`${state.dockNameSize}px`);
  style.setProperty('--dock-name-space',`${Math.ceil(state.dockNameSize*1.5*(state.dockZoom?state.dockScale:1)+14)}px`);
  style.setProperty('--dock-tray-alpha',state.dockOpacity/100);
  style.setProperty('--dock-headroom',`${Math.ceil(state.dockSize*(state.dockScale-1)+20)}px`);
  document.body.classList.toggle('dock-movable',state.dockMovable);
  document.body.classList.toggle('dock-no-zoom',!state.dockZoom);
  document.dispatchEvent(new CustomEvent('qipage:dock-preferences'));
}
function syncDockSettings(){
  const state=dockSettings();
  for(const [id,key]of Object.entries(dockControls)){
    const input=$(`#${id}`);if(input.type==='checkbox')input.checked=state[key];else input.value=state[key];
    const output=$(`#${id}-value`);if(output)output.value=Number(state[key]).toFixed(2);
  }
  for(const id of ['dock-scale','dock-radius','dock-speed']){$(`#${id}`).disabled=!state.dockZoom;$(`#${id}-value`).disabled=!state.dockZoom;}
}
function openDockSettings(){if(!dockDraft)dockDraft=savedDockSettings();syncDockSettings();openDialog('#dock-settings-dialog');}
function requestCloseDockSettings(){
  if(dockDraft&&Object.keys(dockDraft).some(key=>dockDraft[key]!==state[key]))openDialog('#dock-save-dialog');
  else $('#dock-settings-dialog').close();
}
function saveDockSettings(){
  const previous=savedDockSettings();Object.assign(state,dockDraft);
  if(!persist()){Object.assign(state,previous);return;}
  dockDraft=null;$('#dock-save-dialog').close();$('#dock-settings-dialog').close();
}
$('#dock-save').onclick=$('#dock-confirm-save').onclick=saveDockSettings;
$('#dock-discard').onclick=()=>{$('#dock-save-dialog').close();$('#dock-settings-dialog').close();};
$('#dock-settings-dialog').addEventListener('cancel',event=>{event.preventDefault();requestCloseDockSettings();});
$('#dock-settings-dialog').addEventListener('close',()=>{dockDraft=null;applyDockPreferences();syncDockSettings();});
document.addEventListener('qipage:close-dock-settings',requestCloseDockSettings);
$('#dock-settings-open').onclick=openDockSettings;
for(const [id,key]of Object.entries(dockControls)){
  const input=$(`#${id}`);
  const update=()=>{
    const state=dockDraft;if(!state)return;
    state[key]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
    if(id==='dock-position'&&state.dockPosition!=='custom'){
      const [x,y]={bottom:[50,100],top:[50,0],left:[0,50],right:[100,50]}[state.dockPosition];state.dockX=x;state.dockY=y;
    }
    if(id==='dock-x'||id==='dock-y')state.dockPosition='custom';
    applyDockPreferences();syncDockSettings();
  };
  input.addEventListener(input.type==='range'?'input':'change',update);
  if(input.type==='range'){
    const number=$(`#${id}-value`),[min,max]=globalThis.QiPageCore.DOCK_RANGES[key];
    for(const control of [input,number]){control.min=min;control.max=max;control.step='0.01';}
    number.addEventListener('input',()=>{
      const value=number.valueAsNumber;
      if(!Number.isFinite(value)||value<min||value>max)return;
      input.value=Number(value.toFixed(2));
      // 输入时保留光标，失焦后统一补齐两位小数。
      const text=number.value;update();number.value=text;
    });
    number.addEventListener('change',syncDockSettings);
    number.addEventListener('blur',syncDockSettings);
  }
}
$('#dock-reset').onclick=()=>{Object.assign(dockDraft,globalThis.QiPageCore.DOCK_DEFAULTS);applyDockPreferences();syncDockSettings();};
document.addEventListener('qipage:dock-position',event=>{
  const {x,y}=event.detail||{};if(!Number.isFinite(x)||!Number.isFinite(y))return;
  state.dockPosition='custom';state.dockX=Math.max(0,Math.min(100,x));state.dockY=Math.max(0,Math.min(100,y));persist();applyPreferences();syncDockSettings();
});
let dockEditing=false;
const dockSelection=new Set();
let dockSort=null,dockSortFrame=null,suppressDockSortClick=false;
let dockHold=null;
function cancelDockHold(){if(dockHold)clearTimeout(dockHold.timer);dockHold=null;}
$('#bookmarks').addEventListener('pointerdown',event=>{
  cancelDockHold();if(dockEditing||event.button!==0||document.body.dataset.view!=='minimal'||$('dialog[open]'))return;
  const anchor=event.target.closest('[data-dock-id]');if(!anchor)return;
  const id=anchor.dataset.dockId,x=event.clientX,y=event.clientY,pointerId=event.pointerId;
  dockHold={x,y,pointerId,timer:setTimeout(()=>{
    cancelDockHold();setDockEditing(true);suppressDockSortClick=true;
    const current=[...$('#bookmarks').querySelectorAll('[data-dock-id]')].find(item=>item.dataset.dockId===id);if(!current)return;
    const rect=current.getBoundingClientRect(),captureTarget=$('#bookmarks');
    dockSort={anchor:current,captureTarget,item:current.closest('.bookmark'),pointerId,startX:x,startY:y,x,y,offsetX:x-rect.left,offsetY:y-rect.top,active:false};
    captureTarget.setPointerCapture?.(pointerId);
  },450)};
});
document.addEventListener('pointermove',event=>{if(dockHold&&Math.hypot(event.clientX-dockHold.x,event.clientY-dockHold.y)>8)cancelDockHold();});
for(const type of ['pointerup','pointercancel','contextmenu'])document.addEventListener(type,cancelDockHold);
window.addEventListener('blur',cancelDockHold);
document.addEventListener('qipage:layoutchange',cancelDockHold);
function clearDockSort(){
  const sort=dockSort;dockSort=null;
  if(dockSortFrame!==null)cancelAnimationFrame(dockSortFrame);dockSortFrame=null;
  sort?.ghost?.remove();sort?.item.classList.remove('dock-sort-source');
  document.body.classList.remove('dock-sorting');
  if(sort?.captureTarget.hasPointerCapture?.(sort.pointerId))sort.captureTarget.releasePointerCapture(sort.pointerId);
  return sort;
}
function cancelDockSort(){const sort=clearDockSort();if(sort?.active){suppressDockSortClick=true;renderBookmarks();}}
function moveDockSort(x){
  if(!dockSort?.active)return;
  const items=[...$('#bookmarks').querySelectorAll('.bookmark:not(.bookmark-add-item)')].filter(item=>item!==dockSort.item);
  const next=items.find(item=>{const r=item.getBoundingClientRect();return x<r.left+r.width/2;});
  $('#bookmarks').insertBefore(dockSort.item,next||$('.bookmark-add-item'));
}
function scrollDockSort(){
  dockSortFrame=null;if(!dockSort?.active)return;
  const grid=$('#bookmarks'),r=grid.getBoundingClientRect(),x=dockSort.x,y=dockSort.y;
  if(y>=r.top-24&&y<=r.bottom+24){
    const step=x<r.left+36?-Math.min(14,(r.left+36-x)/3):x>r.right-36?Math.min(14,(x-r.right+36)/3):0;
    if(step){const before=grid.scrollLeft;grid.scrollLeft+=step;if(grid.scrollLeft!==before)moveDockSort(x);}
  }
  dockSortFrame=requestAnimationFrame(scrollDockSort);
}
$('#bookmarks').addEventListener('pointerdown',event=>{
  suppressDockSortClick=false;
  if(dockSort)return;
  if(!dockEditing||event.button!==0||$('dialog[open]'))return;
  const anchor=event.target.closest('[data-dock-id]');if(!anchor)return;
  const rect=anchor.getBoundingClientRect();
  // 排序会移动图标节点，由固定容器捕获指针，避免移动节点导致丢失捕获并取消排序。
  const captureTarget=event.currentTarget;
  dockSort={anchor,captureTarget,item:anchor.closest('.bookmark'),pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,active:false};
  captureTarget.setPointerCapture?.(event.pointerId);
});
document.addEventListener('pointermove',event=>{
  const sort=dockSort;if(!sort||event.pointerId!==sort.pointerId)return;
  sort.x=event.clientX;sort.y=event.clientY;
  if(!sort.active&&Math.hypot(sort.x-sort.startX,sort.y-sort.startY)<6)return;
  event.preventDefault();
  if(!sort.active){
    $('#dock-order-status').textContent='';
    sort.active=true;document.body.classList.add('dock-sorting');globalThis.QiPageLayout?.clearFocus();
    sort.item.classList.add('dock-sort-source');
    sort.ghost=document.createElement('div');sort.ghost.className='dock-sort-ghost';sort.ghost.setAttribute('aria-hidden','true');sort.ghost.append(sort.anchor.querySelector('.site-icon').cloneNode(true));document.body.append(sort.ghost);
    dockSortFrame=requestAnimationFrame(scrollDockSort);
  }
  sort.ghost.style.left=`${sort.x-sort.offsetX}px`;sort.ghost.style.top=`${sort.y-sort.offsetY}px`;
  const bounds=$('#bookmarks').getBoundingClientRect();
  const inside=sort.x>=bounds.left-24&&sort.x<=bounds.right+24&&sort.y>=bounds.top-24&&sort.y<=bounds.bottom+24;
  sort.ghost.classList.toggle('outside-dock',!inside);if(inside)moveDockSort(sort.x);
},{passive:false});
document.addEventListener('pointerup',event=>{
  if(!dockSort||event.pointerId!==dockSort.pointerId)return;
  const bounds=$('#bookmarks').getBoundingClientRect();
  const inside=event.clientX>=bounds.left-24&&event.clientX<=bounds.right+24&&event.clientY>=bounds.top-24&&event.clientY<=bounds.bottom+24;
  if(!inside)return cancelDockSort();
  const sort=clearDockSort();if(!sort.active)return;
  suppressDockSortClick=true;
  const order=[...$('#bookmarks').querySelectorAll('[data-dock-id]')].map(anchor=>anchor.dataset.dockId);
  const previous=dockItems().map(item=>item.id);
  if(order.length===previous.length&&order.some((id,i)=>id!==previous[i])){
    state.dockOrder=order;
    const rank=new Map(order.map((id,index)=>[id,index]));state.bookmarks.sort((a,b)=>(rank.get(a.id)??order.length)-(rank.get(b.id)??order.length));
    if(persist())$('#dock-order-status').textContent='快捷方式顺序已保存';
  }
});
document.addEventListener('pointercancel',event=>{if(event.pointerId===dockSort?.pointerId)cancelDockSort();});
$('#bookmarks').addEventListener('lostpointercapture',event=>{if(event.pointerId===dockSort?.pointerId)cancelDockSort();});
$('#bookmarks').addEventListener('dragstart',event=>{if(dockEditing)event.preventDefault();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dockSort?.active){event.preventDefault();event.stopImmediatePropagation();cancelDockSort();}},true);
document.addEventListener('contextmenu',cancelDockSort,true);
window.addEventListener('blur',cancelDockSort);
window.addEventListener('resize',cancelDockSort);
function syncDockSelection(){
  const ids=new Set(dockItems().map(b=>b.id));
  for(const id of dockSelection)if(!ids.has(id))dockSelection.delete(id);
  document.body.classList.toggle('dock-editing',dockEditing);
  $('#dock-edit-toolbar').hidden=!dockEditing;
  $('#dock-selection-count').textContent=`已选 ${dockSelection.size} 项`;
  $('#dock-delete-selected').disabled=dockSelection.size===0;
  $('#dock-move-folder').innerHTML='<option value="">移入文件夹…</option>'+state.dockFolders.map(folder=>`<option value="${esc(folder.id)}">${esc(dockFolderLabel(folder))}</option>`).join('');
  $('#dock-move-folder').disabled=!state.dockFolders.length||!state.bookmarks.some(b=>dockSelection.has(b.id));
  $('#dock-select-all').textContent=ids.size&&dockSelection.size===ids.size?'取消全选':'全选';
  $('#bookmarks').querySelectorAll('[data-dock-select]').forEach(input=>{input.checked=dockSelection.has(input.dataset.dockSelect);input.closest('.bookmark').classList.toggle('dock-selected',input.checked);});
}
function setDockEditing(enabled){
  dockEditing=enabled;dockSelection.clear();
  globalThis.QiPageLayout?.clearFocus();
  renderBookmarks();
  if(enabled)$('#bookmarks [data-dock-select]')?.focus({preventScroll:true});
}
$('#dock-edit-done').onclick=()=>setDockEditing(false);
$('#dock-select-all').onclick=()=>{if(dockSelection.size===dockItems().length)dockSelection.clear();else dockItems().forEach(b=>dockSelection.add(b.id));syncDockSelection();};
$('#dock-delete-selected').onclick=()=>{
  const selected=new Set(dockSelection);
  if(!selected.size)return;
  confirmAction(`删除选中的 ${selected.size} 个快捷方式？`,'所选网址将删除；所选文件夹会解散，其中的网址保留并移回 Dock。',()=>{
    deleteWithUndo(`已删除 ${selected.size} 个快捷方式`,()=>{
      dissolveDockFolders(selected);
      state.bookmarks=state.bookmarks.filter(b=>!selected.has(b.id));
    });
  });
};
$('#bookmarks').addEventListener('click',event=>{
  if(suppressDockSortClick){event.preventDefault();event.stopImmediatePropagation();suppressDockSortClick=false;return;}
  const rename=event.target.closest('[data-dock-rename]');
  if(dockEditing&&rename){event.preventDefault();openDockRename(rename.dataset.dockRename);return;}
  const anchor=event.target.closest('[data-dock-id]');
  if(!dockEditing){if(anchor?.dataset.folderId){event.preventDefault();openDockFolder(anchor.dataset.folderId);}return;}
  if(anchor){event.preventDefault();const id=anchor.dataset.dockId;if(dockSelection.has(id))dockSelection.delete(id);else dockSelection.add(id);syncDockSelection();}
});
$('#bookmarks').addEventListener('auxclick',event=>{if(dockEditing&&event.target.closest('a'))event.preventDefault();});
$('#bookmarks').addEventListener('change',event=>{
  const input=event.target.closest('[data-dock-select]');
  if(!input||!dockEditing)return;
  if(input.checked)dockSelection.add(input.dataset.dockSelect);else dockSelection.delete(input.dataset.dockSelect);
  syncDockSelection();
});
let toastTimeout,managing=false,groupEdit=false,customIcon='',activeFeed='rss',feedRequest=0,weatherRequest=0,weatherCache=null,wallpaperObjectUrl=null,pendingImport=null,confirmCallback=null;
function currentDialog(){return document.activeElement?.closest('dialog[open]')||$$('dialog[open]').at(-1);}
function toast(message,undo){const element=$('#toast');(currentDialog()||document.body).append(element);element.textContent=message;if(undo){const button=document.createElement('button');button.type='button';button.textContent='撤回';button.className='toast-undo';button.onclick=undo;element.append(button);}element.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{element.hidden=true;element.replaceChildren();},undo?12000:4300);}
const bookmarkSnapshot=()=>JSON.parse(JSON.stringify({bookmarks:state.bookmarks,groups:state.groups,dockFolders:state.dockFolders,dockOrder:state.dockOrder,activeGroup:state.activeGroup}));
const bookmarkRevision=()=>JSON.stringify([state.bookmarks,state.groups,state.dockFolders,state.dockOrder]);
function deleteWithUndo(message,change,close=()=>{}){
  const before=bookmarkSnapshot();change();pruneDockFolders();
  if(!persist()){Object.assign(state,before);renderBookmarks();return;}
  const after=bookmarkRevision();dockSelection.clear();renderBookmarks();close();
  toast(message,()=>{
    if(bookmarkRevision()!==after)return toast('网址已发生其他修改，无法撤回此次删除');
    const current=bookmarkSnapshot();Object.assign(state,structuredClone(before));
    if(!persist()){Object.assign(state,current);renderBookmarks();return;}
    renderBookmarks();toast('已撤回删除');
  });
}
function persist(){pruneDockFolders();try{localStorage.setItem(KEY,JSON.stringify(state));storageAvailable=true;return true;}catch{storageAvailable=false;toast('浏览器存储已满或不可用，请立即导出备份；当前修改尚未持久保存。');return false;}}
function openDialog(id){globalThis.QiPageLayout?.clearFocus();$(id).showModal();}
function confirmAction(title,message,callback,label='确认删除'){$('#confirm-action').textContent=label;$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;confirmCallback=callback;openDialog('#confirm-dialog');}
function closeDialog(dialog){if(dialog.id==='dock-settings-dialog')requestCloseDockSettings();else dialog.close();}
$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>closeDialog(b.closest('dialog'))));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d);}}));
$$('dialog').forEach(d=>d.addEventListener('close',()=>{const message=d.querySelector('#toast');if(message)(currentDialog()||document.body).append(message);}));
$('#confirm-action').onclick=()=>{const fn=confirmCallback;confirmCallback=null;$('#confirm-dialog').close();fn?.();};

function engineGraphic(engine){return engine.icon==='symbol'?`<span class="engine-custom-symbol">${esc(engine.symbol)}</span>`:globalThis.QiPageEngineIcons.render(engine.icon||'search');}
const genericIconLabels={search:'搜索',globe:'网页',book:'阅读',shopping:'购物',code:'代码',sparkles:'灵感'};
function renderEngineIconPicker(){
  $('#engine-icon-picker').innerHTML=ENGINE_ICON_IDS.filter(id=>id!=='symbol').map(id=>{const name=ENGINES.find(engine=>engine.id===id)?.name||genericIconLabels[id];return `<button type="button" data-engine-icon="${id}" class="engine-icon-option engine-badge" aria-label="使用 ${esc(name)} 图标" title="${esc(name)}" aria-pressed="${engineIconChoice===id}">${globalThis.QiPageEngineIcons.render(id)}</button>`;}).join('');
  $('#custom-engine-preview').innerHTML=engineGraphic({icon:engineIconChoice,symbol:$('#custom-engine-symbol').value||'🔍'});
}
$('#engine-icon-picker').onclick=event=>{const button=event.target.closest('[data-engine-icon]');if(!button)return;engineIconChoice=button.dataset.engineIcon;$('#custom-engine-symbol').value='';renderEngineIconPicker();};
$('#custom-engine-symbol').addEventListener('input',event=>{engineIconChoice=event.target.value.trim()?'symbol':'search';renderEngineIconPicker();});

function renderEngines(){
  const current=state.engines.find(e=>e.id===state.engine)||state.engines[0];
  state.engine=current.id;
  $('#engine-symbol').innerHTML=engineGraphic(current);$('#engine-toggle').title=`当前引擎：${current.name}`;
  $('#search').placeholder=`在 ${current.name} 中搜索，或输入网址`;
  $('#engine-tabs').innerHTML=state.engines.filter(e=>e.pinned).map(e=>`<button type="button" data-engine="${esc(e.id)}" class="${state.engine===e.id?'active':''}" aria-pressed="${state.engine===e.id}">${engineGraphic(e)}<span>${esc(e.name)}</span></button>`).join('');
  $('#engine-menu').innerHTML=state.engines.map(e=>`<button type="button" data-engine="${esc(e.id)}" class="${state.engine===e.id?'selected':''}" aria-pressed="${state.engine===e.id}"><b class="engine-badge">${engineGraphic(e)}</b><span>${esc(e.name)}</span>${e.key?`<kbd>${esc(e.key)} + 空格</kbd>`:''}</button>`).join('')+'<button type="button" class="engine-menu-manage" data-engine-manage>⚙ 管理搜索引擎</button>';
  renderEngineManager();
}
function selectEngine(id){state.engine=id;persist();renderEngines();$('#engine-menu').hidden=true;$('#engine-toggle').setAttribute('aria-expanded','false');if(globalThis.QiPageLayout)globalThis.QiPageLayout.focusSearch();else $('#search').focus();}
$('#engine-toggle').onclick=()=>{const open=$('#engine-menu').hidden;$('#engine-menu').hidden=!open;$('#engine-toggle').setAttribute('aria-expanded',String(open));};
for(const id of ['#engine-tabs','#engine-menu'])$(id).onclick=e=>{if(e.target.closest('[data-engine-manage]'))return openEngineManager();const b=e.target.closest('[data-engine]');if(b)selectEngine(b.dataset.engine);};
document.addEventListener('click',e=>{if(!e.target.closest('#search-form')){$('#engine-menu').hidden=true;$('#engine-toggle').setAttribute('aria-expanded','false');}});
$('#search-form').onsubmit=e=>{e.preventDefault();const target=searchTarget($('#search').value,state.engine,state.engines);if(target){if(state.newTab)window.open(target,'_blank','noopener,noreferrer');else window.location.assign(target);}};
$('#search').addEventListener('input',e=>{if(e.isComposing)return;const match=e.target.value.match(/^(\w+) $/);const engine=match&&state.engines.find(n=>n.key&&n.key===match[1].toLowerCase());if(engine){selectEngine(engine.id);e.target.value='';}});
function openEngineManager(){$('#engine-menu').hidden=true;$('#engine-toggle').setAttribute('aria-expanded','false');renderEngineManager();openDialog('#engine-manager-dialog');}
$('#engine-manage-shortcut').onclick=$('#engine-settings-open').onclick=openEngineManager;
function renderEngineManager(){
  $('#engine-manager-count').textContent=`${state.engines.length} 个引擎 · ${state.engines.filter(e=>e.pinned).length} 个快捷入口`;
  $('#engine-manager-list').innerHTML=state.engines.map((engine,index)=>`<div class="engine-manager-item"><span class="engine-list-symbol engine-badge">${engineGraphic(engine)}</span><div class="engine-list-info"><b>${esc(engine.name)}</b><small>${engine.key?`${esc(engine.key)} + 空格`:'未设置快捷指令'} · ${esc(new URL(engine.url.replace('{query}','search')).hostname)}</small></div><label class="engine-pin-toggle"><input type="checkbox" data-engine-pin="${esc(engine.id)}" aria-label="在快捷栏显示 ${esc(engine.name)}" ${engine.pinned?'checked':''}>快捷栏</label><div class="engine-item-actions"><button type="button" data-engine-action="select" data-id="${esc(engine.id)}" aria-label="将 ${esc(engine.name)} 设为默认" class="engine-default ${state.engine===engine.id?'active':''}">${state.engine===engine.id?'默认':'设默认'}</button><button type="button" data-engine-action="up" data-id="${esc(engine.id)}" aria-label="上移 ${esc(engine.name)}" ${index===0?'disabled':''}>↑</button><button type="button" data-engine-action="down" data-id="${esc(engine.id)}" aria-label="下移 ${esc(engine.name)}" ${index===state.engines.length-1?'disabled':''}>↓</button><button type="button" data-engine-action="edit" data-id="${esc(engine.id)}" aria-label="编辑引擎 ${esc(engine.name)}">${icon('edit')}</button><button type="button" data-engine-action="delete" data-id="${esc(engine.id)}" aria-label="删除引擎 ${esc(engine.name)}" ${state.engines.length===1?'disabled':''}>${icon('x')}</button></div></div>`).join('');
}
function editEngine(id){const engine=state.engines.find(e=>e.id===id);$('#engine-editor-form').reset();$('#engine-editor-title').textContent=engine?'编辑搜索引擎':'新增搜索引擎';$('#custom-engine-id').value=engine?.id||'';$('#custom-engine-name').value=engine?.name||'';$('#custom-engine-symbol').value=engine?.icon==='symbol'?engine.symbol:'';engineIconChoice=engine?.icon||'search';renderEngineIconPicker();$('#custom-engine-key').value=engine?.key||'';$('#custom-engine-url').value=engine?.url||'';$('#custom-engine-pinned').checked=engine?.pinned??true;openDialog('#engine-editor-dialog');$('#custom-engine-name').focus();}
$('#engine-add').onclick=()=>editEngine();
$('#engine-editor-form').onsubmit=e=>{e.preventDefault();try{const name=$('#custom-engine-name').value.trim(),id=$('#custom-engine-id').value||`custom-${uid()}`;const draft={id,name,symbol:$('#custom-engine-symbol').value.trim()||'🔍',icon:engineIconChoice,key:$('#custom-engine-key').value.trim(),url:$('#custom-engine-url').value.trim(),pinned:$('#custom-engine-pinned').checked};const engines=state.engines.map(engine=>engine.id===id?draft:engine);if(!engines.some(engine=>engine.id===id))engines.push(draft);state.engines=validateEngines(engines);persist();renderEngines();$('#engine-editor-dialog').close();toast('搜索引擎已保存');}catch(error){toast(error.message);}};
$('#engine-manager-list').onchange=e=>{const engine=state.engines.find(engine=>engine.id===e.target.dataset.enginePin);if(engine){engine.pinned=e.target.checked;persist();renderEngines();}};
$('#engine-manager-list').onclick=e=>{const button=e.target.closest('[data-engine-action]');if(!button||button.disabled)return;const index=state.engines.findIndex(engine=>engine.id===button.dataset.id);if(index<0)return;const engine=state.engines[index],action=button.dataset.engineAction;if(action==='edit')return editEngine(engine.id);if(action==='delete'){if(state.engines.length===1)return toast('请至少保留一个搜索引擎');return confirmAction('删除搜索引擎？',`“${engine.name}”及其快捷指令将被移除。可通过 JSON 备份恢复。`,()=>{state.engines=state.engines.filter(item=>item.id!==engine.id);if(state.engine===engine.id)state.engine=state.engines[0].id;persist();renderEngines();toast('搜索引擎已删除');});}if(action==='select')state.engine=engine.id;else{const target=index+(action==='up'?-1:1);if(target<0||target>=state.engines.length)return;[state.engines[index],state.engines[target]]=[state.engines[target],state.engines[index]];}persist();renderEngines();};
$('#engine-restore').onclick=()=>confirmAction('恢复内置搜索引擎？','将恢复全部 18 个内置引擎，自定义引擎及编辑、排序会被替换。建议先导出 JSON 备份。',()=>{state.engines=ENGINES.map(engine=>({...engine}));if(!state.engines.some(engine=>engine.id===state.engine))state.engine=state.engines[0].id;persist();renderEngines();toast('已恢复内置搜索引擎');},'确认恢复');
const clockParts={hours:$('#clock-hours'),minutes:$('#clock-minutes'),seconds:$('#clock-seconds'),milliseconds:$('#clock-milliseconds')};
let clockFrame=null,lastClockDate='',lastClockSecond='';
function updateClock(){
  const now=new Date();
  const values={hours:String(now.getHours()).padStart(2,'0'),minutes:String(now.getMinutes()).padStart(2,'0'),seconds:String(now.getSeconds()).padStart(2,'0'),milliseconds:String(now.getMilliseconds()).padStart(3,'0')};
  for(const [part,value]of Object.entries(values))if(clockParts[part].textContent!==value)clockParts[part].textContent=value;
  const second=`${values.hours}:${values.minutes}:${values.seconds}`;
  if(second!==lastClockSecond){lastClockSecond=second;$('#clock').setAttribute('aria-label',`当前时间 ${now.getHours()}点${now.getMinutes()}分${now.getSeconds()}秒`);}
  const day=now.toDateString();if(day!==lastClockDate){lastClockDate=day;$('#date').textContent=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(now);}
}
function animateClock(){updateClock();clockFrame=document.hidden?null:requestAnimationFrame(animateClock);}
function startClock(){if(clockFrame===null&&!document.hidden)clockFrame=requestAnimationFrame(animateClock);}
function stopClock(){if(clockFrame!==null)cancelAnimationFrame(clockFrame);clockFrame=null;}
function bookmarkGraphic(bookmark){
  const glyph=resolveBookmarkIcon(bookmark);
  const origin=new URL(bookmark.url).origin;
  const gray=Number.isFinite(bookmark.iconGrayscale)?Math.max(0,Math.min(100,bookmark.iconGrayscale)):20;
  const graphic=bookmark.websiteIcon?`<img class="bookmark-site-icon" src="${esc(bookmark.icon||bookmark.siteIconUrl||origin+'/favicon.ico')}" style="--site-icon-gray:${gray/100}" data-site-origin="${esc(origin)}" data-site-glyph="${esc(glyph)}" referrerpolicy="no-referrer" alt="" decoding="async">`:bookmark.icon&&bookmark.iconMask?`<span class="bookmark-upload-mask" style="--bookmark-mask:url(${esc(bookmark.iconMask)})"></span>`:globalThis.QiPageEngineIcons.render(glyph);
  return `<span class="site-icon engine-badge unified-bookmark-icon">${graphic}</span>`;
}
function ensureBookmarkMasks(){
  for(const bookmark of state.bookmarks){
    if(!bookmark.icon||bookmark.iconMask||pendingMasks.has(bookmark.id)||failedMasks.has(bookmark.icon))continue;
    const source=bookmark.icon,id=bookmark.id;
    const task=(async()=>{try{
      const file=await (await fetch(source)).blob();const processed=await imageIcon(file);
      const current=state.bookmarks.find(item=>item.id===id&&item.icon===source);if(!current)return;
      if(!processed.mask){failedMasks.add(source);return;}
      current.iconMask=processed.mask;persist();
      const anchor=$$('[data-bookmark-id]').find(element=>element.dataset.bookmarkId===id);
      if(anchor)anchor.querySelector('.site-icon').outerHTML=bookmarkGraphic(current);
    }catch{failedMasks.add(source);}finally{pendingMasks.delete(id);}})();
    pendingMasks.set(id,task);
  }
}
const bookmarkIconNames={...genericIconLabels,mail:'邮件',note:'笔记',design:'设计',docs:'文档',deploy:'部署'};
function renderBookmarkIconPicker(){
  $('#bookmark-icon-picker').innerHTML=[{id:'auto',name:'按网站自动匹配',glyph:'sparkles'},...BOOKMARK_ICON_IDS.map(id=>({id,name:ENGINES.find(engine=>engine.id===id)?.name||bookmarkIconNames[id],glyph:id}))].map(option=>`<button type="button" class="engine-icon-option engine-badge" data-bookmark-glyph="${option.id}" aria-label="使用${esc(option.name)}图标" title="${esc(option.name)}" aria-pressed="${!customIcon&&bookmarkGlyph===option.id}">${globalThis.QiPageEngineIcons.render(option.glyph)}</button>`).join('');
  let url,valid=true;try{url=normalizeUrl($('#bookmark-url').value);}catch{valid=false;url='https://example.com';}
  $('#bookmark-icon-preview').innerHTML=bookmarkGraphic({url,glyph:bookmarkGlyph==='auto'?undefined:bookmarkGlyph,icon:customIcon,iconMask:customIconMask,websiteIcon:websiteIconEnabled&&valid,siteIconUrl:websiteIconUrl,iconGrayscale:websiteIconGray});
  for(const id of ['bookmark-icon-gray','bookmark-icon-gray-value'])$(`#${id}`).disabled=!websiteIconEnabled;
}
function stopWebsiteIcon(){clearTimeout(websiteIconTimer);websiteIconTimer=null;websiteIconController?.abort();websiteIconController=null;bookmarkIconRequest++;pendingBookmarkIcon=null;}
function fillBookmarkName(value){
  const input=$('#bookmark-name');
  if(bookmarkNameTouched||input.value.trim()&&input.value!==bookmarkAutoName)return;
  bookmarkAutoName=String(value).replace(/\s+/g,' ').trim().slice(0,32);input.value=bookmarkAutoName;
}
$('#bookmark-name').addEventListener('input',()=>{bookmarkNameTouched=!!$('#bookmark-name').value.trim();if(!bookmarkNameTouched)bookmarkAutoName='';});
function queueWebsiteIcon(){
  stopWebsiteIcon();if(websiteIconEnabled){customIcon='';customIconMask='';websiteIconUrl='';}
  try{fillBookmarkName(new URL(normalizeUrl($('#bookmark-url').value)).hostname.replace(/^www\./,''));}catch{renderBookmarkIconPicker();return;}
  renderBookmarkIconPicker();$('#bookmark-icon-status').textContent='将自动获取网站图标，并应用灰度主题色…';
  websiteIconTimer=setTimeout(()=>{websiteIconTimer=null;fetchWebsiteIcon();},450);
}
function fetchWebsiteIcon({icons=websiteIconEnabled}={}){
  stopWebsiteIcon();let url;
  try{url=normalizeUrl($('#bookmark-url').value);}catch{renderBookmarkIconPicker();return Promise.resolve();}
  if(icons){websiteIconEnabled=true;bookmarkGlyph='auto';customIcon='';customIconMask='';}
  fillBookmarkName(new URL(url).hostname.replace(/^www\./,''));
  const origin=new URL(url).origin,request=bookmarkIconRequest,controller=new AbortController();websiteIconController=controller;
  if(icons)websiteIconUrl=origin+'/favicon.ico';renderBookmarkIconPicker();
  $('#bookmark-icon-status').textContent='正在获取网站名称与图标；跨域受限时使用域名和站点图标。';
  pendingBookmarkIcon=(async()=>{
    const timer=setTimeout(()=>controller.abort(),4000);
    const options={signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'};
    try{
      try{
        const response=await fetch(url,options);
        if(response.ok){
          const html=(await response.text()).slice(0,512000),doc=new DOMParser().parseFromString(html,'text/html');
          if(request!==bookmarkIconRequest||controller.signal.aborted)return;
          const title=doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')||doc.querySelector('meta[name="application-name"]')?.getAttribute('content')||doc.querySelector('title')?.textContent;
          if(title?.trim())fillBookmarkName(title);
          const link=[...doc.querySelectorAll('link[rel][href]')].find(link=>/(^|\s)(icon|apple-touch-icon)(\s|$)/i.test(link.getAttribute('rel')));
          if(link){const candidate=normalizeUrl(new URL(link.getAttribute('href'),response.url||url).href);if(icons&&new URL(candidate).origin===origin&&request===bookmarkIconRequest)websiteIconUrl=candidate;}
        }
      }catch{/* 页面不开放跨域读取时，仍可直接显示其 favicon。 */}
      if(!icons||request!==bookmarkIconRequest||controller.signal.aborted)return;
      renderBookmarkIconPicker();
      const response=await fetch(websiteIconUrl,options);if(!response.ok)throw new Error('图标不可读取');
      const blob=await response.blob();const result=await imageIcon(blob,true);
      if(request!==bookmarkIconRequest||controller.signal.aborted)return;
      customIcon=result.source;customIconMask=result.mask;
      $('#bookmark-icon-status').textContent=result.mask?'网站名称与图标已获取，可调整图标灰度；缓存图标保存后可离线显示。':'网站图标将按所选灰度显示。';
      renderBookmarkIconPicker();
    }catch{
      if(request===bookmarkIconRequest){$('#bookmark-icon-status').textContent='使用站点图标的灰度版本；若站点未提供图标，将自动回退本地图形。';renderBookmarkIconPicker();}
    }finally{clearTimeout(timer);if(websiteIconController===controller)websiteIconController=null;}
  })();
  return pendingBookmarkIcon;
}
$('#bookmark-fetch-icon').onclick=()=>{websiteIconEnabled=true;fetchWebsiteIcon();};
function changeWebsiteIconGray(value){
  if(!Number.isFinite(value)||value<0||value>100)return;
  websiteIconGray=Math.round(value*100)/100;
  $('#bookmark-icon-gray').value=websiteIconGray;$('#bookmark-icon-gray-value').value=websiteIconGray.toFixed(2);renderBookmarkIconPicker();
}
$('#bookmark-icon-gray').addEventListener('input',event=>changeWebsiteIconGray(Number(event.target.value)));
$('#bookmark-icon-gray-value').addEventListener('input',event=>{
  const text=event.target.value;changeWebsiteIconGray(event.target.valueAsNumber);event.target.value=text;
});
$('#bookmark-icon-gray-value').addEventListener('blur',()=>{$('#bookmark-icon-gray-value').value=websiteIconGray.toFixed(2);});
$('#bookmark-icon-picker').onclick=event=>{
  const button=event.target.closest('[data-bookmark-glyph]');if(!button)return;
  stopWebsiteIcon();websiteIconEnabled=false;websiteIconUrl='';customIcon='';customIconMask='';bookmarkGlyph=button.dataset.bookmarkGlyph;$('#bookmark-icon').value='';
  if(bookmarkGlyph==='auto'){websiteIconEnabled=true;queueWebsiteIcon();return;}
  renderBookmarkIconPicker();$('#bookmark-icon-status').textContent='已选择统一矢量图标，保存后生效。';
};
$('#bookmark-url').addEventListener('input',queueWebsiteIcon);
$('#bookmark-dialog').addEventListener('close',()=>{bookmarkEditorSession++;stopWebsiteIcon();});
document.addEventListener('error',event=>{
  const img=event.target;if(!img.matches?.('img.bookmark-site-icon'))return;
  const fallbacks=['/favicon.ico','/apple-touch-icon.png'],tried=Number(img.dataset.iconFallback||0);
  for(let index=tried;index<fallbacks.length;index++){
    const next=img.dataset.siteOrigin+fallbacks[index];img.dataset.iconFallback=index+1;
    if(next!==img.src){img.src=next;return;}
  }
  img.parentElement.innerHTML=globalThis.QiPageEngineIcons.render(img.dataset.siteGlyph||'globe');
},true);

let activeDockFolder=null,dockFolderOpener=null,renameDockItemId=null;
function openDockRename(id){
  const item=[...state.bookmarks,...state.dockFolders].find(item=>item.id===id);if(!item)return;
  renameDockItemId=id;$('#dock-rename-name').value=item.name;
  openDialog('#dock-rename-dialog');$('#dock-rename-name').focus();$('#dock-rename-name').select();
}
$('#dock-rename-form').onsubmit=event=>{
  event.preventDefault();const name=$('#dock-rename-name').value.trim();
  if(!name||name.length>32){$('#dock-rename-name').focus();return;}
  const item=[...state.bookmarks,...state.dockFolders].find(item=>item.id===renameDockItemId);if(!item)return;
  const previous=item.name;item.name=name;
  if(!persist()){item.name=previous;return;}
  renderBookmarks();$('#dock-rename-dialog').close();
};
$('#dock-rename-dialog').addEventListener('close',()=>{
  [...$('#bookmarks').querySelectorAll('[data-dock-rename]')].find(button=>button.dataset.dockRename===renameDockItemId)?.focus({preventScroll:true});
  renameDockItemId=null;
});
function dockFolderLabel(folder){
  const names=[];let current=folder;
  while(current){names.unshift(current.name);current=state.dockFolders.find(item=>item.id===current.parentId);}
  return names.join('/');
}
function dockItems(){
  const contained=new Set(state.dockFolders.flatMap(folder=>folder.bookmarkIds));
  const items=[...state.bookmarks.filter(b=>!contained.has(b.id)),...state.dockFolders.filter(folder=>!folder.parentId)];
  const byId=new Map(items.map(item=>[item.id,item]));
  return [...state.dockOrder.map(id=>byId.get(id)).filter(Boolean),...items.filter(item=>!state.dockOrder.includes(item.id))];
}
function dissolveDockFolders(selected){
  const map=new Map(state.dockFolders.map(folder=>[folder.id,folder])),oldOrder=dockItems().map(item=>item.id);
  const rootOf=id=>{let folder=map.get(id);while(folder?.parentId)folder=map.get(folder.parentId);return folder?.id;};
  const originalRoots=new Map(state.dockFolders.map(folder=>[folder.id,rootOf(folder.id)])),released=[];
  for(const folder of state.dockFolders){
    let parent=folder.parentId;while(parent&&selected.has(parent))parent=map.get(parent)?.parentId;
    if(selected.has(folder.id)){
      if(parent)map.get(parent).bookmarkIds.push(...folder.bookmarkIds);else released.push(...folder.bookmarkIds.map(id=>({id,root:originalRoots.get(folder.id)})));
    }else {if(parent)folder.parentId=parent;else delete folder.parentId;}
  }
  state.dockFolders=state.dockFolders.filter(folder=>!selected.has(folder.id));
  const promoted=state.dockFolders.filter(folder=>!folder.parentId&&!oldOrder.includes(folder.id)).map(folder=>({id:folder.id,root:originalRoots.get(folder.id)}));
  state.dockOrder=oldOrder.flatMap(id=>selected.has(id)?[...promoted,...released].filter(item=>item.root===id).map(item=>item.id):[id]);
}
function pruneDockFolders(){
  const ids=new Set(state.bookmarks.map(b=>b.id));
  state.dockFolders.forEach(folder=>{folder.bookmarkIds=folder.bookmarkIds.filter(id=>ids.has(id));});
  const visible=new Set(dockItems().map(item=>item.id));
  state.dockOrder=state.dockOrder.filter(id=>visible.has(id));
}
function bookmarkInView(bookmark){
  return document.body.dataset.view==='minimal'||state.activeGroup==='all'||bookmark.group===state.activeGroup;
}
function folderInView(folder){
  return document.body.dataset.view==='minimal'||state.activeGroup==='all'||folder.bookmarkIds.some(id=>state.bookmarks.some(b=>b.id===id&&bookmarkInView(b)))||state.dockFolders.some(child=>child.parentId===folder.id&&folderInView(child));
}
function folderGraphic(folder){
  const bookmarks=[...state.dockFolders.filter(item=>item.parentId===folder.id&&folderInView(item)),...folder.bookmarkIds.map(id=>state.bookmarks.find(b=>b.id===id)).filter(b=>b&&bookmarkInView(b))];
  const cells=Array.from({length:4},(_,index)=>index<3&&bookmarks[index]?`<span class="folder-preview-cell">${bookmarks[index].bookmarkIds?'<span class="site-icon"><svg class="engine-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg></span>':bookmarkGraphic(bookmarks[index])}</span>`:index===3&&bookmarks.length>3?`<span class="folder-preview-cell folder-preview-count">+${bookmarks.length-3}</span>`:'<span class="folder-preview-cell folder-preview-empty"></span>').join('');
  return `<span class="site-icon dock-folder-cover" aria-hidden="true">${cells}</span>`;
}
let folderEditing=false,folderPress=null,folderSuppressClick=false;
const folderItemId=row=>{const link=row?.querySelector('[data-folder-open],[data-bookmark-id]');return link?.dataset.folderOpen||link?.dataset.bookmarkId;};
function folderOrder(folder){
  const ids=[...state.dockFolders.filter(f=>f.parentId===folder.id).map(f=>f.id),...folder.bookmarkIds];
  return [...(folder.itemOrder||[]).filter(id=>ids.includes(id)),...ids.filter(id=>!folder.itemOrder?.includes(id))];
}
function setFolderEditing(value){
  folderEditing=value;$('#dock-folder-items').classList.toggle('folder-editing',value);$('#folder-sort-done').hidden=!value;
  $('#folder-sort-hint').textContent=value?'拖动调整顺序，完成后退出编辑。':'左键长按图标进入编辑模式，拖动调整顺序。';
}
function renderDockFolder(){
  const folder=state.dockFolders.find(item=>item.id===activeDockFolder);
  if(!folder){if($('#dock-folder-dialog').open)$('#dock-folder-dialog').close();return;}
  $('#dock-folder-title').textContent=folder.name;
  const ancestors=[];let ancestor=folder;while(ancestor){ancestors.unshift(ancestor);ancestor=state.dockFolders.find(item=>item.id===ancestor.parentId);}
  $('#dock-folder-breadcrumbs').innerHTML=ancestors.map(item=>`<button type="button" data-folder-open="${esc(item.id)}" ${item.id===folder.id?'disabled aria-current="page"':''}>${esc(item.name)}</button>`).join('<span aria-hidden="true"> / </span>');
  const children=state.dockFolders.filter(item=>item.parentId===folder.id&&folderInView(item));
  const items=folder.bookmarkIds.map(id=>state.bookmarks.find(b=>b.id===id)).filter(b=>b&&bookmarkInView(b));
  $('#dock-folder-count').textContent=children.length?`${children.length} 个文件夹 · ${items.length} 个网址`:`${items.length} 个网址`;
  $('#dock-folder-empty').hidden=items.length+children.length>0;
  const view=state.folderView==='list'?'list':'grid';
  $('#dock-folder-items').dataset.view=view;
  $$('#dock-folder-view button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.folderView===view)));
  $('#dock-folder-items').innerHTML=children.map(child=>`<div class="folder-shortcut"><button type="button" class="folder-open-button" aria-label="${esc(child.name)}" data-folder-open="${esc(child.id)}">${folderGraphic(child)}<span>${esc(child.name)}</span></button></div>`).join('')+items.map(b=>`<div class="folder-shortcut"><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer" data-bookmark-id="${esc(b.id)}" aria-label="${esc(b.name)}">${bookmarkGraphic(b)}<span>${esc(b.name)}</span></a><button type="button" ${dockEditing||managing?'': 'hidden'} data-folder-remove="${esc(b.id)}" aria-label="将 ${esc(b.name)} 移回 Dock" title="移回 Dock">${icon('x')}</button></div>`).join('');
  const rows=new Map([...$('#dock-folder-items').children].map(row=>[folderItemId(row),row]));
  folderOrder(folder).forEach(id=>{if(rows.has(id))$('#dock-folder-items').append(rows.get(id));});
  if(view==='list'){
    $('#dock-folder-items').querySelectorAll('.folder-open-button,a[data-bookmark-id]').forEach(link=>{
      const label=link.lastElementChild,detail=document.createElement('small');
      const child=children.find(item=>item.id===link.dataset.folderOpen),bookmark=items.find(item=>item.id===link.dataset.bookmarkId);
      detail.textContent=child?`文件夹 · ${dockFolderLabel(child)}`:bookmark.url;
      label.classList.add('folder-item-text');label.append(detail);
    });
  }
}
const folderGrid=$('#dock-folder-items');
function cancelFolderPress(){if(folderPress){clearTimeout(folderPress.timer);folderPress.row?.classList.remove('folder-dragging');if(folderPress.row)folderPress.row.style.translate='';}folderPress=null;folderGrid.querySelectorAll('.folder-sort-target').forEach(row=>row.classList.remove('folder-sort-target'));}
folderGrid.addEventListener('dragstart',event=>event.preventDefault());
folderGrid.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('[data-folder-remove]'))return;
  const row=event.target.closest('.folder-shortcut');if(!row)return;
  cancelFolderPress();folderSuppressClick=false;
  folderPress={id:folderItemId(row),row,pointerId:event.pointerId,x:event.clientX,y:event.clientY,target:null,active:folderEditing};
  if(folderEditing)event.preventDefault();
  folderPress.timer=setTimeout(()=>{if(!folderPress)return;setFolderEditing(true);folderPress.active=true;folderSuppressClick=true;},450);
});
document.addEventListener('pointermove',event=>{
  if(!folderPress||folderPress.pointerId!==event.pointerId)return;
  if(!folderPress.active){if(Math.hypot(event.clientX-folderPress.x,event.clientY-folderPress.y)>8)cancelFolderPress();return;}
  event.preventDefault();folderSuppressClick=true;
  folderPress.row.classList.add('folder-dragging');folderPress.row.style.translate=`${event.clientX-folderPress.x}px ${event.clientY-folderPress.y}px`;
  let row=document.elementFromPoint?.(event.clientX,event.clientY)?.closest('#dock-folder-items .folder-shortcut');
  if(!row){let distance=Infinity;for(const item of folderGrid.children){const r=item.getBoundingClientRect();if(item===folderPress.row){r.x-=event.clientX-folderPress.x;r.y-=event.clientY-folderPress.y;}const d=Math.hypot(event.clientX-r.left-r.width/2,event.clientY-r.top-r.height/2);if(d<distance){row=item;distance=d;}}}
  folderGrid.querySelectorAll('.folder-sort-target').forEach(item=>item.classList.remove('folder-sort-target'));
  folderPress.target=folderItemId(row);if(row&&folderPress.target!==folderPress.id)row.classList.add('folder-sort-target');
  const bounds=folderGrid.getBoundingClientRect();if(event.clientY<bounds.top+28)folderGrid.scrollTop-=12;else if(event.clientY>bounds.bottom-28)folderGrid.scrollTop+=12;
},{passive:false});
document.addEventListener('pointerup',event=>{
  if(!folderPress||folderPress.pointerId!==event.pointerId)return;
  const press=folderPress,positions=new Map([...folderGrid.children].map(row=>[folderItemId(row),row.getBoundingClientRect()]));cancelFolderPress();
  if(!press.active||!press.target||press.target===press.id){
    const before=positions.get(press.id),after=press.row.getBoundingClientRect();
    if(press.active&&before&&!matchMedia('(prefers-reduced-motion: reduce)').matches)press.row.animate?.([{translate:`${before.left-after.left}px ${before.top-after.top}px`},{translate:'0 0'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
    return;
  }
  const folder=state.dockFolders.find(f=>f.id===activeDockFolder);if(!folder)return;
  const order=folderOrder(folder),from=order.indexOf(press.id),to=order.indexOf(press.target);if(from<0||to<0)return;
  const previous=folder.itemOrder;order.splice(from,1);order.splice(to,0,press.id);folder.itemOrder=order;
  if(!persist()){if(previous)folder.itemOrder=previous;else delete folder.itemOrder;}
  renderDockFolder();
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const row of folderGrid.children){const before=positions.get(folderItemId(row)),after=row.getBoundingClientRect();if(before)row.animate?.([{translate:`${before.left-after.left}px ${before.top-after.top}px`},{translate:'0 0'}],{duration:200,easing:'ease-out'});}
});
document.addEventListener('pointercancel',cancelFolderPress);
window.addEventListener('blur',cancelFolderPress);
folderGrid.addEventListener('click',event=>{if(folderEditing||folderSuppressClick){event.preventDefault();event.stopImmediatePropagation();folderSuppressClick=false;}},true);
$('#folder-sort-done').onclick=()=>{cancelFolderPress();setFolderEditing(false);folderSuppressClick=false;};
$('#dock-folder-view').onclick=event=>{
  const button=event.target.closest('[data-folder-view]');if(!button)return;
  const previous=state.folderView;state.folderView=button.dataset.folderView;
  if(!persist()){state.folderView=previous;return;}renderDockFolder();
};
$('#dock-folder-fetch-icons').onclick=()=>{
  const folders=new Set([activeDockFolder]);let count;
  do{count=folders.size;state.dockFolders.forEach(folder=>{if(folders.has(folder.parentId))folders.add(folder.id);});}while(count!==folders.size);
  const ids=new Set(state.dockFolders.filter(folder=>folders.has(folder.id)).flatMap(folder=>folder.bookmarkIds));
  let added=0;
  const bookmarks=state.bookmarks.map(bookmark=>{
    if(!ids.has(bookmark.id)||bookmark.icon||!bookmarkInView(bookmark))return bookmark;
    added++;return {...bookmark,websiteIcon:true,siteIconUrl:bookmark.siteIconUrl||new URL(bookmark.url).origin+'/favicon.ico',iconGrayscale:bookmark.iconGrayscale??20};
  });
  if(!added)return toast('没有需要获取图标的网址，自定义图标已保留');
  const previous=state;state={...state,bookmarks};if(!persist()){state=previous;return;}
  renderBookmarks();toast(`已为 ${added} 个网址启用网站图标，加载失败时保留默认图标`);
};
function openDockFolder(id){
  const folder=state.dockFolders.find(item=>item.id===id);if(!folder)return;
  cancelFolderPress();setFolderEditing(false);
  if(!$('#dock-folder-dialog').open)dockFolderOpener=id;
  activeDockFolder=id;
  const navigating=$('#dock-folder-dialog').open;
  renderDockFolder();if(!navigating)openDialog('#dock-folder-dialog');else $('#dock-folder-organize').focus();document.body.classList.add('dock-folder-open');
}
function syncDockFolderPath(){
  const parent=state.dockFolders.find(folder=>folder.id===$('#dock-folder-parent').value);
  $('#dock-folder-path').textContent='路径：'+(parent?dockFolderLabel(parent)+'/':'')+($('#dock-folder-name').value.trim()||'新文件夹');
}
function editDockFolder(id,parentId=''){
  const folder=state.dockFolders.find(item=>item.id===id);
  if(!folder&&state.dockFolders.length>=100)return toast('最多创建 100 个文件夹');
  $('#dock-folder-id').value=folder?.id||'';$('#dock-folder-name').value=folder?.name||'';
  $('#dock-folder-editor-title').textContent=folder?'整理文件夹':'新建文件夹';
  $('#dock-folder-dissolve').hidden=$('#dock-folder-delete').hidden=!folder;
  const excluded=new Set(folder?[folder.id]:[]);let count;
  do{count=excluded.size;state.dockFolders.forEach(item=>{if(excluded.has(item.parentId))excluded.add(item.id);});}while(count!==excluded.size);
  $('#dock-folder-parent').innerHTML='<option value="">Dock（顶层）</option>'+state.dockFolders.filter(item=>!excluded.has(item.id)).map(item=>`<option value="${esc(item.id)}">${esc(dockFolderLabel(item))}</option>`).join('');
  $('#dock-folder-parent').value=folder?.parentId||parentId;syncDockFolderPath();
  const selected=new Set(folder?.bookmarkIds||[...dockSelection].filter(id=>state.bookmarks.some(b=>b.id===id)));
  $('#dock-folder-picker').innerHTML=state.bookmarks.map(b=>{
    const owner=state.dockFolders.find(item=>item.bookmarkIds.includes(b.id));
    return `<label class="folder-pick-row"><input type="checkbox" value="${esc(b.id)}" ${selected.has(b.id)?'checked':''}>${bookmarkGraphic(b)}<span><b>${esc(b.name)}</b><small>${owner?esc(dockFolderLabel(owner)):'Dock'}</small></span></label>`;
  }).join('')||'<p class="muted">暂无网址，可以先创建空文件夹。</p>';
  openDialog('#dock-folder-editor');$('#dock-folder-name').focus();
}
$('#dock-create-folder').onclick=()=>editDockFolder();
$('#dock-import-bookmarks').onclick=()=>$('#browser-bookmarks-file').click();
$('#dock-folder-organize').onclick=()=>editDockFolder(activeDockFolder);
$('#dock-folder-create-child').onclick=()=>editDockFolder(undefined,activeDockFolder);
$('#dock-folder-parent').onchange=$('#dock-folder-name').oninput=syncDockFolderPath;
$('#dock-folder-form').onsubmit=event=>{
  event.preventDefault();const name=$('#dock-folder-name').value.trim();if(!name)return;
  const id=$('#dock-folder-id').value||uid(),existing=state.dockFolders.find(folder=>folder.id===id);
  const bookmarkIds=[...$('#dock-folder-picker').querySelectorAll('input:checked')].map(input=>input.value);
  const selected=new Set(bookmarkIds),order=dockItems().map(item=>item.id);
  const index=existing?order.indexOf(id):order.findIndex(item=>selected.has(item));
  const parentId=$('#dock-folder-parent').value;
  const folders=state.dockFolders.map(folder=>({...folder,bookmarkIds:folder.bookmarkIds.filter(item=>!selected.has(item))}));
  const updated=folders.find(folder=>folder.id===id)||{id};
  Object.assign(updated,{name,bookmarkIds});if(parentId)updated.parentId=parentId;else delete updated.parentId;
  if(!existing)folders.push(updated);
  if(!parentId&&!order.includes(id))order.splice(index<0?order.length:index,0,id);
  const next={...state,dockFolders:folders,dockOrder:order.filter(item=>!folders.some(folder=>folder.id===item&&folder.parentId)&&!selected.has(item))};
  try{validateBackup(next);}catch(error){toast(error.message);return;}
  const previous=state;state=next;if(!persist()){state=previous;return;}
  dockSelection.clear();renderBookmarks();$('#dock-folder-editor').close();
  toast('文件夹已保存');
};
$('#dock-move-folder').onchange=event=>{
  const folder=state.dockFolders.find(item=>item.id===event.target.value);if(!folder)return;
  const ids=state.bookmarks.filter(b=>dockSelection.has(b.id)).map(b=>b.id),selected=new Set(ids);
  state.dockFolders.forEach(item=>{item.bookmarkIds=item.bookmarkIds.filter(id=>!selected.has(id));});
  folder.bookmarkIds.push(...ids);dockSelection.clear();persist();renderBookmarks();toast(`已移入“${folder.name}”`);
};
function removeBookmarksAndEmptyFolders(ids){
  const affected=new Set(state.dockFolders.filter(folder=>folder.bookmarkIds.some(id=>ids.has(id))).map(folder=>folder.id));
  let size;
  do{size=affected.size;state.dockFolders.forEach(folder=>{if(affected.has(folder.id)&&folder.parentId)affected.add(folder.parentId);});}while(size!==affected.size);
  state.bookmarks=state.bookmarks.filter(bookmark=>!ids.has(bookmark.id));
  state.dockFolders.forEach(folder=>{folder.bookmarkIds=folder.bookmarkIds.filter(id=>!ids.has(id));});
  do{size=state.dockFolders.length;const parents=new Set(state.dockFolders.map(folder=>folder.parentId));state.dockFolders=state.dockFolders.filter(folder=>!affected.has(folder.id)||folder.bookmarkIds.length||parents.has(folder.id));}while(size!==state.dockFolders.length);
}
function requestDeleteDockFolder(id){
  const folder=state.dockFolders.find(item=>item.id===id);if(!folder)return;
  const removed=new Set([id]);let size;
  do{size=removed.size;state.dockFolders.forEach(item=>{if(removed.has(item.parentId))removed.add(item.id);});}while(size!==removed.size);
  const bookmarkIds=new Set(state.dockFolders.filter(item=>removed.has(item.id)).flatMap(item=>item.bookmarkIds));
  confirmAction('删除文件夹及内容？',`“${folder.name}”及其 ${removed.size-1} 个子文件夹、${bookmarkIds.size} 个网址将删除。删除后可撤回。`,()=>{
    deleteWithUndo('文件夹及内容已删除',()=>{
      state.bookmarks=state.bookmarks.filter(item=>!bookmarkIds.has(item.id));
      state.dockFolders=state.dockFolders.filter(item=>!removed.has(item.id));
    },()=>{if($('#dock-folder-editor').open)$('#dock-folder-editor').close();});
  });
}
$('#dock-folder-delete').onclick=()=>requestDeleteDockFolder($('#dock-folder-id').value);
$('#dock-folder-dissolve').onclick=()=>{
  const folder=state.dockFolders.find(item=>item.id===$('#dock-folder-id').value);if(!folder)return;
  confirmAction('解散这个文件夹？','其中的网址和子文件夹会移到上一级，网址与原有分组都会保留。',()=>{
    deleteWithUndo('文件夹已解散',()=>dissolveDockFolders(new Set([folder.id])),()=>$('#dock-folder-editor').close());
  },'确认解散');
};
$('#dock-folder-breadcrumbs').addEventListener('click',event=>{const button=event.target.closest('[data-folder-open]');if(button)openDockFolder(button.dataset.folderOpen);});
$('#dock-folder-items').addEventListener('click',event=>{
  const child=event.target.closest('[data-folder-open]');if(child){openDockFolder(child.dataset.folderOpen);return;}
  const remove=event.target.closest('[data-folder-remove]');if(!remove)return;
  if(!dockEditing&&!managing)return;
  moveBookmarkOutOfFolder(remove.dataset.folderRemove);
});
function moveBookmarkOutOfFolder(id){
  const folder=state.dockFolders.find(item=>item.id===activeDockFolder);if(!folder||!folder.bookmarkIds.includes(id))return;
  const previous=bookmarkSnapshot();
  folder.bookmarkIds=folder.bookmarkIds.filter(item=>item!==id);
  state.dockOrder=dockItems().map(item=>item.id).filter(item=>item!==id);
  state.dockOrder.splice(state.dockOrder.indexOf(dockFolderOpener)+1,0,id);
  if(!persist()){Object.assign(state,previous);return;}renderBookmarks();$('#dock-folder-organize').focus();
}
function moveFolderToDock(id){
  const folder=state.dockFolders.find(item=>item.id===id);
  if(!folder?.parentId||folder.parentId!==activeDockFolder)return;
  const previous=bookmarkSnapshot();
  delete folder.parentId;
  const order=dockItems().map(item=>item.id).filter(item=>item!==id);
  order.splice(order.indexOf(dockFolderOpener)+1,0,id);state.dockOrder=order;
  if(!persist()){Object.assign(state,previous);return;}
  renderBookmarks();toast('文件夹已移到 Dock 栏');
}
function deleteFolderBookmark(id){
  const folder=state.dockFolders.find(item=>item.id===activeDockFolder),bookmark=state.bookmarks.find(item=>item.id===id);
  if(!bookmark||!folder?.bookmarkIds.includes(id))return;
  confirmAction('删除这个网址？',`“${bookmark.name}”将被删除，删除后可撤回。`,()=>{
    deleteWithUndo('网址已删除',()=>{
      state.bookmarks=state.bookmarks.filter(item=>item.id!==id);
      state.dockFolders.forEach(item=>{item.bookmarkIds=item.bookmarkIds.filter(bookmarkId=>bookmarkId!==id);});
    });
  });
}
$('#dock-folder-dialog').addEventListener('close',()=>{
  cancelFolderPress();setFolderEditing(false);folderSuppressClick=false;
  activeDockFolder=null;document.body.classList.remove('dock-folder-open');
  const opener=[...$('#bookmarks').querySelectorAll('[data-folder-id]')].find(item=>item.dataset.folderId===dockFolderOpener);
  opener?.focus({preventScroll:true});
});
$('#bookmarks').addEventListener('keydown',event=>{if(event.key===' '&&event.target.closest('[data-folder-id]')){event.preventDefault();event.target.closest('[data-folder-id]').click();}});

function renderBookmarks(){
  clearDockSort();
  $('#group-tabs').innerHTML=[{id:'all',name:'全部'},...state.groups].map(g=>`<button role="tab" aria-selected="${state.activeGroup===g.id}" class="${state.activeGroup===g.id?'active':''}" data-group="${esc(g.id)}">${esc(g.name)}</button>`).join('');
  const minimal=document.body.dataset.view==='minimal';
  const bookmarks=dockItems().filter(item=>Array.isArray(item.bookmarkIds)?folderInView(item):bookmarkInView(item));
  $('#bookmarks').innerHTML=bookmarks.map(b=>{
    const folder=Array.isArray(b.bookmarkIds);
    return `<div class="bookmark"><a ${folder?`href="#folder" role="button" data-folder-id="${esc(b.id)}" aria-haspopup="dialog" aria-controls="dock-folder-dialog"`:`href="${esc(b.url)}" target="_blank" rel="noopener noreferrer" data-bookmark-id="${esc(b.id)}"`} data-dock-id="${esc(b.id)}" aria-label="${esc(b.name)}" title="${minimal?'':esc(folder?dockFolderLabel(b):b.name+' · '+b.url)}">${folder?folderGraphic(b):bookmarkGraphic(b)}<span class="bookmark-label">${esc(b.name)}</span></a>${minimal&&dockEditing?`<button class="dock-item-name dock-name-edit" type="button" data-dock-rename="${esc(b.id)}" aria-label="重命名 ${esc(b.name)}" title="点击修改名称">${esc(b.name)}</button>`:`<span class="dock-item-name" aria-hidden="true">${esc(b.name)}</span>`}${managing&&!folder?`<button class="bookmark-edit" data-edit="${esc(b.id)}" aria-label="编辑 ${esc(b.name)}">${icon('edit')}</button>`:''}</div>`;
  }).join('')+`<div class="bookmark bookmark-add-item"><button class="bookmark-add" id="grid-add" type="button" aria-label="添加网站" title="添加网站"><span class="site-icon">${icon('plus')}</span><span class="bookmark-label">添加网址</span></button></div>`;
  ensureBookmarkMasks();
  if(dockEditing)$('#bookmarks').querySelectorAll('[data-dock-id]').forEach(anchor=>{
    const input=document.createElement('input');input.type='checkbox';input.className='dock-select';input.dataset.dockSelect=anchor.dataset.dockId;input.setAttribute('aria-label',`选择 ${anchor.getAttribute('aria-label')}`);anchor.after(input);
  });
  syncDockSelection();renderDockFolder();
  $('#grid-add').onclick=()=>editBookmark();
  document.dispatchEvent(new CustomEvent('qipage:dock-preferences'));
  $('#group-tools').hidden=!managing;
  $('#rename-group').hidden=$('#delete-group').hidden=state.activeGroup==='all';
}
$('#group-tabs').onclick=e=>{const b=e.target.closest('[data-group]');if(b){state.activeGroup=b.dataset.group;persist();renderBookmarks();}};
$('#manage-bookmarks').onclick=()=>{managing=!managing;$('#manage-bookmarks').setAttribute('aria-pressed',String(managing));renderBookmarks();};
function editBookmark(id){
  stopWebsiteIcon();bookmarkEditorSession++;bookmarkAutoName='';bookmarkNameTouched=false;
  const b=state.bookmarks.find(b=>b.id===id);$('#bookmark-form').reset();$('#bookmark-id').value=b?.id||'';$('#bookmark-title').textContent=b?'编辑快捷网址':'添加快捷网址';$('#bookmark-name').value=b?.name||'';$('#bookmark-url').value=b?.url||'';customIcon=b?.icon||'';customIconMask=b?.iconMask||'';bookmarkGlyph=b?.glyph||'auto';websiteIconEnabled=b?!!b.websiteIcon:true;websiteIconUrl=b?.siteIconUrl||'';websiteIconGray=b?.iconGrayscale??20;$('#bookmark-icon-gray').value=websiteIconGray;$('#bookmark-icon-gray-value').value=websiteIconGray.toFixed(2);bookmarkNameTouched=!!b;renderBookmarkIconPicker();$('#bookmark-icon-status').textContent=customIcon?'已保存的图标和灰度设置将保留，可重新自动获取。':'填写网址后自动获取网站图标并应用灰度主题色，也可手动选择下方图形。';
  $('#bookmark-group').innerHTML=state.groups.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');$('#bookmark-group').value=b?.group||(state.activeGroup!=='all'?state.activeGroup:state.groups[0].id);
  $('#delete-bookmark')?.remove();if(b){const del=document.createElement('button');del.type='button';del.id='delete-bookmark';del.className='secondary-button';del.textContent='删除网址';del.onclick=()=>confirmAction('删除这个网址？',`“${b.name}”将从快捷导航中移除。`,()=>{state.bookmarks=state.bookmarks.filter(n=>n.id!==b.id);persist();renderBookmarks();$('#bookmark-dialog').close();toast('网址已删除');});$('#bookmark-form').append(del);}
  openDialog('#bookmark-dialog');
}
$('#add-bookmark').onclick=()=>editBookmark();$('#bookmarks').onclick=e=>{const b=e.target.closest('[data-edit]');if(b)editBookmark(b.dataset.edit);};
$('#remove-icon').onclick=()=>{stopWebsiteIcon();websiteIconEnabled=false;websiteIconUrl='';customIcon='';customIconMask='';bookmarkGlyph='auto';$('#bookmark-icon').value='';renderBookmarkIconPicker();$('#bookmark-icon-status').textContent='保存后使用本地统一图形；也可点击自动获取网站图标。';};
async function imageIcon(file,website=false){
  const allowed=website?/^image\/(png|jpeg|webp|gif|x-icon|vnd.microsoft.icon|svg\+xml)$/i:/^image\/(png|jpeg|webp|gif)$/i;
  if(!allowed.test(file.type)||file.size>5*1024*1024)throw new Error('请选择 5 MB 以内的有效图标图片');
  let bitmap;
  try{bitmap=await createImageBitmap(file);}catch(error){
    if(!website)throw error;
    const objectUrl=URL.createObjectURL(file),image=new Image();
    try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('图标解码超时')),2500);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(new Error('图标解码失败'));};image.src=objectUrl;});}
    catch(error){URL.revokeObjectURL(objectUrl);throw error;}
    image.close=()=>URL.revokeObjectURL(objectUrl);bitmap=image;
  }
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),size=Math.min(128/bitmap.width,128/bitmap.height);
  ctx.drawImage(bitmap,0,0,128,128);const originalPixels=ctx.getImageData(0,0,128,128).data;let transparent=0;
  for(let index=3;index<originalPixels.length;index+=4)if(originalPixels[index]<245)transparent++;
  const preserveAlpha=transparent/(128*128)>.005;ctx.clearRect(0,0,128,128);
  ctx.drawImage(bitmap,(128-bitmap.width*size)/2,(128-bitmap.height*size)/2,bitmap.width*size,bitmap.height*size);bitmap.close();
  const source=canvas.toDataURL('image/png'),result=buildMonochromeMask(ctx.getImageData(0,0,128,128).data,128,128,preserveAlpha);
  if(!result.bounds)return {source,mask:''};
  ctx.putImageData(new ImageData(result.pixels,128,128),0,0);
  const output=document.createElement('canvas');output.width=output.height=128;const out=output.getContext('2d'),b=result.bounds,ratio=Math.min(112/b.width,112/b.height);
  out.drawImage(canvas,b.x,b.y,b.width,b.height,(128-b.width*ratio)/2,(128-b.height*ratio)/2,b.width*ratio,b.height*ratio);
  return {source,mask:output.toDataURL('image/png')};
}
$('#bookmark-icon').onchange=()=>{
  const file=$('#bookmark-icon').files[0];if(!file)return;stopWebsiteIcon();websiteIconEnabled=false;websiteIconUrl='';const request=++bookmarkIconRequest;
  $('#bookmark-icon-status').textContent='正在去色、整理轮廓并生成统一图标…';
  pendingBookmarkIcon=(async()=>{try{const result=await imageIcon(file);if(request!==bookmarkIconRequest)return;
    customIcon=result.source;customIconMask=result.mask;renderBookmarkIconPicker();
    $('#bookmark-icon-status').textContent=result.mask?'已转为统一单色，原色缩略图仍保留在备份中。':'未识别出清晰轮廓，Dock 将使用统一通用图标；可换透明底 PNG 或选择上方图形。';
  }catch(error){if(request===bookmarkIconRequest){$('#bookmark-icon').value='';$('#bookmark-icon-status').textContent=error.message;}throw error;}})();
  pendingBookmarkIcon.catch(()=>{});
};

$('#bookmark-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;try{if(!$('#bookmark-id').value&&state.bookmarks.length>=500)throw new Error('最多保存 500 个网址');const url=normalizeUrl($('#bookmark-url').value),session=bookmarkEditorSession;if(!$('#bookmark-name').value.trim())fillBookmarkName(new URL(url).hostname.replace(/^www\./,''));if(websiteIconTimer||websiteIconEnabled&&!websiteIconUrl)fetchWebsiteIcon();if(pendingBookmarkIcon)await pendingBookmarkIcon;if(session!==bookmarkEditorSession)return;if(url!==normalizeUrl($('#bookmark-url').value))throw new Error('网址已变化，请重新保存');const name=$('#bookmark-name').value.trim();if(!name)throw new Error('请输入网站名称');const b={id:$('#bookmark-id').value||uid(),name,url,group:$('#bookmark-group').value,icon:customIcon,...(websiteIconEnabled?{websiteIcon:true,iconGrayscale:websiteIconGray,siteIconUrl:websiteIconUrl||new URL(url).origin+'/favicon.ico'}:{}),...(bookmarkGlyph!=='auto'?{glyph:bookmarkGlyph}:{}),...(customIcon&&customIconMask?{iconMask:customIconMask}:{})};const index=state.bookmarks.findIndex(n=>n.id===b.id);if(index<0)state.bookmarks.push(b);else state.bookmarks[index]=b;persist();renderBookmarks();$('#bookmark-dialog').close();toast('网址已保存');}catch(error){toast(error.message);}finally{button.disabled=false;}};
$('#add-group').onclick=()=>{groupEdit=false;$('#group-name').value='';$('#group-title').textContent='新建分组';openDialog('#group-dialog');};
$('#rename-group').onclick=()=>{groupEdit=true;$('#group-name').value=state.groups.find(g=>g.id===state.activeGroup).name;$('#group-title').textContent='重命名分组';openDialog('#group-dialog');};
$('#group-form').onsubmit=e=>{e.preventDefault();const name=$('#group-name').value.trim();if(!name)return;if(state.groups.some(g=>g.name===name&&(!groupEdit||g.id!==state.activeGroup)))return toast('这个分组名称已经存在');if(groupEdit)state.groups.find(g=>g.id===state.activeGroup).name=name;else{if(state.groups.length>=30)return toast('最多创建 30 个分组');const group={id:uid(),name};state.groups.push(group);state.activeGroup=group.id;}persist();renderBookmarks();$('#group-dialog').close();};
let deletingGroupId=null;
$('#delete-group').onclick=()=>{
  if(state.groups.length===1)return toast('请至少保留一个分组');
  const group=state.groups.find(g=>g.id===state.activeGroup);if(!group)return;
  deletingGroupId=group.id;$('#group-delete-message').textContent=`“${group.name}”中有 ${state.bookmarks.filter(b=>b.group===group.id).length} 个网址。可连同网址删除，或将网址移至其他分组。`;
  openDialog('#group-delete-dialog');
};
function deleteGroup(contents){
  const group=state.groups.find(g=>g.id===deletingGroupId),target=state.groups.find(g=>g.id!==deletingGroupId);if(!group||!target)return;
  deleteWithUndo(contents?'分组及网址已删除':'分组已删除，网址已保留',()=>{
    if(contents)removeBookmarksAndEmptyFolders(new Set(state.bookmarks.filter(b=>b.group===group.id).map(b=>b.id)));
    else state.bookmarks.forEach(b=>{if(b.group===group.id)b.group=target.id;});
    state.groups=state.groups.filter(g=>g.id!==group.id);state.activeGroup='all';
  },()=>$('#group-delete-dialog').close());
}
$('#group-delete-all').onclick=()=>deleteGroup(true);
$('#group-delete-keep').onclick=()=>deleteGroup(false);

function renderTodos(){const done=state.todos.filter(t=>t.done).length;$('#todo-count').textContent=`${done}/${state.todos.length}`;$('#todo-list').innerHTML=state.todos.length?state.todos.map(t=>`<div class="todo-item ${t.done?'done':''}"><input type="checkbox" id="todo-${esc(t.id)}" data-todo="${esc(t.id)}" ${t.done?'checked':''}><label for="todo-${esc(t.id)}">${esc(t.text)}</label><button data-delete-todo="${esc(t.id)}" aria-label="删除待办 ${esc(t.text)}">${icon('x')}</button></div>`).join(''):'<div class="todo-empty">暂无待办</div>';$('#todo-progress').style.width=`${state.todos.length?done/state.todos.length*100:0}%`;$('#todo-message').textContent=done===state.todos.length?'全部完成':`剩余 ${state.todos.length-done} 项`;$('.todo-bottom').hidden=!state.todos.length;}
$('#todo-form').onsubmit=e=>{e.preventDefault();const text=$('#todo-input').value.trim();if(!text)return;if(state.todos.length>=300)return toast('待办已达上限，请清理已完成事项');state.todos.push({id:uid(),text,done:false});persist();renderTodos();$('#todo-input').value='';$('#todo-list').scrollTop=$('#todo-list').scrollHeight;};
$('#todo-list').onchange=e=>{const t=state.todos.find(t=>t.id===e.target.dataset.todo);if(t){t.done=e.target.checked;persist();renderTodos();}};
$('#todo-list').onclick=e=>{const b=e.target.closest('[data-delete-todo]');if(b){state.todos=state.todos.filter(t=>t.id!==b.dataset.deleteTodo);persist();renderTodos();}};
$('#clear-todos').onclick=()=>{const count=state.todos.filter(t=>t.done).length;if(!count)return toast('还没有已完成的待办');state.todos=state.todos.filter(t=>!t.done);persist();renderTodos();toast(`已清理 ${count} 项已完成待办`);};
$('#notes').value=state.notes;$('#notes').oninput=e=>{state.notes=e.target.value;$('#note-length').textContent=`${state.notes.length} 字`;$('#note-status').textContent=persist()?'已保存':'保存失败';};
function renderTimer(){const seconds=secondsLeft(state.timer);$('#timer').innerHTML=`${String(Math.floor(seconds/60)).padStart(2,'0')}<span>:</span>${String(seconds%60).padStart(2,'0')}`;$('#timer-toggle').innerHTML=`${icon(state.timer.deadline?'pause':'play')}<span>${state.timer.deadline?'暂停':seconds<state.timer.minutes*60&&seconds>0?'继续':state.timer.minutes===25?'开始专注':'开始休息'}</span>`;$('#timer-caption').textContent=seconds===0?(state.timer.minutes===25?'专注完成':'休息结束'):state.timer.deadline?'计时中':seconds<state.timer.minutes*60?'已暂停':'未开始';$$('[data-minutes]').forEach(b=>b.classList.toggle('active',Number(b.dataset.minutes)===state.timer.minutes));}
function finishTimer(){state.timer.deadline=null;state.timer.remaining=0;persist();renderTimer();toast(state.timer.minutes===25?'专注完成':'休息结束');try{const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx){const ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=660;gain.gain.setValueAtTime(.08,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.8);osc.start();osc.stop(ctx.currentTime+.8);osc.onended=()=>ctx.close();}}catch{/* The visible completion message remains available without audio. */}}
$('#timer-toggle').onclick=()=>{if(state.timer.deadline){state.timer.remaining=secondsLeft(state.timer);state.timer.deadline=null;}else{if(state.timer.remaining<=0)state.timer.remaining=state.timer.minutes*60;state.timer.deadline=Date.now()+state.timer.remaining*1000;}persist();renderTimer();};
function resetTimer(minutes=state.timer.minutes){state.timer={minutes,remaining:minutes*60,deadline:null};persist();renderTimer();}
$('#timer-reset').onclick=()=>resetTimer();$$('[data-minutes]').forEach(b=>b.onclick=()=>resetTimer(Number(b.dataset.minutes)));
async function fetchWithTimeout(url,options={}){
  const controller=new AbortController();
  const abort=()=>controller.abort();
  const cleanup=()=>{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);};
  const timer=setTimeout(()=>{controller.abort();cleanup();},12000);
  if(options.signal?.aborted){controller.abort();cleanup();}
  else options.signal?.addEventListener('abort',abort,{once:true});
  controller.signal.addEventListener('abort',cleanup,{once:true});
  try{const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok)throw new Error(`请求失败 (${response.status})`);return response;}
  catch(error){cleanup();throw error;}
}
let weatherNetwork=new AbortController(),cityRequest=0;
function resetWeatherNetwork(){weatherNetwork.abort();weatherNetwork=new AbortController();++weatherRequest;++cityRequest;$('#city-results').replaceChildren();}
function syncWeatherPrivacy(){
  document.body.classList.toggle('weather-off',!state.weatherEnabled);
  $('#weather-enabled').checked=state.weatherEnabled;
  $('#city-input').disabled=!state.weatherEnabled;
  $('#city-form button').disabled=!state.weatherEnabled;
  $('#locate').disabled=!state.weatherEnabled;
  $('#city-status').textContent=state.weatherEnabled?'只保存和发送保留一位小数的坐标。城市搜索词会发送给 Open-Meteo。':'天气联网已关闭，不请求天气、搜索城市或获取定位。';
}
$('#weather-enabled').addEventListener('change',()=>{
  state.weatherEnabled=$('#weather-enabled').checked;
  resetWeatherNetwork();persist();syncWeatherPrivacy();loadWeather();
});
async function loadWeather(){
  const request=++weatherRequest;
  $('#weather-city').textContent=state.location.name;
  $('#weather-temp').innerHTML='--<small>°</small>';
  $('#weather-forecast').replaceChildren();weatherCache=null;
  if(!state.weatherEnabled){$('#weather-detail').textContent='天气联网已关闭 · 点击城市设置可开启';return;}
  $('#weather-detail').textContent='正在获取实时天气…';
  const {latitude,longitude}=coarseLocation(state.location);
  try{
    const res=await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`,{signal:weatherNetwork.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    const data=await res.json();if(request!==weatherRequest)return;
    if(!Number.isFinite(data.current?.temperature_2m)||!Array.isArray(data.daily?.time))throw new Error('天气数据格式无效');
    weatherCache=data;renderWeather(data);
  }catch{if(request!==weatherRequest)return;$('#weather-detail').textContent='天气暂不可用，点击右上角重试';$('#weather-forecast').replaceChildren();}
}
function renderWeather(data){const current=data.current;const [description,symbol]=weatherLabel(current.weather_code);$('#weather-temp').innerHTML=`${Math.round(current.temperature_2m)}<small>°</small>`;$('#weather-art').innerHTML=icon(symbol);$('#weather-detail').textContent=`${description} · 湿度 ${current.relative_humidity_2m}%`;$('#weather-forecast').innerHTML=data.daily.time.slice(0,3).map((d,i)=>`<div>${i===0?'今天':i===1?'明天':'后天'} · ${weatherLabel(data.daily.weather_code[i])[0]}<b>${Math.round(data.daily.temperature_2m_min[i])}° / ${Math.round(data.daily.temperature_2m_max[i])}°</b></div>`).join('');}
$('#weather-refresh').onclick=loadWeather;$('#weather-location').onclick=()=>{syncWeatherPrivacy();openDialog('#weather-dialog');};
$('#city-form').onsubmit=async e=>{
  e.preventDefault();if(!state.weatherEnabled)return;
  const query=$('#city-input').value.trim();if(query.length<2)return $('#city-status').textContent='请输入至少两个字符';
  const request=++cityRequest;$('#city-status').textContent='正在搜索城市…';$('#city-results').replaceChildren();
  try{
    const res=await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=zh&format=json`,{signal:weatherNetwork.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    const data=await res.json();if(request!==cityRequest||!state.weatherEnabled)return;
    const cities=(Array.isArray(data.results)?data.results:[]).slice(0,5);
    $('#city-status').textContent=cities.length?'选择你的城市：':'没有找到城市，可试试英文名称。';
    cities.forEach(city=>{let location;try{location=coarseLocation(city);}catch{return;}
      const b=document.createElement('button');b.className='city-result';b.textContent=`${city.name} · ${[city.admin1,city.country].filter(Boolean).join('，')}`;
      b.onclick=()=>{if(request!==cityRequest||!state.weatherEnabled)return;state.location=location;++cityRequest;persist();$('#weather-dialog').close();loadWeather();};$('#city-results').append(b);
    });
  }catch{if(request===cityRequest&&state.weatherEnabled)$('#city-status').textContent='城市搜索失败，请检查网络后重试。';}
};
$('#locate').onclick=()=>{
  if(!state.weatherEnabled)return;
  if(!navigator.geolocation)return $('#city-status').textContent='当前浏览器不支持定位，请搜索城市。';
  const request=++cityRequest;$('#city-results').replaceChildren();$('#city-status').textContent='等待浏览器定位授权…';
  navigator.geolocation.getCurrentPosition(pos=>{
    if(request!==cityRequest||!state.weatherEnabled)return;
    try{state.location=coarseLocation({name:'当前位置（近似）',latitude:pos.coords.latitude,longitude:pos.coords.longitude});persist();$('#weather-dialog').close();loadWeather();}
    catch{$('#city-status').textContent='定位坐标无效，请搜索城市。';}
  },()=>{if(request===cityRequest&&state.weatherEnabled)$('#city-status').textContent='定位未成功，请允许定位或手动搜索城市。';},{enableHighAccuracy:false,timeout:15000,maximumAge:300000});
};
function feedMessage(message){$('#feed-content').innerHTML=`<div class="feed-message">${esc(message)}</div>`;}
function renderRssForm(){const form=document.createElement('form');form.className='rss-form';form.innerHTML=`<input type="url" aria-label="RSS 订阅地址" placeholder="输入 RSS / Atom 订阅地址" value="${esc(state.rss)}" required><button class="secondary-button">订阅</button>`;form.onsubmit=e=>{e.preventDefault();try{state.rss=normalizeUrl(form.querySelector('input').value);persist();loadFeed();}catch(error){toast(error.message);}};if(state.rss){const clear=document.createElement('button');clear.type='button';clear.className='secondary-button';clear.textContent='取消订阅';clear.onclick=()=>{state.rss='';persist();loadFeed();};form.append(clear);}$('#feed-content').append(form);}
async function loadFeed(){const request=++feedRequest;$$('[data-feed]').forEach(b=>{b.classList.toggle('active',b.dataset.feed===activeFeed);b.setAttribute('aria-selected',String(b.dataset.feed===activeFeed));});
  if(activeFeed==='rss'&&!state.rss){feedMessage('添加 RSS 订阅地址。');renderRssForm();return;}
  feedMessage('正在加载…');
  try{if(activeFeed==='github'){const date=new Date(Date.now()-30*86400000).toISOString().slice(0,10);const res=await fetchWithTimeout(`https://api.github.com/search/repositories?q=created:>${date}&sort=stars&order=desc&per_page=3`,{headers:{Accept:'application/vnd.github+json'}});const data=await res.json();if(request!==feedRequest)return;if(!Array.isArray(data.items))throw new Error('数据格式无效');$('#feed-content').innerHTML=`<div class="feed-list">${data.items.map(r=>`<a class="feed-item" href="${esc(normalizeUrl(r.html_url))}" target="_blank" rel="noopener noreferrer"><b>${esc(r.full_name)}</b><p>★ ${Number(r.stargazers_count).toLocaleString()} · ${esc(r.description||'暂无描述')}</p></a>`).join('')}</div><div class="source">最近 30 天创建 · 按星标数排序</div>`;
  }else{const res=await fetchWithTimeout(state.rss);const xml=await res.text();if(request!==feedRequest)return;const doc=new DOMParser().parseFromString(xml,'text/xml');if(doc.querySelector('parsererror')||!doc.querySelector('rss,feed,RDF'))throw new Error('不是有效的 RSS / Atom 订阅源');const items=[...doc.querySelectorAll('item,entry')].slice(0,6);if(!items.length)throw new Error('此订阅源暂无文章');const list=document.createElement('div');list.className='feed-list';for(const item of items){const raw=item.querySelector('link[rel="alternate"]')?.getAttribute('href')||item.querySelector('link')?.getAttribute('href')||item.querySelector('link')?.textContent;let link;try{link=normalizeUrl(new URL(raw,state.rss).href);}catch{continue;}const a=document.createElement('a');a.className='feed-item';a.href=link;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.querySelector('title')?.textContent||'未命名文章';list.append(a);}if(!list.children.length)throw new Error('订阅源没有有效的文章链接');$('#feed-content').replaceChildren(list);renderRssForm();}
  }catch(error){if(request!==feedRequest)return;if(activeFeed==='github'){$('#feed-content').innerHTML='<div class="feed-message">GitHub 内容加载失败或接口限流，稍后可点击刷新。 <a href="https://github.com/trending" target="_blank" rel="noopener noreferrer">打开 GitHub Trending ↗</a></div>';}else{feedMessage(`读取失败：${error.message}。请检查订阅地址；若源站未开放 CORS，纯静态主页无法直接读取。`);renderRssForm();}}
}
$$('[data-feed]').forEach(b=>b.onclick=()=>{activeFeed=b.dataset.feed;loadFeed();});$('#feed-refresh').onclick=loadFeed;
const mediaDb=new Promise((resolve,reject)=>{const req=indexedDB.open('qipage-media',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
mediaDb.catch(()=>{});
async function mediaStore(action,value){const db=await mediaDb;return new Promise((resolve,reject)=>{const transaction=db.transaction('files',action==='get'?'readonly':'readwrite'),store=transaction.objectStore('files');const req=action==='get'?store.get('wallpaper'):action==='delete'?store.delete('wallpaper'):store.put(value,'wallpaper');let result;req.onsuccess=()=>result=req.result;transaction.oncomplete=()=>resolve(result);transaction.onerror=transaction.onabort=()=>reject(transaction.error||new Error('壁纸保存失败'));});}
let wallpaperRenderRequest=0,themeColorRequest=0;
const wallpaperColors={forest:'#55796d',dusk:'#8c6178',ocean:'#477d92'};
const clockWallpaperColors={forest:'#90aaa1',dusk:'#a58c9f',ocean:'#8ba9b4'};
let clockWallpaperPixels=null,clockFrameSampleTime=0;
function clockSourceColor(pixels,width,height){
  const region=$('.clock-surface').getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight;
  const rect=region.width?region:{left:vw/2-200,top:vh*.15,width:400,height:130};
  const scale=Math.max(vw/width,vh/height),offsetX=(width*scale-vw)/2,offsetY=(height*scale-vh)/2;
  const edge=(value,offset,dimension)=>Math.max(0,Math.min(63,Math.floor((value+offset)/scale/dimension*64)));
  const x1=edge(rect.left,offsetX,width),x2=edge(rect.left+rect.width,offsetX,width),y1=edge(rect.top,offsetY,height),y2=edge(rect.top+rect.height,offsetY,height);
  const sum=[0,0,0];let count=0;
  for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){
    const i=(y*64+x)*4;if(i+3>=pixels.length||pixels[i+3]<128)continue;
    for(let c=0;c<3;c++)sum[c]+=pixels[i+c];count++;
  }
  if(!count)for(let i=0;i+3<pixels.length;i+=4){if(pixels[i+3]<128)continue;for(let c=0;c<3;c++)sum[c]+=pixels[i+c];count++;}
  if(!count)return null;
  return '#'+sum.map(value=>Math.round(value/count).toString(16).padStart(2,'0')).join('');
}
function clockBackdropWithShade(){
  const rect=$('.clock-surface').getBoundingClientRect(),y=rect.height?(rect.top+rect.height/2)/window.innerHeight:.2;
  // 与页面 .shade 的三个渐变色标相同，先合成壁纸遮罩，再比较底板上的字色。
  const stops=[[0,[20,44,44],64/255],[.35,[16,43,36],77/255],[1,[16,35,30],156/255]];
  const start=y<=.35?stops[0]:stops[1],end=y<=.35?stops[1]:stops[2],ratio=Math.max(0,Math.min(1,(y-start[0])/(end[0]-start[0])));
  const alpha=start[2]+(end[2]-start[2])*ratio;
  return '#'+[1,3,5].map((index,c)=>Math.round(parseInt(state.clockBackdropColor.slice(index,index+2),16)*(1-alpha)+(start[1][c]+(end[1][c]-start[1][c])*ratio)*alpha).toString(16).padStart(2,'0')).join('');
}
function applyClockAppearance(){
  const color=state.clockColorMode==='auto'?globalThis.QiPageCore.bestClockColor(clockBackdropWithShade(),state.clockBackgroundColor,state.clockBackgroundOpacity):state.clockColor;
  const style=document.body.style;style.setProperty('--clock-text-color',color);
  style.setProperty('--clock-background-rgb',[1,3,5].map(index=>parseInt(state.clockBackgroundColor.slice(index,index+2),16)).join(' '));
  style.setProperty('--clock-background-alpha',state.clockBackgroundOpacity/100);
  document.body.classList.toggle('clock-panel-off',state.clockBackgroundOpacity===0);
  $('#clock-contrast-status').textContent=state.clockColorMode==='auto'?`当前自动选择：${color==='#ffffff'?'白色':'黑色'}文字。`:'正在使用手动文字颜色。';
}
function syncClockSettings(){
  $('#clock-color-mode').value=state.clockColorMode;
  $('#clock-color').value=state.clockColorMode==='auto'?document.body.style.getPropertyValue('--clock-text-color'):state.clockColor;
  $('#clock-background-color').value=state.clockBackgroundColor;
  $('#clock-background-opacity').value=state.clockBackgroundOpacity;$('#clock-background-opacity-value').value=state.clockBackgroundOpacity.toFixed(2);
}
function openClockSettings(){applyClockAppearance();syncClockSettings();openDialog('#clock-settings-dialog');}
function setClockColor(mode,color=state.clockColor){
  state.clockColorMode=mode;state.clockColor=color;persist();applyClockAppearance();syncClockSettings();
  if(mode==='auto')applyWallpaper();
}
$('#clock-settings-open').onclick=openClockSettings;
$('#clock-color-mode').onchange=event=>setClockColor(event.target.value);
$('#clock-color').oninput=event=>setClockColor('manual',event.target.value);
$('#clock-background-color').oninput=event=>{state.clockBackgroundColor=event.target.value;persist();applyClockAppearance();syncClockSettings();};
function setClockOpacity(value){if(!Number.isFinite(value)||value<0||value>60)return;state.clockBackgroundOpacity=Math.round(value*100)/100;persist();applyClockAppearance();syncClockSettings();}
$('#clock-background-opacity').oninput=event=>setClockOpacity(Number(event.target.value));
$('#clock-background-opacity-value').oninput=event=>{const text=event.target.value;setClockOpacity(event.target.valueAsNumber);event.target.value=text;};
$('#clock-background-opacity-value').onblur=syncClockSettings;
$('#clock-detect-color').onclick=()=>setClockColor('auto');
window.addEventListener('resize',()=>{if(clockWallpaperPixels){const p=clockWallpaperPixels;state.clockBackdropColor=clockSourceColor(p.data,p.width,p.height)||state.clockBackdropColor;}applyClockAppearance();syncClockSettings();});
$('#video-wallpaper').addEventListener('timeupdate',()=>{
  const video=$('#video-wallpaper');
  if(document.hidden||state.wallpaper!=='custom'||video.hidden||video.readyState<2||state.clockColorMode!=='auto'||Date.now()-clockFrameSampleTime<2000)return;
  clockFrameSampleTime=Date.now();
  try{const result=sampleWallpaperPixels(video);clockWallpaperPixels=result.pixels;if(result.clock)state.clockBackdropColor=result.clock;applyClockAppearance();syncClockSettings();}catch{/* 保留最后一次可读取画面的对比色。 */}
});
function activeThemeColor(){return state.themeColorMode==='wallpaper'?state.wallpaperThemeColor:state.themeColor;}
function applyThemeColors(){
  const p=globalThis.QiPageCore.themePalette(activeThemeColor(),document.body.classList.contains('light'),state.opacity),style=document.body.style;
  for(const [name,value]of Object.entries({accent:p.accent,dialog:p.dialog,text:p.text,muted:p.muted,panel:p.surface,input:p.control,'panel-rgb':p.panel,'theme-surface':p.surface,'theme-surface-text':p.text,'theme-dialog-text':p.dialogText,'theme-control':p.control,'theme-control-text':p.controlText,'theme-primary-text':p.primaryText,'theme-search-text':p.searchText,'theme-icon-text':p.iconText,'theme-icon-bg':p.iconBackground,'theme-icon-ink':p.iconInk,'theme-folder-bg':p.folderBackground,'theme-search':p.search,'theme-rgb':p.rgb}))style.setProperty(`--${name}`,value);
  style.setProperty('--line',p.text==='#000000'?'rgb(0 0 0 / .24)':'rgb(255 255 255 / .24)');
  $('meta[name="theme-color"]').content=p.dialog;
}
function syncThemeSettings(){
  $('#theme-color-mode').value=state.themeColorMode;
  $('#theme-color-picker').value=$('#theme-color-hex').value=activeThemeColor();
  $('#theme-color-hex').setCustomValidity('');
  $$('[data-theme-color]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeColor===activeThemeColor())));
  $('#theme-color-status').textContent=state.themeColorMode==='wallpaper'?'主题色随当前壁纸更新；图片本地取色，视频取当前画面。':'手动主题色已应用；切换壁纸不会覆盖此颜色。';
}
function selectThemeColor(value){
  if(!/^#[a-f\d]{6}$/i.test(value))return false;
  ++themeColorRequest;state.themeColor=value.toLowerCase();state.themeColorMode='manual';persist();applyThemeColors();syncThemeSettings();return true;
}
$('#theme-color-picker').addEventListener('input',event=>selectThemeColor(event.target.value));
$('#theme-color-hex').addEventListener('change',event=>{
  const text=event.target.value.trim(),value=text.startsWith('#')?text:'#'+text;
  if(!selectThemeColor(value)){event.target.setCustomValidity('请输入六位 HEX 颜色，例如 #537ea5');event.target.reportValidity();}
});
$('#theme-color-hex').addEventListener('input',event=>event.target.setCustomValidity(''));
$$('[data-theme-color]').forEach(button=>button.onclick=()=>selectThemeColor(button.dataset.themeColor));
$('#theme-color-mode').addEventListener('change',()=>{
  ++themeColorRequest;state.themeColorMode=$('#theme-color-mode').value;persist();applyThemeColors();syncThemeSettings();
  if(state.themeColorMode==='wallpaper')applyWallpaper();
});
$('#theme-color-refresh').onclick=()=>{state.themeColorMode='wallpaper';persist();applyThemeColors();syncThemeSettings();applyWallpaper();};
function waitWallpaperMedia(element,eventName){
  return new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);element.removeEventListener(eventName,ready);element.removeEventListener('error',failed);error?reject(error):resolve();};
    const ready=()=>finish(),failed=()=>finish(new Error('壁纸画面无法读取'));
    const timer=setTimeout(()=>finish(new Error('壁纸取色超时')),5000);
    element.addEventListener(eventName,ready,{once:true});element.addEventListener('error',failed,{once:true});
  });
}
function sampleWallpaperPixels(source){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0,64,64);
  const data=context.getImageData(0,0,64,64).data,width=source.videoWidth||source.naturalWidth||source.width||64,height=source.videoHeight||source.naturalHeight||source.height||64;
  return {theme:globalThis.QiPageCore.extractThemeColor(data),clock:clockSourceColor(data,width,height),pixels:{data,width,height}};
}
async function wallpaperFileColor(file){
  if(file.type.startsWith('video/')){
    const video=$('#video-wallpaper');if(video.readyState<2)await waitWallpaperMedia(video,'loadeddata');
    return sampleWallpaperPixels(video);
  }
  if(typeof createImageBitmap==='function'){
    let bitmap;
    try{bitmap=await createImageBitmap(file);}catch{/* 某些浏览器不支持此图片格式的位图解码。 */}
    if(bitmap){try{return sampleWallpaperPixels(bitmap);}finally{bitmap.close();}}
  }
  const image=new Image(),url=URL.createObjectURL(file);
  try{const loaded=waitWallpaperMedia(image,'load');image.src=url;await loaded;return sampleWallpaperPixels(image);}finally{URL.revokeObjectURL(url);}
}
async function updateWallpaperTheme(file,render){
  if(state.themeColorMode!=='wallpaper'&&state.clockColorMode!=='auto')return;
  const request=++themeColorRequest,wallpaper=state.wallpaper;
  if(state.themeColorMode==='wallpaper')$('#theme-color-status').textContent='正在从壁纸提取主题色…';
  try{
    const result=wallpaperColors[wallpaper]?{theme:wallpaperColors[wallpaper],clock:clockWallpaperColors[wallpaper],pixels:null}:await wallpaperFileColor(file);
    if(render!==wallpaperRenderRequest)return;
    let changed=false;
    clockWallpaperPixels=result.pixels;clockFrameSampleTime=Date.now();
    if(result.clock&&result.clock!==state.clockBackdropColor){state.clockBackdropColor=result.clock;changed=true;}
    if(request===themeColorRequest&&state.themeColorMode==='wallpaper'){
      if(!result.theme)throw new Error('壁纸没有可用颜色');
      if(state.wallpaperThemeColor!==result.theme){state.wallpaperThemeColor=result.theme;changed=true;}
      applyThemeColors();syncThemeSettings();$('#theme-color-status').textContent='已随当前壁纸更新主题色。';
    }
    if(changed)persist();applyClockAppearance();syncClockSettings();
  }catch{
    if(request===themeColorRequest&&render===wallpaperRenderRequest&&state.themeColorMode==='wallpaper')$('#theme-color-status').textContent='暂时无法读取壁纸颜色，已保留上次主题色；可重试或手动选择。';
  }
}
async function applyWallpaper(){
  const render=++wallpaperRenderRequest;++themeColorRequest;
  $('#video-wallpaper').pause();$('#video-wallpaper').hidden=true;$('#video-wallpaper').removeAttribute('src');$('#video-wallpaper').load();$('#wallpaper').style.backgroundImage='';$('#wallpaper').style.filter='';if(wallpaperObjectUrl){URL.revokeObjectURL(wallpaperObjectUrl);wallpaperObjectUrl=null;}document.body.dataset.wallpaper=state.wallpaper;
  $$('[data-wallpaper]').forEach(b=>b.classList.toggle('active',b.dataset.wallpaper===state.wallpaper));
  if(state.wallpaper!=='custom'){await updateWallpaperTheme(null,render);return;}
  try{
    const file=await mediaStore('get');if(render!==wallpaperRenderRequest||state.wallpaper!=='custom')return;
    if(!file)throw new Error('自定义壁纸已丢失');wallpaperObjectUrl=URL.createObjectURL(file);
    if(file.type.startsWith('video/')){
      const video=$('#video-wallpaper');video.src=wallpaperObjectUrl;video.hidden=false;
      await video.play().catch(()=>{if(render===wallpaperRenderRequest)toast('自动播放被浏览器限制，可重新选择静态壁纸。');});
    }else $('#wallpaper').style.backgroundImage=`url("${wallpaperObjectUrl}")`;
    if(render===wallpaperRenderRequest)await updateWallpaperTheme(file,render);
  }catch{if(render===wallpaperRenderRequest)toast('自定义壁纸不可用，请重新上传；已显示默认风景。');}
}
function applyPreferences(){applyDockPreferences();const light=state.theme==='light'||state.theme==='system'&&matchMedia('(prefers-color-scheme: light)').matches;document.body.classList.toggle('light',light);applyThemeColors();applyClockAppearance();document.documentElement.style.setProperty('--icon-size',`${state.iconSize}px`);document.documentElement.style.setProperty('--columns',state.columns);document.documentElement.style.setProperty('--panel-alpha',state.opacity/100);$('.widgets').hidden=!state.showWidgets;$('.discovery').hidden=!state.showDiscovery;}
function syncSettings(){syncClockSettings();syncThemeSettings();syncDockSettings();syncWeatherPrivacy();for(const [id,value]of Object.entries({theme:state.theme,'icon-size':state.iconSize,columns:state.columns,opacity:state.opacity}))$(`#${id}`).value=value;for(const [id,value]of Object.entries({'show-widgets':state.showWidgets,'show-discovery':state.showDiscovery,'new-tab':state.newTab}))$(`#${id}`).checked=value;$('#icon-size-value').textContent=`${state.iconSize}px`;$('#opacity-value').textContent=`${state.opacity}%`;}
function toggleZen(){globalThis.QiPageLayout?.toggle();}
$('#zen-toggle').onclick=toggleZen;
$('#settings-open').onclick=()=>{syncSettings();openDialog('#settings-dialog');};$('#wallpaper-open').onclick=()=>{syncSettings();openDialog('#settings-dialog');$('#wallpaper-upload').closest('section').scrollIntoView({block:'center'});};
for(const [id,key]of Object.entries({theme:'theme','icon-size':'iconSize',columns:'columns',opacity:'opacity','show-widgets':'showWidgets','show-discovery':'showDiscovery','new-tab':'newTab'}))$(`#${id}`).addEventListener(['icon-size','opacity'].includes(id)?'input':'change',e=>{state[key]=e.target.type==='checkbox'?e.target.checked:['icon-size','columns','opacity'].includes(id)?Number(e.target.value):e.target.value;persist();applyPreferences();syncSettings();});
matchMedia('(prefers-color-scheme: light)').addEventListener('change',applyPreferences);
$$('[data-wallpaper]').forEach(b=>b.onclick=()=>{state.wallpaper=b.dataset.wallpaper;persist();applyWallpaper();});
$('#wallpaper-upload').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(!['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'].includes(file.type)||file.size>30*1024*1024)throw new Error('请选择 30 MB 内的 JPG、PNG、WebP、GIF、MP4 或 WebM 文件');$('#wallpaper-status').textContent='正在保存壁纸…';await mediaStore('put',file);state.wallpaper='custom';persist();await applyWallpaper();$('#wallpaper-status').textContent=`已保存：${file.name} · 仅保存在此浏览器`;toast('壁纸已更新');}catch(error){$('#wallpaper-status').textContent=error.message;toast('壁纸上传失败：'+error.message);}finally{e.target.value='';}};
const readDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
$('#export-data').onclick=async()=>{const button=$('#export-data');button.disabled=true;try{const backup=structuredClone(state);backup.exportedAt=new Date().toISOString();if(state.wallpaper==='custom'){const file=await mediaStore('get');if(!file)throw new Error('自定义壁纸缺失，请选择内置壁纸或重新上传后再导出');backup.wallpaperData=await readDataUrl(file);}const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`栖页备份-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('备份已导出');}catch(error){toast('导出失败：'+error.message);}finally{button.disabled=false;}};
$('#import-data').onchange=async e=>{const file=e.target.files[0];if(!file)return;pendingImport=null;$('#import-confirm').hidden=true;try{if(file.size>48*1024*1024)throw new Error('备份文件过大');const raw=JSON.parse(await file.text()),validated=validateBackup(raw);validated.weatherEnabled=false;let wallpaper=null;if(raw.wallpaperData){if(typeof raw.wallpaperData!=='string'||!/^data:(image\/(jpeg|png|webp|gif)|video\/(mp4|webm));base64,[a-z\d+/=]+$/i.test(raw.wallpaperData))throw new Error('备份中的壁纸格式无效');wallpaper=await (await fetch(raw.wallpaperData)).blob();if(wallpaper.size>30*1024*1024)throw new Error('备份壁纸超过 30 MB');}if(validated.wallpaper==='custom'&&!wallpaper)throw new Error('备份缺少自定义壁纸');pendingImport={state:validated,wallpaper};$('#import-confirm').hidden=false;toast('备份验证通过，请确认导入');}catch(error){toast('导入失败：'+error.message);}finally{e.target.value='';}};
let browserImportEntries=null,browserImportRequest=0,browserImportTree;
const browserImportSelected=new Set();
function browserImportPayload(){return {format:'qipage.browser-bookmarks',version:1,bookmarks:[...browserImportSelected].sort((a,b)=>a-b).map(index=>browserImportEntries[index])};}
function browserImportOptions(){return {groupId:$('#browser-bookmarks-group').value,keepFolders:$('#browser-bookmarks-folders').checked};}
function syncBrowserImport(){
  if(!browserImportEntries)return;
  browserImportTree?.sync();
  try{
    const plan=globalThis.QiPageCore.planBrowserBookmarkImport(state,browserImportPayload(),browserImportOptions());
    $('#browser-bookmarks-status').textContent=`文件共 ${browserImportEntries.length} 项，已选 ${browserImportSelected.size} 项；将追加 ${plan.added} 个网址、${plan.foldersAdded} 个文件夹，跳过 ${plan.duplicates} 个重复地址。`;
    $('#browser-bookmarks-confirm').disabled=!plan.added;
  }catch(error){$('#browser-bookmarks-status').textContent=error.message;$('#browser-bookmarks-confirm').disabled=true;}
}
function selectAvailableBrowserBookmarks(){
  browserImportSelected.clear();const urls=new Set(state.bookmarks.map(bookmark=>bookmark.url)),remaining=500-state.bookmarks.length;
  browserImportEntries.forEach((entry,index)=>{if(browserImportSelected.size>=remaining||urls.has(entry.url))return;urls.add(entry.url);browserImportSelected.add(index);});
  syncBrowserImport();
}
$('#browser-bookmarks-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;const request=++browserImportRequest;
  try{
    if(file.size>5*1024*1024)throw new Error('书签导入文件不能超过 5 MB');
    const entries=globalThis.QiPageCore.validateBrowserBookmarkFile(JSON.parse(await file.text()));if(request!==browserImportRequest)return;
    browserImportEntries=entries;
    $('#browser-bookmarks-group').innerHTML=(state.groups.length<30?'<option value="new">浏览器书签（新建或复用）</option>':'')+state.groups.map(group=>`<option value="${esc(group.id)}">${esc(group.name)}</option>`).join('');
    $('#browser-bookmarks-folders').checked=true;
    browserImportTree=QiPageBookmarkTree.mount($('#browser-bookmarks-list'),entries,browserImportSelected,syncBrowserImport);
    selectAvailableBrowserBookmarks();openDialog('#browser-bookmarks-dialog');
  }catch(error){if(request===browserImportRequest)toast(error.message||'书签文件读取失败');}
  finally{event.target.value='';}
};
$('#browser-bookmarks-all').onclick=selectAvailableBrowserBookmarks;
$('#browser-bookmarks-clear').onclick=()=>{browserImportSelected.clear();syncBrowserImport();};
$('#browser-bookmarks-group').onchange=$('#browser-bookmarks-folders').onchange=syncBrowserImport;
$('#browser-bookmarks-dialog').addEventListener('close',()=>{++browserImportRequest;browserImportEntries=null;browserImportSelected.clear();$('#browser-bookmarks-list').replaceChildren();});
$('#browser-bookmarks-confirm').onclick=()=>{
  if(!browserImportEntries)return;
  try{
    const plan=globalThis.QiPageCore.planBrowserBookmarkImport(state,browserImportPayload(),browserImportOptions());if(!plan.added)return;
    const previous=state;state=plan.state;if(!persist()){state=previous;return;}
    renderBookmarks();$('#browser-bookmarks-dialog').close();toast(`已导入 ${plan.added} 个书签`);
  }catch(error){$('#browser-bookmarks-status').textContent=error.message;$('#browser-bookmarks-confirm').disabled=true;}
};
$('#cancel-import').onclick=()=>{pendingImport=null;$('#import-confirm').hidden=true;};
$('#confirm-import').onclick=async()=>{if(!pendingImport)return;const button=$('#confirm-import');button.disabled=true;try{const next=pendingImport;/* Check localStorage before replacing the current state or media. */localStorage.setItem(KEY,JSON.stringify(next.state));try{if(next.wallpaper)await mediaStore('put',next.wallpaper);}catch(error){localStorage.setItem(KEY,JSON.stringify(state));throw error;}resetWeatherNetwork();state=next.state;pendingImport=null;$('#import-confirm').hidden=true;$('#notes').value=state.notes;$('#note-length').textContent=`${state.notes.length} 字`;renderEngines();renderBookmarks();renderTodos();renderTimer();applyPreferences();syncSettings();await applyWallpaper();loadWeather();loadFeed();toast('备份已恢复');}catch(error){toast('恢复失败，当前数据已保留：'+error.message);}finally{button.disabled=false;}};
icons();renderEngines();renderBookmarks();renderTodos();renderTimer();updateClock();applyPreferences();syncSettings();applyWallpaper();loadWeather();loadFeed();$('#note-length').textContent=`${state.notes.length} 字`;
startClock();
setInterval(()=>{if(state.timer.deadline&&secondsLeft(state.timer)<=0)finishTimer();else renderTimer();},1000);
setInterval(()=>{if(!document.hidden)loadWeather();},30*60*1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopClock();else{updateClock();startClock();if(state.timer.deadline&&secondsLeft(state.timer)<=0)finishTimer();else renderTimer();}});
window.addEventListener('pageshow',startClock);
window.addEventListener('pagehide',()=>{stopClock();if(wallpaperObjectUrl)URL.revokeObjectURL(wallpaperObjectUrl);});
if(restoreWarning)toast(restoreWarning);else if(!storageAvailable)toast('本地存储不可用，请及时导出备份');
requestAnimationFrame(()=>{if(!$('dialog[open]'))$('#search').focus({preventScroll:true});});

document.addEventListener('qipage:layoutchange',()=>{dockEditing=false;dockSelection.clear();if(document.body.dataset.view==='minimal'){managing=false;$('#manage-bookmarks').setAttribute('aria-pressed','false');}renderBookmarks();if(clockWallpaperPixels){const p=clockWallpaperPixels;state.clockBackdropColor=clockSourceColor(p.data,p.width,p.height)||state.clockBackdropColor;}applyClockAppearance();syncClockSettings();});
document.addEventListener('qipage:notice',event=>toast(event.detail));
document.addEventListener('qipage:context-action',event=>{const {action,bookmarkId}=event.detail;
  if(action==='dock-edit')setDockEditing(true);
  if(action==='dock-edit-done')setDockEditing(false);
  if(action==='clock-settings')openClockSettings();
  if(action==='clock-auto')setClockColor('auto');
  if(action==='clock-white')setClockColor('manual','#ffffff');
  if(action==='clock-black')setClockColor('manual','#000000');
  if(action==='dock-settings')openDockSettings();
  if(action==='new-folder')editDockFolder();
  if(action==='import-bookmarks')$('#browser-bookmarks-file').click();
  if(action==='open-folder')openDockFolder(bookmarkId);
  if(action==='edit-folder')editDockFolder(bookmarkId);
  if(action==='delete-folder')requestDeleteDockFolder(bookmarkId);
  if(action==='add-bookmark')editBookmark();
  if(action==='edit-bookmark')editBookmark(bookmarkId);
  if(action==='move-out-folder')moveBookmarkOutOfFolder(bookmarkId);
  if(action==='move-folder-to-dock')moveFolderToDock(bookmarkId);
  if(action==='folder-edit'){cancelFolderPress();setFolderEditing(!folderEditing);folderSuppressClick=false;}
  if(action==='delete-folder-bookmark')deleteFolderBookmark(bookmarkId);
  if(action==='engines')openEngineManager();
  if(action==='settings'){$('#settings-open').click();}
  if(action==='wallpaper'){$('#wallpaper-open').click();}
  if(action==='manage-bookmarks'){globalThis.QiPageLayout.setMode('expanded');managing=true;$('#manage-bookmarks').setAttribute('aria-pressed','true');renderBookmarks();}
});

})();
