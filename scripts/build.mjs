import { cp, mkdir, mkdtemp, rename, rm, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const output = resolve(dist, 'qipage-startpage');
// 显式清单避免把测试依赖、私人配置或参考网页带入发布包。
const entries = [
  'index.html', 'style.css', 'layout.css', 'core.js', 'engine-icons.js',
  'app.js', 'layout.js', 'assets', 'chrome-extension', 'previews',
  'README.md', 'docs',
];
async function rejectSymlinks(path) {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error(`发布路径不能是符号链接：${path}`);
}
// 清理只允许发生在真实项目内的固定发布目录，拒绝目录链接。
await rejectSymlinks(root);
await mkdir(dist, { recursive: true });
await rejectSymlinks(dist);
if (!output.startsWith(dist + sep)) throw new Error('发布目录越界');
try { await rejectSymlinks(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const staging = await mkdtemp(resolve(dist, '.staging-'));
try {
  for (const entry of entries) {
    await mkdir(resolve(staging, entry, '..'), { recursive: true });
    await cp(resolve(root, entry), resolve(staging, entry), {
      recursive: true,
      filter: async source => { await rejectSymlinks(source); return true; },
    });
  }
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
} finally {
  await rm(staging, { recursive: true, force: true });
}
console.log('发布目录：dist/qipage-startpage（直接打开 index.html，或部署为静态站点）');
