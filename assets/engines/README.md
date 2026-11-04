# 栖页统一搜索图标

29 个本地 SVG：18 个搜索引擎入口、6 个通用分类图形，以及邮件、笔记、设计、文档、部署 5 个快捷方式图形。引擎选择器提供前 24 种，快捷方式选择器提供全部 29 种。统一采用薄荷色圆角底板、深绿色图形与 32×32 画板。内联渲染使用同源的 `engine-icons.js`，不 fetch SVG 文件、不使用外部字体或图标 CDN，可通过本地文件模式运行。

Google、百度、GitHub、Bilibili、Google Translate、DuckDuckGo、Brave、YouTube、Stack Overflow、Google Scholar、搜狗的品牌路径来自 [Simple Icons](https://github.com/simple-icons/simple-icons)，检索于 2026-10-28，并统一颜色、尺寸和底板。其 CC0 文本保存在 `LICENSE-simple-icons.txt`，品牌商标仍归各自权利人。

Bing 为本项目绘制的折带示意图；Yahoo 使用星形导航示意；知乎、豆瓣、淘宝、维基百科、npm 分别使用对话、豆荚、购物袋、拼接地球、软件包等自行绘制的语义图形。这些为主页导航图标，不声称是对应品牌的官方标志。6 个通用图形同样为本项目绘制。

- `*.svg`：单枚独立图标。
- `../../previews/engine-icons.svg`：矢量总览。
- `../../previews/engine-icons.png`：已渲染并检查的总览。
- `../../previews/dock-icons.png`：默认 Dock 图标风格预览。

在“管理搜索引擎 → 编辑”中可自由选用，亦保留自定义 Emoji / 文字模式。图标配置只保存白名单标识，不接受任意 URL、HTML 或 SVG 源码。

快捷方式默认可使用这些本地图形，也可主动获取网站 favicon 并调整灰度；图标加载失败时回退本地图形。自定义上传图片通过单色 alpha 蒙版统一颜色与图形比例，原色缩略图用于保留和备份。新增的邮件、笔记、设计、文档、部署图形为本项目绘制。
