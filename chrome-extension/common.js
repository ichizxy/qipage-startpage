(() => {
  const DEFAULT_URL = '';
  function normalizeTarget(value) {
    let input = String(value ?? '').trim();
    if (!input || /[\u0000-\u001f\u007f]/.test(input)) throw new Error('请输入完整网址或本地文件路径。');
    if (/^[a-z]:[\\/]/i.test(input)) {
      // Treat # and ? as filename characters when converting a native Windows path.
      input = 'file:///' + input.replace(/\\/g, '/').split('/').map((part, index) => index === 0 ? part : encodeURIComponent(part)).join('/');
    }
    let url;
    try { url = new URL(input); } catch { throw new Error('地址格式无效，请使用 file:///、https:// 或 http:// 开头的完整地址。'); }
    if (!['file:', 'http:', 'https:'].includes(url.protocol)) throw new Error('只支持 file://、http:// 和 https:// 地址。');
    if (url.username || url.password) throw new Error('请勿在地址中包含账号密码。');
    if (url.protocol === 'file:' && (url.pathname === '/' || url.pathname.endsWith('/'))) throw new Error('请选择具体的 HTML 文件，而不是文件夹。');
    return url.href;
  }
  async function getTarget() {
    const data = await chrome.storage.local.get({ targetUrl: DEFAULT_URL });
    return data.targetUrl === '' ? '' : normalizeTarget(data.targetUrl);
  }
  async function openTarget(tabId) {
    const url = await getTarget();
    if (!url) {
      await chrome.tabs.update(tabId, { url: chrome.runtime.getURL('options.html') });
      return;
    }
    if (url.startsWith('file:') && !await chrome.extension.isAllowedFileSchemeAccess()) {
      throw new Error('请先在扩展详情中打开“允许访问文件网址”，然后重试。');
    }
    await chrome.tabs.update(tabId, { url });
  }
  globalThis.QiPageHome = { DEFAULT_URL, normalizeTarget, getTarget, openTarget };
})();
