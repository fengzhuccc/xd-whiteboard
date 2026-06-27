# 小呆画板 UI 重设计方案 — 精致简约风格

## 设计说明

基于 xd-whiteboard 现有功能的 UI 重设计方案，采用精致简约 (Warm Minimalist) 风格。

### 风格特征

- 暖色纸张质感底色 (#FAF8F5)，Excalidraw 手绘美学灵感
- 主色：琥珀赭石 (#C87941)，温暖且不刺眼
- 显示字体：Caveat（手写体），正文字体：Inter
- 圆角 6-16px，微妙阴影，有机质感
- 侧边栏像笔记本页面，整体呼吸感强

### 页面列表

| 页面 | 文件 | 说明 |
|------|------|------|
| 主界面 - 编辑模式 | pages/main-editor.html | 侧边栏文件树 + 画布 + 菜单栏（文件下拉展开） |
| 主界面 - 空状态 | pages/empty-state.html | 欢迎页 + 选择工作空间引导 |
| 右键菜单与对话框 | pages/context-menu.html | 右键菜单、重命名、未保存更改确认 |
| 命令面板与菜单系统 | pages/menu-system.html | Ctrl+K 搜索面板 + 现代化下拉菜单 |
| 偏好设置与关于 | pages/settings-about.html | 通用/编辑器/快捷键设置 + 关于对话框 |

### 预览方式

直接用浏览器打开 pages/ 下的 HTML 文件即可预览。需要网络连接以加载 Tailwind CDN 和 Google Fonts。

### 应用到代码

将 colors_and_type.css 中的 CSS 变量替换到项目 src/index.css 的对应变量即可迁移配色方案。组件样式参考各 HTML 页面的实现。
