# 栖页 Chrome 主页入口扩展

独立的 Manifest V3 扩展，无服务器、无构建、无远程脚本。首次使用进入设置页，填写本机 `index.html` 的完整路径或 HTTP/HTTPS 主页地址。已保存的地址在更新后继续保留。

## 安装与连接主页按钮

1. Chrome 地址栏输入 `chrome://extensions`，开启右上角「开发者模式」。
2. 点击「加载已解压的扩展程序」，选择项目中的 `chrome-extension/` 目录（不是整个项目目录）。
3. 进入扩展「详情」，打开「允许访问文件网址」。扩展仅有本地文件主机权限和保存设置所需的 storage 权限，不读取网页内容、不注入脚本、不上传数据。
4. 安装时会打开设置页；以后可从扩展详情的「扩展程序选项」进入。填写目标地址并保存。支持 Windows 绝对路径，会转换为 file URL。
5. 在设置页复制「主页入口地址」，格式为 `chrome-extension://扩展ID/home.html`。
6. Chrome「设置 → 外观 → 显示主页按钮」中，选择自定义网址并粘贴**入口地址**。不要在此处粘贴 options.html 地址。
7. 点击 Chrome 原生小房子主页按钮，通过扩展入口打开保存的目标页面。也可将本扩展固定到工具栏，点击扩展按钮打开。

主页目标以后直接在扩展选项中修改，无需重新安装。卸载扩展后，请自行将 Chrome 主页改回需要的地址。移动本项目后应更新目标路径；保留扩展目录，移除/重新加载到其他路径可能导致扩展 ID 改变，需要重新复制入口。

## 新标签页与启动页（1.1.0）

已经安装旧版时，在 `chrome://extensions` 中点击本扩展卡片上的重新加载按钮。若 Chrome 提示新标签页变更，请选择保留本扩展的更改。无需复制入口地址，点击「＋」、按 Ctrl+T 或在普通窗口打开新标签页，即会通过共用的 home.html 入口打开保存的目标；本地地址仍需允许文件访问。

若希望启动 Chrome 时也使用自定义主页，将 Chrome「设置 → 启动时」改为「打开新标签页」。扩展选项提供打开启动设置的按钮；扩展不会自动修改启动设置。选择恢复上次网页或特定网页时，Chrome 继续遵循对应设置。原生小房子按钮的手动连接方法仍有效，新标签页与它使用同一目标地址。

实现使用 `chrome_url_overrides.newtab`，不需要读取所有标签页或注入脚本。无痕窗口不能覆盖新标签页；其他新标签页扩展可能产生冲突。参考：[Chrome 页面覆盖文档](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages)。

## Chrome 限制与实现

Chrome 的 `chrome_settings_overrides.homepage` 仅接受 HTTP/HTTPS，不能写入 file 或 chrome-extension 地址；扩展也没有监听原生主页按钮点击的事件。原生主页按钮由用户手动指向扩展入口；新标签页通过 manifest 注册共用入口。入口读取 `chrome.storage.local`，检查文件访问权限，再使用 `chrome.tabs.update` 在当前标签页打开目标，无需监听所有浏览记录。

本地文件不存在时，Chrome 可能显示文件未找到页面，扩展无法通过导航结果确认文件存在；请回到选项修改。浏览器管理策略或其他扩展锁定主页时，需要先解除相关限制。

参考：[Chrome 设置覆盖文档](https://developer.chrome.com/docs/extensions/reference/manifest/chrome-settings-override)、[Chromium URL 校验源码](https://github.com/chromium/chromium/blob/main/chrome/common/extensions/manifest_handlers/settings_overrides_handler.cc)、[Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)、[文件网址访问权限](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)。

已进行地址校验和 Chrome API 模拟测试；尚未在实际 Chrome 中安装验证。Chrome 的安装确认和文件访问授权需由使用者操作。

## 安全加固

扩展入口和设置页使用显式 CSP，禁止脚本联网、插件对象和嵌入页面；该策略不影响通过标签页导航打开 file:// 本地主页，也不限制目标主页自身的正常功能。HTTP 目标仍兼容，但设置页会提示未加密风险。保留 file:///* 权限以支持本地主页；仅使用在线主页时可关闭“允许访问文件网址”。请保护扩展目录，不加载来源不明的替换代码。

默认项目主页的天气联网默认关闭，可在天气城市设置中开启；定位只保存和发送一位小数的近似坐标。便签和备份仍为明文，请勿存放密码或令牌。

## 导入浏览器原有书签（1.3.0）

1. 在 `chrome://extensions` 重新加载本扩展，打开扩展设置。
2. 在「导入浏览器书签」中点击「读取浏览器书签」，按浏览器提示授权。
3. 展开文件夹树，勾选整个文件夹或单个书签，点击「下载导入文件」；每次最多 500 项。可点击「打开主页」。
4. 在主页「个性化设置 → 数据与备份 → 导入浏览器书签」中选择下载的 JSON。
5. 查看预览，选择导入分组、是否保留文件夹层级，点击「确认追加」。

导入只追加所选网址，跳过重复地址，不替换便签、待办、设置和已有网址。主页最多保存 500 个网址、100 个 Dock 文件夹、30 个分组；预览会检查剩余容量。容量不足时减少选择、使用现有分组，或关闭文件夹归类。文件夹按原有层级嵌套导入，Dock 中可逐层打开，点击路径返回上级；层级也随备份保留。只为所选且不重复的网址创建文件夹，不导入空文件夹。仅支持 HTTP/HTTPS，脚本、本地文件及带账号密码的网址不导入。导入的网站默认使用本地图形，可逐项编辑获取网站图标。

扩展只调用浏览器书签读取接口，不更改浏览器原有书签。书签留在当前设备，通过本地下载文件转移；本功能不向网络发送书签，不向任意主页注入脚本。`bookmarks` 声明为可选权限，只有点击读取时才申请；拒绝授权不影响主页跳转。Chrome 授权提示描述的是该 API 的完整能力，当前代码仅使用 `getTree()`。

实现依据：[Chrome Bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)、[按需申请可选权限](https://developer.chrome.com/docs/extensions/reference/api/permissions)。
