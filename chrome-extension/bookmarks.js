(() => {
  'use strict';
  function collect(tree) {
    const entries = [], seen = new Set();
    let skipped = 0, visited = 0;
    function walk(nodes, path, depth) {
      if (depth > 32) throw new Error('文件夹嵌套超过 32 层，请分批整理后导入。');
      for (const node of nodes || []) {
        if (++visited > 50000) throw new Error('书签数量过多，请分批整理后导入。');
        if (node.url) {
          try {
            const url = new URL(node.url);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 4096) throw new Error();
            if (seen.has(url.href)) { skipped++; continue; }
            seen.add(url.href);
            entries.push({ title: String(node.title || url.hostname).slice(0, 1024), url: url.href, path: [...path] });
          } catch { skipped++; }
        } else if (Array.isArray(node.children)) {
          const name = String(node.title || '').trim().slice(0, 256);
          const next = name ? [...path, name] : path;
          if (next.join('/').length > 4096) throw new Error('文件夹路径过长，请整理后导入。');
          walk(node.children, next, depth + 1);
        }
      }
    }
    if (!Array.isArray(tree)) throw new Error('浏览器书签数据无效。');
    walk(tree, [], 0);
    return { entries, skipped };
  }
  function makeFile(entries) {
    if (!entries.length || entries.length > 500) throw new Error('请选择 1 至 500 个书签。');
    return { format: 'qipage.browser-bookmarks', version: 1, bookmarks: entries };
  }
  globalThis.QiPageBookmarkTransfer = Object.freeze({ collect, makeFile });
})();
