async function navigateHome() {
  const status = document.querySelector('#status');
  status.textContent = '正在打开已保存的主页…';
  try {
    const tab = await chrome.tabs.getCurrent();
    if (!Number.isInteger(tab?.id)) throw new Error('无法找到当前标签页，请重试。');
    await QiPageHome.openTarget(tab.id);
  } catch (error) {
    status.textContent = error.message || '打开失败，请检查地址及文件访问权限。';
  }
}
document.querySelector('#retry').addEventListener('click', navigateHome);
document.querySelector('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.querySelector('#permissions').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id }));
navigateHome();
