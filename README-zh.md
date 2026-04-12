# 小呆画板 (XD Sketchpad)

一款免费开源的桌面应用程序，用于管理和编辑本地 Excalidraw 文件。基于 Tauri 构建，提供原生桌面体验。

[English](README.md) | 中文

## 功能特性

- 📁 **本地文件管理** - 浏览、组织本地 Excalidraw 文件
- 🎨 **完整编辑器** - 内置 Excalidraw 绘图功能
- 🔄 **拖拽移动** - 拖拽文件/文件夹进行移动
- 🌐 **多语言** - 支持中文和英文界面
- ⌨️ **快捷键** - 完整的键盘快捷键支持

## 安装

### 下载

前往 [Releases] 页面下载安装包。

### 从源码构建

**构建步骤：**

```bash
git clone https://github.com/yourusername/xd-sketchpad.git
cd xd-sketchpad
npm install
npm run tauri dev    # 开发模式
npm run tauri build  # 构建生产版本
```

## 使用

### 快速开始

1. 启动应用，选择一个目录
2. 点击侧边栏中的文件打开编辑
3. 编辑内容自动保存

### 文件操作

- **新建** - 菜单「文件 → 新建文件」或快捷键
- **重命名** - 右键文件选择「重命名」
- **删除** - 右键文件选择「删除」，或选中多个文件后批量删除
- **移动** - 拖拽文件到目标文件夹

## 技术栈

- [Tauri 2.x](https://tauri.app/) - 桌面框架
- [React 19](https://react.dev/) - 前端框架
- [Excalidraw](https://excalidraw.com/) - 绘图引擎
- [Zustand](https://zustand-demo.pmnd.rs/) - 状态管理
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) - UI

## 项目结构

```
xd-sketchpad/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具函数
│   ├── store/              # 状态管理
│   └── types/              # TypeScript 类型
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs          # 核心逻辑
│   │   ├── menu.rs         # 原生菜单
│   │   └── security.rs     # 安全验证
│   └── tauri.conf.json     # Tauri 配置
└── public/                 # 静态资源
```

## 开发

```bash
npm run tauri dev      # 开发模式
npm run test           # 运行测试
npx tsc --noEmit       # 类型检查
npm run tauri build    # 构建发布
```

## 许可证

[MIT License](LICENSE)

## 致谢

- [Excalidraw](https://excalidraw.com/) - 绘图工具
- [Tauri](https://tauri.app/) - 桌面框架
