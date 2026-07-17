> 请注意本文档由LLM AI生成
# 仓库分许可设计
## 概述
该仓库同时包含 HugePaint 原创的 TypeScript/React 源码与文档，也包含来自 PokéAPI 的派生数据、指向 PokeAPI sprites 的图片地址，以及含 Pokémon 相关元素的题面模板。单一许可证无法准确表达这些内容的授权边界，因此需要将原创代码、原创内容和第三方权利内容分开声明，避免让使用者误以为项目有权再次许可 Pokémon 相关知识产权。
## 设计思路
仓库根目录的 `LICENSE` 使用未经修改的 MIT 标准文本，使 GitHub 能够识别源码许可证；`docs/content-license.md` 只许可 HugePaint 拥有权利的原创文档，采用 CC BY-NC-SA 4.0；`NOTICE` 说明 Pokémon 名称、角色、图像、标志、PokéAPI 派生数据、PokeAPI sprites 和题面模板不因前两个文件获得授权，其使用仍受各自权利人的条款约束。CC BY-NC-SA 4.0 不在 GitHub Licensee 的可识别范围内，因此文档许可放在 `docs/` 下，避免根目录出现 Unknown license。
`README.md` 提供许可证入口和简要边界，使访问仓库的读者能够理解适用范围。`package.json` 的 `license` 字段设为 `MIT`，仅描述软件包的原创源码许可，不覆盖数据、文档和素材。
## 实现和使用方式
实现时添加 `LICENSE`、`docs/content-license.md` 和 `NOTICE`，并更新 `README.md` 与 `package.json`。MIT 版权署名使用 `Copyright (c) 2026 HugePaint`；CC 文件标明许可对象仅为 HugePaint 原创文档，并链接到 CC BY-NC-SA 4.0 法律文本。
使用者复用源码时遵守 `LICENSE` 并保留版权与许可声明；复用原创文档时遵守 `docs/content-license.md` 的署名、非商业和相同方式共享要求。对于 `NOTICE` 列出的名称、数据、图片、标志和模板，使用者需要自行确认来源条款及权利人的授权，不能把 MIT 或 CC 声明视为 Pokémon 相关内容的使用许可。
