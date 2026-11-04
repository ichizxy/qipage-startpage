(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const search = $('#search');
  const form = $('#search-form');
  const menu = $('#context-menu');
  const dock = $('#bookmarks');
  const dockTooltip = $('#dock-tooltip');
  // Escape the Dock stacking context, but keep the editor anchored to its position.
  const dockToolbar=$('#dock-edit-toolbar');
  document.body.append(dockToolbar);
  const dockConfig = () => globalThis.QiPageDock.getSettings();
  let tooltipAnchor = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let dockFrame = null;
  let dockPointerX = null;
  let context = null;
  let pendingPaste = null;
  let keyboardNavigation = false;
  const notice = message => document.dispatchEvent(new CustomEvent('qipage:notice', { detail: message }));
  const emit = (action, bookmarkId) => document.dispatchEvent(new CustomEvent('qipage:context-action', { detail: { action, bookmarkId } }));
  const getMode = () => document.body.dataset.view === 'expanded' ? 'expanded' : 'minimal';
  function clearFocus() { document.body.classList.remove('search-focused'); hideDockTooltip(); }
  function focusSearch() {
    if ($('dialog[open]')) return;
    resetDock();
    search.focus({ preventScroll: true });
    document.body.classList.add('search-focused');
  }
  function closeMenu(restoreFocus = false) {
    menu.hidden = true;
    if (restoreFocus && context?.target?.isConnected) context.target.focus({ preventScroll: true });
  }
  function setMode(mode) {
    const next = mode === 'expanded' ? 'expanded' : 'minimal';
    closeMenu();
    resetDock();
    clearFocus();
    const changed = getMode() !== next;
    document.body.dataset.view = next;
    document.body.classList.remove('zen');
    const button = $('#zen-toggle');
    button.innerHTML = $('#expand-home').innerHTML;
    button.setAttribute('aria-label', next === 'expanded' ? '收起为极简主页' : '展开完整主页');
    button.setAttribute('aria-pressed', String(next === 'expanded'));
    button.title = '切换极简 / 完整主页 · Alt+Z';
    $('#expand-home').setAttribute('aria-expanded', String(next === 'expanded'));
    if (changed) {
      document.dispatchEvent(new CustomEvent('qipage:layoutchange', { detail: next }));
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    refreshDockPosition();
  }
  const toggle = () => setMode(getMode() === 'minimal' ? 'expanded' : 'minimal');
  globalThis.QiPageLayout = Object.freeze({ setMode, toggle, getMode, clearFocus, focusSearch });
  $('#expand-home').addEventListener('click', () => setMode('expanded'));
  function resetDock() {
    hideDockTooltip();
    if (dockFrame !== null) cancelAnimationFrame(dockFrame);
    dockFrame = null; dockPointerX = null;
    dock.classList.remove('dock-active');
    dock.querySelectorAll('.bookmark').forEach(item => {
      item.style.removeProperty('--dock-scale');
      item.style.removeProperty('--dock-shift');
      item.style.removeProperty('--dock-lift');
    });
  }
  function updateDock() {
    dockFrame = null;
    if (getMode() !== 'minimal' || dockPointerX === null || reducedMotion.matches || !menu.hidden || $('dialog[open]') || document.body.classList.contains('search-focused')) return resetDock();
    const items = [...dock.querySelectorAll('.bookmark:not(.bookmark-add-item)')];
    const geometry = items.map(item => {
      const bounds = item.getBoundingClientRect();
      const settings=dockConfig();
      const distance = Math.min(1, Math.abs(dockPointerX - (bounds.left + bounds.width / 2)) / settings.dockRadius);
      const scale = 1 + (settings.dockScale-1) * (1 + Math.cos(Math.PI * distance)) / 2;
      return { item, scale, extra: bounds.width * (scale - 1) };
    });
    const extraWidth = geometry.reduce((sum, entry) => sum + entry.extra, 0);
    let offset = -extraWidth / 2;
    for (const { item, scale, extra } of geometry) {
      item.style.setProperty('--dock-scale', scale.toFixed(4));
      item.style.setProperty('--dock-shift', `${(offset + extra / 2).toFixed(3)}px`);
      item.style.setProperty('--dock-lift', `${(-7 * (scale - 1)).toFixed(3)}px`);
      offset += extra;
    }
    dock.classList.add('dock-active');
    positionDockTooltip();
  }
  function magnifyDock(clientX) {
    if (getMode() !== 'minimal' || reducedMotion.matches || !dockConfig().dockZoom || document.body.classList.contains('dock-editing') || document.body.classList.contains('dock-dragging')) return resetDock();
    dockPointerX = clientX;
    if (dockFrame === null) dockFrame = requestAnimationFrame(updateDock);
  }
  function hideDockTooltip() {
    dockTooltip.hidden = true;
    tooltipAnchor?.removeAttribute('aria-describedby');
    tooltipAnchor = null;
  }
  function positionDockTooltip(){
    if(dockTooltip.hidden||!tooltipAnchor?.isConnected)return;
    const bounds=dockTooltip.getBoundingClientRect(),iconBounds=tooltipAnchor.querySelector('.site-icon').getBoundingClientRect();
    const center=iconBounds.left+iconBounds.width/2;
    dockTooltip.style.left=`${Math.max(8,Math.min(center-bounds.width/2,window.innerWidth-bounds.width-8))}px`;
    const top=iconBounds.top>=bounds.height+18?iconBounds.top-bounds.height-10:iconBounds.bottom+10;
    dockTooltip.style.top=`${Math.max(8,Math.min(top,window.innerHeight-bounds.height-8))}px`;
  }
  function showDockTooltip(anchor, clientX) {
    if (getMode() !== 'minimal' || !dockConfig().dockTooltip || document.body.classList.contains('dock-sorting') || document.body.classList.contains('dock-dragging') || !menu.hidden || $('dialog[open]') || document.body.classList.contains('search-focused')) return hideDockTooltip();
    if (tooltipAnchor !== anchor) tooltipAnchor?.removeAttribute('aria-describedby');
    tooltipAnchor = anchor;
    anchor.setAttribute('aria-describedby', 'dock-tooltip');
    dockTooltip.textContent = anchor.getAttribute('aria-label') || '';
    dockTooltip.hidden = false;
    positionDockTooltip();
  }
  dock.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return hideDockTooltip();
    magnifyDock(event.clientX);
    const anchor = event.target.closest('[data-bookmark-id],[data-folder-id]');
    if (anchor) showDockTooltip(anchor, event.clientX); else hideDockTooltip();
  });
  dock.addEventListener('pointerleave', resetDock);
  dock.addEventListener('pointercancel', resetDock);
  const endDockInteraction=()=>{keyboardNavigation=false;resetDock();};
  dock.addEventListener('click', endDockInteraction);
  window.addEventListener('blur', endDockInteraction);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)endDockInteraction();});
  dock.addEventListener('focusin', event => {
    const item = event.target.closest('.bookmark');
    if (item) {
      const bounds = item.getBoundingClientRect(), x = bounds.left + bounds.width / 2;
      // 鼠标点击和弹窗关闭后的自动恢复焦点，不应重新触发放大。
      if(keyboardNavigation)magnifyDock(x);
      const anchor = event.target.closest('[data-bookmark-id],[data-folder-id]');
      if (anchor) showDockTooltip(anchor, x);
    }
  });
  dock.addEventListener('focusout', event => { if (!dock.contains(event.relatedTarget)) resetDock(); });
  dock.addEventListener('scroll', () => { if (dockPointerX !== null) magnifyDock(dockPointerX); });
  document.addEventListener('qipage:layoutchange', resetDock);
  reducedMotion.addEventListener('change', resetDock);
  const overflowButtons=[-1,1].map(direction=>{
    const button=document.createElement('button');button.type='button';button.className='dock-overflow '+(direction<0?'dock-overflow-left':'dock-overflow-right');
    button.textContent='…';button.hidden=true;button.setAttribute('aria-label',direction<0?'向前循环滚动 Dock':'向后循环滚动 Dock');button.title='还有更多图标，可用滚轮循环浏览';
    button.onclick=()=>scrollDock(direction*Math.max(80,dock.clientWidth*.7));dock.parentElement.append(button);return button;
  });
  function syncDockOverflow(){
    const overflow=getMode()==='minimal'&&dock.scrollWidth>dock.clientWidth+1;
    overflowButtons.forEach(button=>button.hidden=!overflow);
  }
  let dockWheelRemainder=0,dockSnapTimer,dockWheelGeometry=null,dockSnapRelease,dockSnapping=false;
  const dockStep=()=>{const rows=[...dock.querySelectorAll('.bookmark:not(.bookmark-add-item)')];return Math.abs((rows[1]?.offsetLeft||0)-(rows[0]?.offsetLeft||0))||dockConfig().dockSize+12||54;};
  function shiftDockRows(offset,animate=false){dock.querySelectorAll('.bookmark:not(.bookmark-add-item)').forEach(row=>{row.style.transition=animate&&!reducedMotion.matches?'translate .18s ease-out':'none';row.style.translate=`${offset}px 0`;});}
  function rotateDock(direction){const rows=[...dock.querySelectorAll('.bookmark:not(.bookmark-add-item)')];if(rows.length<2)return;if(direction>0)dock.insertBefore(rows[0],dock.querySelector('.bookmark-add-item'));else dock.insertBefore(rows.at(-1),rows[0]);}
  function finishDockWheel(){clearTimeout(dockSnapTimer);clearTimeout(dockSnapRelease);dockWheelRemainder=0;dockWheelGeometry=null;dockSnapping=false;shiftDockRows(0);}
  document.addEventListener('qipage:dock-preferences',finishDockWheel);
  document.addEventListener('qipage:layoutchange',finishDockWheel);
  window.addEventListener('resize',finishDockWheel);
  function scrollDock(delta){
    if(getMode()!=='minimal'||!delta)return;
    if(dockSnapping){const row=dock.querySelector('.bookmark:not(.bookmark-add-item)'),offset=parseFloat(row?getComputedStyle(row).translate:'0');dockWheelRemainder=Number.isFinite(offset)?-offset:0;shiftDockRows(-dockWheelRemainder);dockSnapping=false;}
    clearTimeout(dockSnapRelease);
    // Translated icons can change scrollWidth. Keep geometry stable for the entire gesture.
    dockWheelGeometry??={max:dock.scrollWidth-dock.clientWidth,step:dockStep()};
    const {max,step}=dockWheelGeometry;
    resetDock();
    if(max<=1){
      const items=[...dock.querySelectorAll('.bookmark:not(.bookmark-add-item)')];if(items.length<2)return;
      dockWheelRemainder+=delta;
      while(Math.abs(dockWheelRemainder)>=step){const direction=Math.sign(dockWheelRemainder);rotateDock(direction);dockWheelRemainder-=direction*step;}
      shiftDockRows(-dockWheelRemainder);clearTimeout(dockSnapTimer);
      dockSnapTimer=setTimeout(()=>{
        if(Math.abs(dockWheelRemainder)>=step/2){const direction=Math.sign(dockWheelRemainder);rotateDock(direction);dockWheelRemainder-=direction*step;shiftDockRows(-dockWheelRemainder);}
        void dock.offsetWidth;shiftDockRows(0,true);dockSnapping=true;
        dockSnapRelease=setTimeout(()=>{dockWheelRemainder=0;dockWheelGeometry=null;dockSnapping=false;},190);
      },200);return;
    }
    const current=Math.max(0,Math.min(max,dock.scrollLeft));
    dock.scrollLeft=delta>0&&current>=max-1?0:delta<0&&current<=1?max:Math.max(0,Math.min(max,current+delta));
    clearTimeout(dockSnapTimer);dockSnapTimer=setTimeout(()=>{const left=Math.max(0,Math.min(max,Math.round(dock.scrollLeft/step)*step));if(dock.scrollTo)dock.scrollTo({left,behavior:reducedMotion.matches?'instant':'smooth'});else dock.scrollLeft=left;dockSnapRelease=setTimeout(()=>{dockWheelGeometry=null;},220);},200);
  }
  dock.parentElement.addEventListener('wheel',event=>{
    if(event.ctrlKey||getMode()!=='minimal'||document.body.classList.contains('dock-sorting')||document.body.classList.contains('dock-dragging'))return;
    if(dock.scrollWidth<=dock.clientWidth+1&&dock.querySelectorAll('.bookmark:not(.bookmark-add-item)').length<2)return;
    const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    if(!delta)return;event.preventDefault();scrollDock(delta*(event.deltaMode===1?16:event.deltaMode===2?dock.clientWidth:1));
  },{passive:false});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(syncDockOverflow).observe(dock);
  document.addEventListener('qipage:dock-preferences',syncDockOverflow);
  document.addEventListener('qipage:layoutchange',syncDockOverflow);
  window.addEventListener('resize',syncDockOverflow);

  form.addEventListener('pointerdown', () => document.body.classList.add('search-focused'));
  search.addEventListener('input', () => document.body.classList.add('search-focused'));
  form.addEventListener('keydown', event => {
    if (!['Tab', 'Escape', 'ContextMenu'].includes(event.key)) document.body.classList.add('search-focused');
  });
  form.addEventListener('focusout', event => {
    if (!form.contains(event.relatedTarget) && !menu.contains(event.relatedTarget)) clearFocus();
  });
  document.addEventListener('focusin', event => {
    if (keyboardNavigation && form.contains(event.target)) document.body.classList.add('search-focused');
  });
  document.addEventListener('pointerdown', event => {
    keyboardNavigation = false;
    if (!menu.contains(event.target)) closeMenu();
    if (!form.contains(event.target) && !menu.contains(event.target)) {
      clearFocus();
      if (form.contains(document.activeElement)) document.activeElement.blur();
    }
  });

  function editable(element) {
    return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement && ['text', 'search', 'url', 'email', 'tel', 'password'].includes(element.type);
  }
  function snapshot(target) {
    const field = editable(target) ? target : null;
    const bookmark = target.closest('[data-bookmark-id],[data-folder-id],#dock-folder-items [data-folder-open]');
    return {
      target: field,
      start: field?.selectionStart ?? 0,
      end: field?.selectionEnd ?? 0,
      selected: field ? field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0) : '',
      bookmarkId: bookmark?.dataset.bookmarkId||bookmark?.dataset.folderId||bookmark?.dataset.folderOpen,
      folder: !!(bookmark?.dataset.folderId||bookmark?.dataset.folderOpen),
      href: bookmark?.href,
      name: bookmark?.getAttribute('aria-label') || bookmark?.lastElementChild?.textContent || '网址',
      dialog: target.closest('dialog'),
    };
  }
  async function writeClipboard(text, saved) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return; } catch { /* Try the selection-based fallback. */ }
    }
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.style.cssText = 'position:fixed;left:-10000px;top:0';
    (document.querySelector('dialog[open]') || document.body).append(temporary);
    temporary.select();
    const copied = document.execCommand?.('copy');
    temporary.remove();
    if (saved?.target?.isConnected) {
      saved.target.focus();
      saved.target.setSelectionRange?.(saved.start, saved.end);
    }
    if (!copied) throw new Error('浏览器未允许复制，请使用 Ctrl+C（Mac 为 ⌘C）。');
  }
  function insertText(saved, value) {
    const target = saved?.target;
    if (!target?.isConnected || target.readOnly || target.disabled) return;
    const start = Math.min(saved.start, target.value.length);
    const end = Math.min(saved.end, target.value.length);
    if (target.maxLength >= 0) value = value.slice(0, Math.max(0, target.maxLength - (target.value.length - (end - start))));
    target.setRangeText(value, start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus({ preventScroll: true });
    if (target === search) focusSearch();
  }
  async function perform(action, saved) {
    try {
      if (action === 'copy' || action === 'cut') {
        await writeClipboard(saved.selected, saved);
        if (action === 'cut') insertText(saved, '');
        else if (saved.target?.isConnected) { saved.target.focus(); if (saved.target === search) focusSearch(); }
        notice(action === 'cut' ? '已剪切' : '已复制');
      } else if (action === 'paste') {
        try {
          if (!navigator.clipboard?.readText) throw new Error('Clipboard unavailable');
          insertText(saved, await navigator.clipboard.readText());
        } catch {
          if ($('#paste-dialog').open) { $('#paste-content').focus(); notice('请按 Ctrl+V 或 ⌘V 粘贴。'); return; }
          pendingPaste = saved;
          clearFocus();
          $('#paste-content').value = '';
          $('#paste-dialog').showModal();
          $('#paste-content').focus();
        }
      } else if (action === 'go') {
        const value = saved.selected.trim() || search.value.trim();
        if (value) { search.value = value; form.requestSubmit(); }
      } else if (action === 'toggle') toggle();
      else if (action === 'open-bookmark') window.open(saved.href, '_blank', 'noopener,noreferrer');
      else if (action === 'copy-link') { await writeClipboard(saved.href, saved); notice('网址已复制'); }
      else if (action === 'close-dialog') {
        if(saved.dialog?.id==='dock-settings-dialog')document.dispatchEvent(new CustomEvent('qipage:close-dock-settings'));
        else saved.dialog?.close();
      }
      else emit(action, saved.bookmarkId);
    } catch (error) { notice(error.message || '操作未完成，请重试。'); }
  }
  function showMenu(items, x, y, host) {
    host.append(menu);
    menu.replaceChildren();
    for (const item of items) {
      if (item.separator) {
        const divider = document.createElement('div');
        divider.className = 'context-separator'; divider.setAttribute('role', 'separator'); menu.append(divider); continue;
      }
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('role', 'menuitem'); button.disabled = !!item.disabled;
      const label = document.createElement('span'); label.textContent = item.label; button.append(label);
      if (item.key) { const key = document.createElement('kbd'); key.textContent = item.key; button.append(key); }
      button.addEventListener('click', () => { const saved = context; closeMenu(); perform(item.action, saved); });
      button.addEventListener('pointermove',()=>{if(!button.disabled&&document.activeElement!==button)button.focus({preventScroll:true});});
      menu.append(button);
    }
    menu.hidden = false;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8))}px`;
    menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  document.addEventListener('contextmenu', event => {
    event.preventDefault();
    resetDock();
    const inSearch = !!event.target.closest('#search-form');
    context = snapshot(inSearch ? search : event.target);
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
    const clipboard = [
      { action: 'copy', label: '复制', key: `${mod}C`, disabled: !context.selected },
      { action: 'paste', label: '粘贴', key: `${mod}V`, disabled: !context.target || context.target.readOnly },
      { action: 'cut', label: '剪切', key: `${mod}X`, disabled: !context.selected || context.target?.readOnly },
    ];
    let items;
    if (inSearch) {
      document.body.classList.add('search-focused');
      items = [...clipboard, { action: 'go', label: '转到', key: 'Enter', disabled: !search.value.trim() }];
    } else if (event.target.closest('dialog')) {
      clearFocus();
      if(event.target.closest('#dock-folder-items [data-folder-open]')){
        items=[{action:'open-folder',label:`打开 ${context.name}`},{action:'move-folder-to-dock',label:'移动到 Dock 栏'},{action:'delete-folder',label:'删除文件夹及内容'},{separator:true},{action:'close-dialog',label:'关闭当前窗口',key:'Esc'}];
      }else{
      items = [...(context.target ? [...clipboard, { separator: true }] : []), ...(event.target.closest('#dock-folder-items [data-bookmark-id]') ? [{ action: 'open-bookmark', label: `打开 ${context.name}` }, { action: 'edit-bookmark', label: '编辑此快捷方式' }, { action: 'copy-link', label: '复制网址' }, { action: 'move-out-folder', label: '移出文件夹' }, { action: 'delete-folder-bookmark', label: '删除网址' }, { separator: true }] : []), { action: 'close-dialog', label: '关闭当前窗口', key: 'Esc' }];
      }
      if(event.target.closest('#dock-folder-dialog'))items.unshift({action:'folder-edit',label:$('#dock-folder-items').classList.contains('folder-editing')?'退出编辑模式':'进入编辑模式'});
    } else if(event.target.closest('#clock-region')) {
      clearFocus();
      items=[{action:'clock-settings',label:'时钟外观'},{action:'clock-auto',label:'自动高对比文字'},{action:'clock-white',label:'白色文字'},{action:'clock-black',label:'黑色文字'}];
    } else if(event.target.closest('.shortcut-strip,#dock-edit-toolbar')) {
      clearFocus();
      items=[
        ...(context.folder?[{action:'open-folder',label:`打开 ${context.name}`},{action:'edit-folder',label:'整理文件夹'},{action:'delete-folder',label:'删除文件夹及内容'},{separator:true}]:context.bookmarkId?[{action:'open-bookmark',label:`打开 ${context.name}`},{action:'edit-bookmark',label:'编辑此快捷方式'},{action:'copy-link',label:'复制网址'},{separator:true}]:[]),
        {action:'add-bookmark',label:'添加快捷方式'},
        {action:'new-folder',label:'新建文件夹'},
        {action:'import-bookmarks',label:'导入浏览器书签'},
        ...(getMode()==='minimal'?[{action:document.body.classList.contains('dock-editing')?'dock-edit-done':'dock-edit',label:document.body.classList.contains('dock-editing')?'退出编辑模式':'编辑模式'}]:[]),
        {action:'dock-settings',label:'Dock 设置'},
      ];
    } else {
      clearFocus();
      items = [
        ...(context.target ? [...clipboard, { separator: true }] : []),
        ...(context.bookmarkId ? [{ action: 'open-bookmark', label: `打开 ${context.name}` }, { action: 'edit-bookmark', label: '编辑此快捷方式' }, { action: 'copy-link', label: '复制网址' }, { separator: true }] : []),
        { action: 'toggle', label: getMode() === 'minimal' ? '展开完整主页' : '收起为极简主页', key: 'Alt+Z' },
        { separator: true },
        { action: 'add-bookmark', label: '添加快捷方式' },
        { action: 'manage-bookmarks', label: '管理网址与分组' },
        { action: 'engines', label: '管理搜索引擎' },
        { action: 'wallpaper', label: '更换壁纸' },
        { action: 'settings', label: '个性化设置' },
      ];
    }
    const anchor = event.target.getBoundingClientRect();
    showMenu(items, event.clientX || anchor.left + 12, event.clientY || anchor.top + 12, event.target.closest('dialog') || document.body);
  });
  $('#paste-form').addEventListener('submit', event => {
    event.preventDefault();
    const saved = pendingPaste; pendingPaste = null;
    const value = $('#paste-content').value;
    $('#paste-dialog').close(); insertText(saved, value);
  });
  $('#paste-dialog').addEventListener('close', () => { pendingPaste = null; });
  document.addEventListener('keydown', event => {
    keyboardNavigation = event.key === 'Tab';
    if (!menu.hidden) {
      const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
      let index = buttons.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[index]?.focus(); return;
      }
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); return; }
      if (event.key === 'Tab') closeMenu();
    }
    if ($('dialog[open]')) return;
    if (event.key==='Escape'&&document.body.classList.contains('dock-editing')) { event.preventDefault();emit('dock-edit-done');return; }
    const typing = editable(document.activeElement) || document.activeElement.isContentEditable;
    if (event.key === '/' && !typing) { event.preventDefault(); focusSearch(); }
    if (event.altKey && event.code === 'KeyZ') { event.preventDefault(); toggle(); }
    if (event.key === 'Escape') {
      if (!$('#engine-menu').hidden) { $('#engine-menu').hidden = true; $('#engine-toggle').setAttribute('aria-expanded', 'false'); return; }
      if (document.body.classList.contains('search-focused')) { clearFocus(); search.blur(); }
      else if (getMode() === 'expanded') setMode('minimal');
    }
  });
  const dashboard=$('.dashboard'),dragHandle=$('#dock-drag-handle');
  let dockDrag=null;
  function positionDockToolbar(bounds=dashboard.getBoundingClientRect()){
    if(dockToolbar.hidden||getMode()!=='minimal')return;
    const toolbar=dockToolbar.getBoundingClientRect(),gap=8,margin=12;
    const left=Math.max(margin,Math.min(window.innerWidth-toolbar.width-margin,bounds.left+(bounds.width-toolbar.width)/2));
    const above=bounds.top-toolbar.height-gap;
    const preferred=above>=margin?above:bounds.bottom+gap;
    const top=Math.max(margin,Math.min(window.innerHeight-toolbar.height-margin,preferred));
    dockToolbar.style.left=`${left}px`;dockToolbar.style.top=`${top}px`;
  }
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>positionDockToolbar()).observe(dockToolbar);
  function placeDock(x,y){
    const rect=dashboard.getBoundingClientRect(),halfW=rect.width/2,halfH=rect.height/2;
    const px=Math.max(halfW+12,Math.min(window.innerWidth-halfW-12,x));
    const py=Math.max(halfH+12,Math.min(window.innerHeight-halfH-12,y));
    dashboard.style.setProperty('--dock-center-x',`${px}px`);dashboard.style.setProperty('--dock-center-y',`${py}px`);
    document.body.classList.toggle('dock-near-top',py-halfH<80);
    positionDockToolbar({left:px-halfW,top:py-halfH,bottom:py+halfH,width:rect.width});
    return {x:px/window.innerWidth*100,y:py/window.innerHeight*100};
  }
  function refreshDockPosition(){
    document.body.classList.toggle('dock-positioned',getMode()==='minimal');
    if(getMode()!=='minimal')return;
    const s=dockConfig(),r=dashboard.getBoundingClientRect();
    const position={bottom:[window.innerWidth/2,window.innerHeight-r.height/2-24],top:[window.innerWidth/2,r.height/2+16],left:[r.width/2+16,window.innerHeight/2],right:[window.innerWidth-r.width/2-16,window.innerHeight/2],custom:[s.dockX/100*window.innerWidth,s.dockY/100*window.innerHeight]}[s.dockPosition];
    placeDock(...position);
  }
  function saveDockPosition(position){document.dispatchEvent(new CustomEvent('qipage:dock-position',{detail:position}));}
  dragHandle.addEventListener('pointerdown',event=>{
    if(event.button!==0||!dockConfig().dockMovable||getMode()!=='minimal')return;
    event.preventDefault();closeMenu();clearFocus();resetDock();
    const r=dashboard.getBoundingClientRect();
    dockDrag={id:event.pointerId,offsetX:event.clientX-r.left-r.width/2,offsetY:event.clientY-r.top-r.height/2,position:null};
    document.body.classList.add('dock-dragging');dragHandle.setPointerCapture?.(event.pointerId);
  });
  dragHandle.addEventListener('pointermove',event=>{
    if(!dockDrag||event.pointerId!==dockDrag.id)return;
    dockDrag.position=placeDock(event.clientX-dockDrag.offsetX,event.clientY-dockDrag.offsetY);
  });
  function endDockDrag(event,cancel=false){
    if(!dockDrag||event.pointerId!==dockDrag.id)return;
    const saved=dockDrag;dockDrag=null;document.body.classList.remove('dock-dragging');
    if(!cancel&&saved.position)saveDockPosition(saved.position);else refreshDockPosition();
  }
  dragHandle.addEventListener('pointerup',event=>endDockDrag(event));
  dragHandle.addEventListener('pointercancel',event=>endDockDrag(event,true));
  dragHandle.addEventListener('lostpointercapture',event=>endDockDrag(event,true));
  dragHandle.addEventListener('keydown',event=>{
    if(!dockConfig().dockMovable||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const r=dashboard.getBoundingClientRect(),step=event.shiftKey?30:10;
    saveDockPosition(placeDock(r.left+r.width/2+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),r.top+r.height/2+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)));
  });
  document.addEventListener('qipage:dock-preferences',()=>{resetDock();refreshDockPosition();});
  window.addEventListener('resize', () => { closeMenu(); resetDock();refreshDockPosition(); });
  document.addEventListener('scroll', event => { if (!menu.contains(event.target)) closeMenu(); }, true);
  setMode('minimal');
  syncDockOverflow();
})();
