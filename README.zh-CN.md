<div align="center">
  <h1>LuminCrypt</h1>
  <p><strong>本地优先的 Unicode 隐写检测与鲁棒水印工具箱，支持文本和图片。</strong></p>

  <p>
    <a href="README.md">English</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg" alt="License" />
  </p>

  <img src="https://github.com/user-attachments/assets/ae9e81a0-a1d4-4271-a0a0-ab17c291bba9" width="220" alt="LuminCrypt logo" />
</div>

---

LuminCrypt 是一款桌面安全工具箱，面向 **Unicode 隐藏字符检测**、**加密不可见文本水印** 与 **鲁棒图片盲水印** 场景。它可以帮助研究者、内容创作者、出版和安全团队检查可疑 Unicode 内容、嵌入可恢复的文本指纹，并测试图片水印在压缩、缩放、裁剪和平台二次编码后的可恢复能力。

## 核心功能

- **Unicode 隐藏字符检测**：识别零宽字符、BiDi 控制符、同形字符、Unicode Tags、变体选择器和特殊空格。
- **加密文本水印**：使用 AES-256-GCM 保护载荷，并通过不可见 Unicode 字符写入普通文本，支持鲁棒冗余。
- **图片盲水印**：使用 Python 图片水印引擎，基于 Block-DCT、QIM 风格嵌入、Reed-Solomon 恢复和多尺度提取。
- **批量处理和报告导出**：支持批量扫描，并可导出 JSON、CSV 或 PDF 检测结果。
- **本地桌面流程**：使用 Electron、React、TypeScript 构建，图片水印能力由 Python helper 提供。

## 截图

<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/f12aaab2-747b-4cd8-b796-4b774d5ce56a" width="100%" alt="LuminCrypt screenshot 1" /></td>
    <td><img src="https://github.com/user-attachments/assets/93dcb2ac-b11e-4c65-b47f-70a842f79372" width="100%" alt="LuminCrypt screenshot 2" /></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/770361e8-34f7-4f58-ba98-1d113b9c2a60" width="100%" alt="LuminCrypt screenshot 3" /></td>
    <td><img src="https://github.com/user-attachments/assets/b677c03c-fa24-4d0e-97e6-1e174adc5010" width="100%" alt="LuminCrypt screenshot 4" /></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/8dce171c-c251-49b9-8799-69c80cbb756f" width="100%" alt="LuminCrypt screenshot 5" /></td>
    <td><img src="https://github.com/user-attachments/assets/d9107174-6f9a-417b-a584-bbf89c7cc11f" width="100%" alt="LuminCrypt screenshot 6" /></td>
  </tr>
</table>

## 环境要求

| 工具 | 版本 | 说明 |
|---|---:|---|
| Node.js | 18+ | Electron 和前端构建 |
| npm | 9+ | 包管理 |
| Python | 推荐 3.10+ | 图片水印后端需要 |

## 快速开始

安装 Node 依赖：

```bash
npm install
```

安装 Python 图片水印依赖：

```bash
pip install -r blind_watermark/requirements.txt
```

启动开发应用：

```bash
npm run dev
```

运行 TypeScript 检查：

```bash
npm run typecheck
```

## 构建打包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

构建 Python 图片水印 helper：

```bash
npm run build:python
```

构建产物会输出到 `resources/bin/bwm_helper.exe`，随后由 `electron-builder` 一起打包。

## Windows 一键脚本

- `start.bat`：交互式启动器，支持开发和预览流程。
- `pack.bat`：Windows 一键打包脚本，会检查环境、安装依赖、构建 Python helper 并调用 `electron-builder`。
- `build.bat`：兼容性脚本，存在 `pack.bat` 时会转交给它执行。

## 项目结构

```text
LuminCrypt/
|-- src/
|   |-- main/           # Electron 主进程、安全策略、IPC
|   |-- preload/        # 上下文隔离 preload 桥接
|   `-- renderer/       # React UI 和 TypeScript 逻辑
|       |-- core/       # 文本水印和 Unicode 检测
|       `-- components/ # React 组件
|-- blind_watermark/
|   |-- rwm_engine.py   # 图片盲水印引擎
|   `-- bwm_helper.py   # Electron 调用的 CLI 桥接
`-- resources/          # 静态资源和打包二进制
```

## 关键词

Unicode 隐写、Unicode 水印、不可见水印、AI 水印检测、零宽字符检测、同形字符检测、BiDi 控制符检测、文本水印、图片盲水印、鲁棒图片水印、数字水印、图片取证、内容溯源、Electron 安全工具。

## 许可证

本项目采用 **GPL-3.0** 许可证，详见 [LICENSE](LICENSE)。

图片水印引擎基于开源项目 [blind_watermark](https://github.com/guofei9987/blind_watermark) 定制，相关版权声明见 [NOTICE](NOTICE)。
