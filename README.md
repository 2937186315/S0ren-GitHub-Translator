# GitHub 中文翻译 · by S0ren

> 让 GitHub 不只“看得懂”，还真正“读得透”。

[![Version](https://img.shields.io/badge/version-2.3.2-0969da?style=flat-square)](./S0ren_GitHub_Translator.user.js)
[![UserScript](https://img.shields.io/badge/UserScript-Tampermonkey-111?style=flat-square)](https://www.tampermonkey.net/)
[![License](https://img.shields.io/badge/license-GPL--3.0-2ea44f?style=flat-square)](./LICENSE)

`GitHub 中文翻译` 是 S0ren 打造的一体化 GitHub 中文体验脚本：用本地词典即时汉化 GitHub 界面，再用你自己的 AI 接口翻译 README、Wiki 与 Markdown 文档。没有笨重的浏览器翻译条，只有一个可拖动、随时收起的 Apple 风格“译”按钮。

## 一键安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)（Chrome、Edge、Firefox 等 Chromium/Firefox 浏览器均可）。
2. 点击 **[安装 GitHub 中文翻译](https://raw.githubusercontent.com/2937186315/S0ren-GitHub-Translator/main/S0ren_GitHub_Translator.user.js)**。
3. 在 Tampermonkey 页面选择“安装”，刷新 GitHub。

脚本内置 `@updateURL`，后续版本可由 Tampermonkey 自动检查更新。

## 它解决什么

GitHub 的界面翻译和技术文档翻译，本来是两件不同的事：前者要求快、稳定、零成本，后者要求理解上下文并保护代码。这个脚本把两条链路做在了一起。

- **界面秒级中文化**：仓库、Issue、Pull Request、Actions、Settings、Profile、Organization、Projects、Packages 等页面使用本地词典处理，不调用 AI。
- **Markdown 智能翻译**：面向 README、Wiki 和 Markdown 文件，支持自定义 OpenAI 兼容接口与 DeepSeek。
- **原文结构不乱**：自动跳过 `code`、`pre`、`kbd`、公式、输入框和编辑器；保护 URL、路径、提交哈希、命令参数及自定义术语。
- **可控的阅读体验**：悬浮按钮和标题栏均可拖动；支持翻译、停止、显示中文/原文、自动翻译与多文档目标切换。
- **为长文档优化**：文本切分、批处理、1–6 路并发、失败重试、路由切换取消，以及最多 2,000 条本地翻译缓存。
- **适配 GitHub 单页导航**：页面无刷新跳转后自动重新识别内容，减少重复扫描与重复请求。

## 两种翻译，成本边界很清楚

| 能力 | 执行方式 | 是否需要 API |
|---|---|---|
| GitHub 界面中文化 | 浏览器本地词典与正则规则 | 否 |
| README / Wiki / Markdown 翻译 | 你配置的 OpenAI 兼容接口或 DeepSeek | 是 |

## Markdown 翻译配置

打开任意仓库 README，点击右下角的“译”，再进入“翻译设置”。

### 自定义 OpenAI 兼容接口

- API 地址默认：`http://127.0.0.1:8000/v1/chat/completions`
- 模型：填写所选接口提供的模型名
- API Key：本机服务不要求鉴权时可留空
- 支持本机服务和远程服务商（例如 Agnes）的 Chat Completions 兼容接口；远程服务请填写服务商提供的地址和 API Key

缓存按 API 地址区分。升级到此版本后，旧缓存不会命中新缓存键，首次翻译可能重新产生 API 请求。

### DeepSeek

- API 地址默认：`https://api.deepseek.com/chat/completions`
- 填写 DeepSeek API Key
- 可按接口实际支持情况修改模型名和并发数

设置面板支持“测试连接”“清理缓存”和“恢复默认”。还可以逐行填写不翻译词表，保护项目名、库名和专有术语。

## 设计细节

这不是把整页文本粗暴丢给模型。

1. 先识别 GitHub 当前页面类型与 Markdown 容器。
2. 跳过代码、公式、编辑器和明确标记为不翻译的节点。
3. 对 URL、路径、哈希、CLI 参数和术语建立占位保护。
4. 分段、批量请求并校验结构化 JSON 返回。
5. 只有校验完整的译文才写回页面；失败片段保留原文。
6. 译文按页面、模型和配置生成缓存键，避免重复消耗。

## 隐私与权限

- 界面中文化完全在浏览器本地完成。
- 只有启用 Markdown 智能翻译时，文档中的自然语言片段才会发送到你选择的接口。
- API Key 与设置保存在用户脚本管理器的本地存储中，不写入本仓库。
- `GM_xmlhttpRequest` 和 `@connect` 用于访问用户自行配置的本机或远程 OpenAI 兼容接口。安装前请自行审阅脚本权限。

## 支持范围

- `github.com`
- `gist.github.com`
- `skills.github.com`
- `education.github.com`
- `www.githubstatus.com`

GitHub 页面持续更新，个别新文案可能暂时保留英文。发现遗漏或兼容问题，欢迎提交 [Issue](https://github.com/2937186315/S0ren-GitHub-Translator/issues)。

## 项目结构

```text
.
├── S0ren_GitHub_Translator.user.js  # 可直接安装的完整油猴脚本
├── README.md                         # 项目说明
└── LICENSE                           # GPL-3.0
```

## 致谢与许可

本项目基于 [maboloshi/github-chinese](https://github.com/maboloshi/github-chinese) 的 GPL-3.0 成果继续维护与优化，源文件内保留原贡献者署名。

项目采用 [GPL-3.0](./LICENSE) 许可。二次分发或修改时请遵守同一许可证要求，并保留必要的版权与归属说明。

---

**S0ren**：把高频工具打磨到顺手，比堆砌功能更重要。
