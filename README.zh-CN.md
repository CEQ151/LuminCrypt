# LuminCrypt

**[English](README.md) | 简体中文**

LuminCrypt 是一款本地优先的桌面安全工具箱，面向 **Unicode 隐写检测**、**加密不可见文本水印** 与 **鲁棒图片盲水印** 场景。它可以帮助研究者、内容创作者、出版和安全团队检测隐藏 Unicode 字符、嵌入文本指纹，并测试图片水印在压缩、缩放、裁剪和网络传输降质后的可恢复能力。

![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)

## 为什么需要 LuminCrypt

文本和图片都可能携带不可见信号，例如零宽字符、Unicode Tags、同形字符替换、加密文本指纹和图片盲水印。LuminCrypt 将这些能力集中到一个桌面应用里，并尽量保留本地处理和可复现验证。

它可以用于：

- 检测粘贴文本和文档中的隐藏或可疑 Unicode 字符。
- 展示零宽字符、BiDi 控制符、Unicode Tags、变体选择器、同形字符和特殊空格。
- 向普通文本中嵌入或提取加密不可见水印。
- 通过 Python 图片处理引擎嵌入和恢复图片盲水印。
- 评估实验中的学习型鲁棒图片水印链路。
- 导出检测报告，方便审阅、审计和复现。

## 核心功能

- **Unicode 隐藏字符检测**：识别零宽字符、BiDi 控制符、同形字符攻击、Unicode Tags、变体选择器、特殊空格和常见 AI 水印相关字符范围。
- **加密文本水印**：使用 AES-256-GCM 保护载荷，并通过不可见 Unicode 字符写入普通文本，支持分片恢复。
- **鲁棒图片盲水印**：内置 legacy 图片盲水印引擎，使用 Block-DCT、QIM 风格嵌入、Reed-Solomon 恢复、同步模板和多尺度提取。
- **学习型水印研究分支**：`codex/mlwm-v1` 正在加入实验性的神经网络鲁棒图片水印链路，包含 PyTorch 训练、ONNX 导出、攻击模拟、基准评测和自动回退。
- **批量处理和报告导出**：支持批量扫描，并可导出 JSON、CSV 和 PDF 报告。
- **本地桌面应用**：使用 Electron、React、TypeScript 构建，图片水印能力由 Python helper 提供。

## 项目状态

| 模块 | 状态 |
|---|---|
| 文本 Unicode 检测 | 可用 |
| 文本水印嵌入和提取 | 可用 |
| Legacy 图片盲水印 | 可用 |
| 学习型鲁棒图片水印 | 实验中，等待合适 GPU 时间继续训练 |
| `master` 分支保护 | 已启用 |

稳定主干是 `master`。MLWM v1 开发在 `codex/mlwm-v1` 分支进行，在完成模型训练、导出和基准评测前保持草稿集成状态。

## 快速开始

### 环境要求

| 工具 | 版本 | 说明 |
|---|---:|---|
| Node.js | 18+ | Electron 和前端构建 |
| npm | 9+ | 包管理 |
| Python | 运行时 3.10+，ML 推荐 3.12 | 图片水印后端需要 |

### 安装依赖

```bash
npm install
pip install -r blind_watermark/requirements.txt
```

ONNX 运行时打包依赖：

```bash
pip install -r blind_watermark/requirements-onnx.txt
```

机器学习训练依赖：

```bash
pip install -r blind_watermark/requirements-ml.txt
```

### 本地开发

```bash
npm run dev
```

### 类型检查

```bash
npm run typecheck
```

### Python 引擎测试

```bash
python -m unittest discover -s blind_watermark/tests
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

构建产物会输出到 `resources/bin/`，随后由 `electron-builder` 一起打包。

## 项目结构

```text
LuminCrypt/
|-- src/
|   |-- main/             # Electron 主进程、IPC、helper 桥接
|   |-- preload/          # 安全的渲染层桥接类型和 API
|   `-- renderer/         # React UI 和 TypeScript 水印逻辑
|-- blind_watermark/
|   |-- bwm_helper.py     # Electron 调用的 Python CLI 桥接
|   |-- rwm_engine.py     # 图片水印调度器和 legacy 引擎
|   |-- mlwm/             # 学习型鲁棒水印研究模块
|   `-- tests/            # Python 单元测试
|-- configs/mlwm/         # MLWM 训练、导出和评测配置
|-- docs/                 # 架构、训练、Wiki 和可追溯性文档
|-- resources/            # 打包二进制和模型元数据
`-- .github/workflows/    # CI 检查
```

## MLWM v1 研究方向

学习型鲁棒图片水印引擎面向短文本或 ID 载荷，目标是提高图片经过社交平台压缩、缩放、裁剪、模糊、噪声和叠加后的可识别能力。当前路线包括：

- 固定 payload 协议、CRC 和 Reed-Solomon 风格恢复；
- 使用经典同步模板进行几何对齐；
- 轻量 PyTorch 编码器和解码器；
- JPEG、WEBP、resize、crop、rotation、blur、noise、overlay、screenshot-sim 等在线攻击模拟；
- 导出 ONNX 用于本地推理。

相关文档：

- [MLWM 架构](docs/mlwm/architecture.md)
- [MLWM 训练](docs/mlwm/training.md)
- [MLWM 可追溯性](docs/mlwm/traceability.md)
- [MLWM Wiki Runbook](docs/wiki/MLWM-Training-Runbook.md)

## 关键词

Unicode 隐写、Unicode 水印、不可见水印、AI 水印检测、零宽字符检测、同形字符检测、BiDi 控制符检测、文本水印、图片盲水印、鲁棒图片水印、数字水印、图片取证、内容溯源、Electron 安全工具。

## 许可证

本项目采用 **GPL-3.0** 许可证，详见 [LICENSE](LICENSE)。

图片水印引擎基于开源项目 [blind_watermark](https://github.com/guofei9987/blind_watermark) 深度定制，相关版权声明见 [NOTICE](NOTICE)。
