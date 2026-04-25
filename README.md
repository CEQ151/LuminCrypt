# LuminCrypt

LuminCrypt 是一个基于 Electron + React + TypeScript 的桌面安全工具，用于检测文本中的可疑 Unicode 字符，并提供文本/图片隐写水印能力。

## 功能

- Unicode 隐形字符与混淆字符检测（零宽字符、BiDi 控制符、同形字、Tags 区块等）
- 文本水印嵌入与提取（AES-256-GCM 加密，支持鲁棒冗余模式）
- 图片盲水印嵌入与提取（Block-DCT + QIM + Reed-Solomon，多尺度抗压缩）
- 批量处理与结果导出（JSON / CSV / PDF）

## 技术栈

- **前端**：Electron · React · TypeScript · Vite (electron-vite)
- **后端**：Python（图片水印引擎 `rwm_engine.py`）
- **样式**：Tailwind CSS · Framer Motion

## 环境要求

| 工具 | 最低版本 |
|------|----------|
| Node.js | 18 |
| npm | 9 |
| Python | 3.8（仅图片水印功能需要） |

## 本地开发

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

## 打包构建

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

> 需要先安装 PyInstaller：`pip install pyinstaller`  
> 产物输出至 `resources/bin/bwm_helper.exe`，electron-builder 打包时会自动包含。

## Windows 一键脚本

项目根目录提供了几个方便 Windows 开发者使用的批处理脚本：

- `start.bat`: 一键启动器，提供交互式菜单，可选择启动开发模式（热重载）或预览已构建的版本。
- `pack.bat`: 一键打包脚本，自动检查环境、安装依赖、构建 Python 引擎，并最终调用 electron-builder 生成 Windows 安装包和便携版。
- `build.bat`: 兼容性构建脚本，若存在 `pack.bat` 则会直接转调 `pack.bat`。

## 项目结构

```
src/
  main/       # Electron 主进程
  preload/    # Preload 脚本
  renderer/   # React 前端
    core/     # 水印引擎（TypeScript）
    components/
blind_watermark/
  rwm_engine.py   # 图片盲水印 Python 引擎
  bwm_helper.py   # Electron IPC 桥接脚本
```

## 许可证

本项目采用 **GPL-3.0** 许可证，详见 [LICENSE](LICENSE)。