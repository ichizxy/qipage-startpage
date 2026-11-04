import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const directories = ['', 'chrome-extension/', 'scripts/', 'tests/'];
let count = 0;
for (const directory of directories) {
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:m?js)$/.test(entry.name)) continue;
    const file = new URL(directory + entry.name, root);
    const result = spawnSync(process.execPath, ['--check', fileURLToPath(file)], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
    count++;
  }
}
console.log(`语法检查通过：${count} 个 JavaScript 文件。`);
