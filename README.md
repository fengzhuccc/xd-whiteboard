# XD Whiteboard

A free, open-source desktop application for managing and editing local Excalidraw files. Built with Tauri for a native desktop experience.

English | [中文](README-zh.md)

## Features

- 📁 **Local File Management** - Browse and organize local Excalidraw files
- 🎨 **Full Editor** - Built-in Excalidraw drawing capabilities
- 🔄 **Drag & Drop** - Move files and folders by dragging
- 🌐 **Multi-language** - Support for Chinese and English interface
- ⌨️ **Keyboard Shortcuts** - Full keyboard shortcut support

## Installation

### Download

Go to the [Releases] page to download the installer.

### Build from Source

**Build Steps:**

```bash
git clone https://gitcode.com/fengfeiccc/xd-whiteboard.git
cd xd-whiteboard
npm install
npm run tauri dev    # Development mode
npm run tauri build  # Build for production
```

## Usage

### Quick Start

1. Launch the app and select a directory
2. Click a file in the sidebar to open and edit
3. Changes are saved automatically

### File Operations

- **Create** - Menu "File → New File" or shortcut
- **Rename** - Right-click file and select "Rename"
- **Delete** - Right-click file and select "Delete", or multi-select for batch deletion
- **Move** - Drag file to target folder

## Tech Stack

- [Tauri 2.x](https://tauri.app/) - Desktop framework
- [React 19](https://react.dev/) - Frontend framework
- [Excalidraw](https://excalidraw.com/) - Drawing engine
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) - UI

## Project Structure

```
xd-whiteboard/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities
│   ├── store/              # State management
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Core logic
│   │   ├── menu.rs         # Native menu
│   │   └── security.rs     # Security validation
│   └── tauri.conf.json     # Tauri config
└── public/                 # Static assets
```

## Development

```bash
npm run tauri dev      # Development mode
npm run test           # Run tests
npx tsc --noEmit       # Type checking
npm run tauri build    # Build for release
```

## License

[MIT License](LICENSE)

## Acknowledgments

- [Excalidraw](https://excalidraw.com/) - Drawing tool
- [Tauri](https://tauri.app/) - Desktop framework
