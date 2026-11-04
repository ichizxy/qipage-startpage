const target = document.querySelector('#target');
const entry = document.querySelector('#entry');
const status = document.querySelector('#status');
entry.value = chrome.runtime.getURL('home.html');
function report(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}
async function loadSettings() {
  try { target.value = await QiPageHome.getTarget(); if(target.value.startsWith('http:'))report('当前主页使用未加密的 HTTP，公网主页建议改用 HTTPS。'); }
  catch (error) { target.value = QiPageHome.DEFAULT_URL; report(error.message, true); }
  try {
    document.querySelector('#file-status').textContent = await chrome.extension.isAllowedFileSchemeAccess() ? '文件访问：已启用' : '文件访问：尚未启用';
  } catch { document.querySelector('#file-status').textContent = '无法读取文件访问状态，请在扩展详情中查看。'; }
}
async function save(open = false) {
  try {
    const url = QiPageHome.normalizeTarget(target.value);
    await chrome.storage.local.set({ targetUrl: url });
    target.value = url;
    const allowed = !url.startsWith('file:') || await chrome.extension.isAllowedFileSchemeAccess();
    report(url.startsWith('http:') ? '地址已保存。注意：HTTP 页面未加密，可能被网络攻击者篡改；公网主页建议使用 HTTPS。' : allowed ? '地址已保存。' : '地址已保存；请开启“允许访问文件网址”后再打开。');
    if (open) await chrome.tabs.create({ url: chrome.runtime.getURL('home.html') });
  } catch (error) { report(error.message || '保存失败，请重试。', true); }
}
document.querySelector('#target-form').addEventListener('submit', event => { event.preventDefault(); save(); });
document.querySelector('#preview').addEventListener('click', () => save(true));
document.querySelector('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(entry.value); report('入口地址已复制，请粘贴到 Chrome 的主页设置。'); }
  catch { entry.focus(); entry.select(); report('已选中入口地址，请按 Ctrl+C 复制。'); }
});
document.querySelector('#appearance').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://settings/appearance' }));
document.querySelector('#startup').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://settings/onStartup' }));
document.querySelector('#permissions').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id }));
window.addEventListener('focus', () => {
  chrome.extension.isAllowedFileSchemeAccess().then(allowed => {
    document.querySelector('#file-status').textContent = allowed ? '文件访问：已启用' : '文件访问：尚未启用';
  }).catch(() => {});
});
loadSettings();
