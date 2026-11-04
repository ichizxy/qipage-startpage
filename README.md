# 栖页

本地优先的浏览器起始页。原生 HTML、CSS 和 JavaScript，无后端、无运行时依赖，支持直接打开本地文件。

## 使用

1. 下载或克隆本项目，保留目录结构。
2. 用 Chrome、Edge 等现代浏览器打开 `index.html`。
3. 点击右上角展开完整主页；右键可管理网址、搜索引擎和外观。

日常使用无需 Node.js、安装依赖或启动服务器。要替换新标签页、连接浏览器主页按钮或读取浏览器书签，按 [Chrome 扩展安装说明](chrome-extension/README.md) 操作。扩展首次使用需填写自己的主页地址。

## 功能

- 18 个搜索引擎、快捷指令和网址直达；支持自定义引擎。
- Dock 网址导航、嵌套文件夹、拖动排序和浏览器书签导入。
- 时钟、待办、便签、专注计时、可选天气、RSS 与 GitHub 项目发现。
- 极简与完整布局、明暗主题、本地图片 / 视频壁纸和主题取色。
- JSON 备份、校验与恢复；删除操作提供确认和撤回。

`/` 聚焦搜索，`Alt+Z` 切换布局，`Esc` 关闭当前交互。完整操作见 [使用手册](docs/user-guide.md)。

## 数据与网络

设置、网址和便签保存在 localStorage，壁纸保存在 IndexedDB。没有账号或云同步；更换浏览器、移动本地文件或清理浏览器数据前，请导出 JSON 备份。备份不加密。

天气默认关闭，主动开启后使用 Open-Meteo 并发送保留一位小数的近似坐标。在线搜索、主动获取网站图标、GitHub 和 RSS 分别向对应服务联网。RSS 源必须支持 CORS；离线仍可使用本地导航和工具。详见 [数据与网络](docs/user-guide.md#数据与网络)。

## 开发与打包

从源码仓库开发时使用 Node.js 24；其他兼容版本见 `package.json`。

```sh
npm ci
npm run verify
```

`verify` 依次运行语法检查、全部行为测试和发布打包。也可分别使用 `npm run check`、`npm test`、`npm run test:core`、`npm run build`。构建只复制运行文件和文档，不改变源码；产物在 `dist/qipage-startpage/`，可直接打开或部署到静态托管服务。GitHub Actions 在推送和 PR 时执行验证，并生成可下载的发布包。

生产脚本按 `core.js → engine-icons.js → chrome-extension/bookmark-tree.js → app.js → layout.js` 顺序加载。文件职责、数据流和验证边界见 [代码结构](docs/architecture.md)。

图标来源和许可见 [素材说明](assets/engines/README.md)。
