import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';

const root = new URL('../chrome-extension/', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
function setup({ stored, allowed = true } = {}) {
  const calls = [];
  const chrome = {
    storage: { local: { get: async defaults => ({ ...defaults, ...(stored === undefined ? {} : { targetUrl: stored }) }), set: async data => calls.push(['save', data]) } },
    extension: { isAllowedFileSchemeAccess: async () => allowed },
    tabs: { update: async (...args) => calls.push(['update', ...args]), create: async data => calls.push(['create', data]), getCurrent: async () => ({ id: 7 }) },
    runtime: { id: 'test-id', getURL: path => 'chrome-extension://test-id/' + path, openOptionsPage: async () => calls.push(['options']) }
  };
  const context = createContext({ URL, chrome });
  runInContext(read('common.js'), context);
  return { api: context.QiPageHome, calls, chrome };
}
test('扩展覆盖新标签页到共用入口，仅请求保存配置与本地文件权限', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.optional_permissions, ['bookmarks']);
  assert.deepEqual(manifest.host_permissions, ['file:///*']);
  assert.deepEqual(manifest.chrome_url_overrides, { newtab: 'home.html' });
  assert.equal(manifest.chrome_settings_overrides, undefined);
  for (const file of [manifest.options_page, manifest.background.service_worker, 'home.html']) assert.ok(read(file));
});
test('新标签页使用已保存的自定义地址，在原标签页完成导航', async () => {
  const manifest = JSON.parse(read('manifest.json'));
  const { chrome, calls } = setup({ stored: 'file:///D:/custom/index.html' });
  const dom = new JSDOM(read(manifest.chrome_url_overrides.newtab), { runScripts: 'outside-only' });
  try {
    dom.window.chrome = chrome;
    dom.window.eval(read('common.js'));
    dom.window.eval(read('home.js'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'update');
    assert.equal(calls[0][1], 7);
    assert.equal(calls[0][2].url, 'file:///D:/custom/index.html');
  } finally { dom.window.close(); }
});
test('本地路径保留中文、空格、特殊文件名，支持 URL 查询片段', () => {
  const { api } = setup();
  assert.equal(api.normalizeTarget('D:\\我的主页\\a #?%.html'), 'file:///D:/%E6%88%91%E7%9A%84%E4%B8%BB%E9%A1%B5/a%20%23%3F%25.html');
  assert.equal(api.normalizeTarget('d:/home/index.html'), 'file:///d:/home/index.html');
  assert.equal(api.normalizeTarget(' file:///D:/home/index.html?q=1#dock '), 'file:///D:/home/index.html?q=1#dock');
  assert.equal(api.normalizeTarget('https://example.com'), 'https://example.com/');
  for (const value of ['', 'javascript:alert(1)', 'data:text/html,a', 'chrome://settings', 'chrome-extension://id/home.html', 'https://a:b@example.com', 'file:///D:/home/', 'abc', 'https://exa\nmple.com']) assert.throws(() => api.normalizeTarget(value));
});
test('首次使用在当前标签页打开设置，不导航到开发者电脑的路径', async () => {
  const { api, calls } = setup();
  assert.equal(await api.getTarget(), '');
  await api.openTarget(7);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'update');
  assert.equal(calls[0][1], 7);
  assert.equal(calls[0][2].url, 'chrome-extension://test-id/options.html');
});
test('未授权文件访问不导航，在线地址不需要文件访问', async () => {
  const denied = setup({ allowed: false, stored: 'file:///D:/custom/index.html' });
  await assert.rejects(denied.api.openTarget(7), /允许访问文件网址/);
  assert.equal(denied.calls.length, 0);
  const online = setup({ allowed: false, stored: 'https://example.com/start' });
  await online.api.openTarget(7);
  assert.equal(online.calls[0][2].url, 'https://example.com/start');
  const invalid = setup({ stored: 'javascript:alert(1)' });
  await assert.rejects(invalid.api.openTarget(7));
  assert.equal(invalid.calls.length, 0);
});
test('主页入口显示权限错误并允许重试，不发生重定向循环', async () => {
  const { chrome, calls } = setup({ allowed: false, stored: 'file:///D:/custom/index.html' });
  const dom = new JSDOM(read('home.html'), { runScripts: 'outside-only' });
  dom.window.chrome = chrome;
  dom.window.eval(read('common.js'));
  dom.window.eval(read('home.js'));
  await new Promise(resolve => setImmediate(resolve));
  assert.match(dom.window.document.querySelector('#status').textContent, /允许访问文件网址/);
  assert.equal(calls.length, 0);
  chrome.extension.isAllowedFileSchemeAccess = async () => true;
  dom.window.document.querySelector('#retry').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[0][0], 'update');
  dom.window.close();
});
test('选项保存规范化地址，并提供实际扩展主页入口', async () => {
  const { chrome, calls } = setup();
  const dom = new JSDOM(read('options.html'), { runScripts: 'outside-only' });
  dom.window.chrome = chrome;
  dom.window.eval(read('common.js'));
  dom.window.eval(read('options.js'));
  await new Promise(resolve => setImmediate(resolve));
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#entry').value, 'chrome-extension://test-id/home.html');
  assert.equal(doc.querySelector('#target').value, '');
  assert.equal(doc.querySelector('#status').classList.contains('error'), false);
  doc.querySelector('#target').value = 'D:\\custom\\index.html';
  doc.querySelector('#target-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[0][0], 'save');
  assert.equal(calls[0][1].targetUrl, 'file:///D:/custom/index.html');
  doc.querySelector('#target').value = 'javascript:alert(1)';
  doc.querySelector('#preview').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.ok(doc.querySelector('#status').classList.contains('error'));
  dom.window.close();
});

test('HTTP 主页仍可保存但显示风险提示，本地主页保持支持', async () => {
  const {chrome,calls}=setup({stored:'http://example.com/'});
  const dom=new JSDOM(read('options.html'),{runScripts:'outside-only'});
  try {
    dom.window.chrome=chrome;dom.window.eval(read('common.js'));dom.window.eval(read('options.js'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(dom.window.document.querySelector('#status').textContent,/未加密/);
    await dom.window.save();
    assert.equal(calls[0][1].targetUrl,'http://example.com/');
    assert.match(dom.window.document.querySelector('#status').textContent,/篡改/);
    dom.window.document.querySelector('#target').value='D:\\home\\index.html';
    await dom.window.save();assert.equal(calls[1][1].targetUrl,'file:///D:/home/index.html');
  } finally {dom.window.close();}
});

test('扩展 CSP 限制联网和嵌入内容，保留本地打包脚本和样式', () => {
  const policy=JSON.parse(read('manifest.json')).content_security_policy.extension_pages;
  for(const rule of ["script-src 'self'","style-src 'self'","connect-src 'none'","object-src 'none'","frame-src 'none'","base-uri 'none'"])assert.ok(policy.includes(rule));
});
