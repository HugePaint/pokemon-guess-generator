# Repository Licensing Implementation Plan
> 请注意本文档由LLM AI生成
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** 为仓库添加边界明确的代码、文档和第三方内容分许可声明。
**Architecture:** 根目录的 `LICENSE`、`LICENSE-CONTENT` 与 `NOTICE` 分别负责原创源码、原创文档和第三方权利内容。`README.md` 提供面向访问者的入口，`package.json` 仅声明软件源码采用 MIT。
**Tech Stack:** Markdown、JSON、Git
## Global Constraints
- MIT 版权人为 `HugePaint`，年份为 `2026`。
- CC BY-NC-SA 使用 4.0 版本，且只覆盖 HugePaint 拥有权利的原创文档。
- Pokémon、PokéAPI 派生数据、PokeAPI sprites 和题面模板不纳入 MIT 或 CC 授权。
- 保留现有非官方、非商业及无隶属关系声明。
---
### Task 1: 添加根目录分许可文件
**Files:**
- Create: `LICENSE`
- Create: `LICENSE-CONTENT`
- Create: `NOTICE`
**Interfaces:**
- Consumes: `README.md` 中现有素材来源及权利说明。
- Produces: 供仓库元数据和读者引用的三个根目录声明文件。
- [ ] **Step 1: 添加 MIT 源码许可证**
创建 `LICENSE`，写入 MIT 标准文本，版权行使用 `Copyright (c) 2026 HugePaint`。
- [ ] **Step 2: 添加原创文档许可证**
创建 `LICENSE-CONTENT`，明确许可对象是 HugePaint 拥有权利的原创文档，许可为 Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International，并链接 `https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode`。
- [ ] **Step 3: 添加第三方权利声明**
创建 `NOTICE`，分别说明项目非官方、Pokémon 相关权利不获许可、图鉴数据来自 PokéAPI、图片地址指向 PokeAPI sprites，以及题面模板不受仓库许可证覆盖。
- [ ] **Step 4: 检查声明边界**
Run: `rg -n "MIT License|CC BY-NC-SA 4.0|PokéAPI|PokeAPI sprites|template" LICENSE LICENSE-CONTENT NOTICE`
Expected: 三个文件均出现对应许可或排除声明，不存在将第三方内容归入 HugePaint 许可的表述。
### Task 2: 暴露许可证入口并验证
**Files:**
- Modify: `README.md`
- Modify: `package.json`
**Interfaces:**
- Consumes: Task 1 创建的 `LICENSE`、`LICENSE-CONTENT` 与 `NOTICE`。
- Produces: GitHub 页面可见的许可说明和 npm 兼容的软件许可元数据。
- [ ] **Step 1: 更新软件包元数据**
在 `package.json` 的 `version` 后添加 `"license": "MIT"`，保持 JSON 有效。
- [ ] **Step 2: 更新 README**
在“素材与权利说明”前添加“许可证”章节，链接三个根目录文件，并用自然语言说明源码、原创文档与第三方内容的边界。
- [ ] **Step 3: 验证格式和项目检查**
Run: `npm run check`
Expected: 单元测试、数据审计和构建全部通过。
- [ ] **Step 4: 检查差异**
Run: `git diff --check`
Expected: 无输出，退出码为 0。
- [ ] **Step 5: 提交并推送**
Run: `git add LICENSE LICENSE-CONTENT NOTICE README.md package.json docs/superpowers/plans/2026-07-17-repository-licensing.md; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; git commit -m "docs: add repository licensing"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; git push origin main`
Expected: 提交成功，`origin/main` 更新到新提交。
