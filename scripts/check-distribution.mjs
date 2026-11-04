import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';

const root = new URL('../dist/qipage-startpage/', import.meta.url);
let count = 0;
async function checkReference(file, reference) {
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(reference)) return;
  const target = new URL(reference, file);
  target.hash = '';
  target.search = '';
  assert.ok(target.href.startsWith(root.href), `引用超出发布目录：${file.href} → ${reference}`);
  try { await access(target); }
  catch { throw new Error(`发布包缺少引用文件：${file.href} → ${reference}`); }
  count++;
}
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    assert.ok(!['node_modules', '.qa', '.git', '.env', '参考.html'].includes(entry.name));
    if (entry.isDirectory()) { await walk(file); continue; }
    if (!/\.(html|css|md)$/.test(entry.name)) continue;
    const source = await readFile(file, 'utf8');
    const pattern = entry.name.endsWith('.html') ? /\b(?:src|href)=["']([^"']+)["']/g
      : entry.name.endsWith('.css') ? /url\(\s*["']?([^"')]+)["']?\s*\)/g
      : /\]\(([^)]+)\)/g;
    for (const match of source.matchAll(pattern)) await checkReference(file, match[1]);
  }
}
await walk(root);
const manifest = JSON.parse(await readFile(new URL('chrome-extension/manifest.json', root), 'utf8'));
for (const entry of [manifest.options_page, manifest.background.service_worker, ...Object.values(manifest.chrome_url_overrides)]) {
  await checkReference(new URL('chrome-extension/manifest.json', root), entry);
}
console.log(`发布包检查通过：${count} 个本地资源与文档引用。`);
