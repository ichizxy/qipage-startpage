chrome.action.onClicked.addListener(async tab => {
  if (Number.isInteger(tab.id)) {
    await chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('home.html') });
  }
});
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
