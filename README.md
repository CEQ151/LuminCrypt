<div align="center">
  <h1>LuminCrypt</h1>
  <p><strong>桌面级 Unicode 隐写检测与鲁棒水印（文本/图片）工具箱</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Electron-39.0-47848F?logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Python-3.10-3776AB?logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg" alt="License" />
  </p>
</div>

---

LuminCrypt 是一个基于 Electron + React + TypeScript 构建的现代桌面安全工具，致力于解决文本中的可疑 Unicode 字符检测问题，并提供强大的文本与图片隐写水印能力。

## 🌟 核心功能

- **异常字符检测**：精准识别并高亮文本中的零宽字符、BiDi 控制符、同形字、Tags 区块等隐形或易混淆的 Unicode 字符。
- **文本水印 (隐写)**：基于 AES-256-GCM 加密，利用不可见字符将水印信息隐写至普通文本中，支持高容错的鲁棒冗余模式（即使载体丢失 10~30% 仍可恢复）。
- **图片盲水印**：内置强大的 Python 盲水印引擎（Block-DCT + QIM + Reed-Solomon），支持多尺度嵌入，强力抵抗缩放、裁剪、平台二次压缩等破坏。
- **批量处理与导出**：支持批量扫描文件，并将检测报告一键导出为 JSON、CSV 或 PDF 格式。

## 🛠️ 环境要求

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| **Node.js** | 18+ | 运行 Electron 和前端构建 |
| **npm** | 9+ | 包管理工具 |
| **Python** | 3.8+ | 仅图片盲水印引擎需要 |

## 🚀 本地开发

### 1. 安装 Node 依赖

```bash
npm install
```

### 2. 安装 Python 依赖（仅图片水印功能需要）

```bash
pip install numpy opencv-python scipy reedsolo
```

### 3. 启动开发模式

```bash
npm run dev
```

### 4. 类型检查

```bash
npm run typecheck
```

## 📦 打包构建

### 构建 Electron 应用

```bash
# Windows（输出安装包 + 便携版）
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### 可选：将 Python 引擎打包为独立 exe（无需用户安装 Python）

```bash
npm run build:python
```

> 提示：需要先安装 PyInstaller (`pip install pyinstaller`)。  
> 产物将输出至 `resources/bin/bwm_helper.exe`，后续执行 `electron-builder` 打包时会自动将其包含在内。

## 🪟 Windows 一键脚本

项目根目录提供了几个方便 Windows 开发者使用的批处理脚本：

- `start.bat`: 一键启动器，提供交互式菜单，可选择启动开发模式（热重载）或预览已构建的版本。
- `pack.bat`: 一键打包脚本，自动检查环境、安装依赖、构建 Python 引擎，并最终调用 electron-builder 生成 Windows 安装包和便携版。
- `build.bat`: 兼容性构建脚本，若存在 `pack.bat` 则会直接转调 `pack.bat`。

## 📂 项目结构

```text
LuminCrypt/
├── src/
│   ├── main/           # Electron 主进程 (安全策略、IPC 通信)
│   ├── preload/        # 预加载脚本 (上下文隔离)
│   └── renderer/       # React 前端 UI
│       ├── core/       # 文本水印引擎与字符检测逻辑 (TypeScript)
│       └── components/ # React 组件
├── blind_watermark/
│   ├── rwm_engine.py   # 图片盲水印核心算法 (Python)
│   └── bwm_helper.py   # 与 Electron 通信的 CLI 桥接脚本
└── resources/          # 打包所需的静态资源与预编译二进制文件
```

## 📄 许可证

本项目采用 **GPL-3.0** 许可证，详见 [LICENSE](LICENSE) 文件。  
图片水印引擎基于开源项目 [blind_watermark](https://github.com/guofei9987/blind_watermark) 深度定制，相关版权声明详见 [NOTICE](NOTICE) 文件。