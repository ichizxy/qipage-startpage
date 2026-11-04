(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  let entries = [], skipped = 0, tree;
  const selected = new Set();
  function sync() {
    $('#bookmarks-status').textContent = `${entries.length} 个可用书签，已选 ${selected.size} 个${skipped ? `；跳过 ${skipped} 个重复或不支持的网址` : ''}。`;
    $('#bookmarks-download').disabled = !selected.size || selected.size > 500;
    tree?.sync();
  }
  $('#read-bookmarks').addEventListener('click', async () => {
    const button = $('#read-bookmarks');
    // 权限请求必须直接由用户点击发起，读取前不执行其他异步操作。
    try {
      const permission = chrome.permissions.request({ permissions: ['bookmarks'] });
      entries = []; selected.clear(); $('#bookmarks-list').replaceChildren(); $('#bookmarks-preview').hidden = true;
      button.disabled = true;
      if (!await permission) throw new Error('未授权读取书签，可再次点击重试。');
      const result = QiPageBookmarkTransfer.collect(await chrome.bookmarks.getTree());
      entries = result.entries; skipped = result.skipped; selected.clear();
      entries.slice(0, 500).forEach((_, index) => selected.add(index));
      tree=QiPageBookmarkTree.mount($('#bookmarks-list'),entries,selected,sync,500,()=>{ $('#bookmarks-status').textContent='每次最多选择 500 项，请减少选择。'; });
      $('#bookmarks-preview').hidden = false; sync();
    } catch (error) { $('#bookmarks-status').textContent = error.message || '书签读取失败，请重试。'; }
    finally { button.disabled = false; }
  });
  $('#bookmarks-select-all').onclick = () => { selected.clear(); entries.slice(0, 500).forEach((_, index) => selected.add(index)); sync(); };
  $('#bookmarks-clear').onclick = () => { selected.clear(); sync(); };
  $('#bookmarks-home').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('home.html') });
  $('#bookmarks-download').onclick = () => {
    try {
      const data = QiPageBookmarkTransfer.makeFile([...selected].sort((a,b) => a-b).map(index => entries[index]));
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = '栖页-浏览器书签.json'; document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('#bookmarks-status').textContent = '导入文件已下载。在主页「个性化设置 → 导入浏览器书签」中选择该文件。';
    } catch (error) { $('#bookmarks-status').textContent = error.message; }
  };
})();
