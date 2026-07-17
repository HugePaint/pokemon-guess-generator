# 宝可梦“我是谁”图片生成器
纯前端的题面与答案 JPG 生成工具，需要 Node.js 24。

## 本地开发
```sh
npm ci
npm run dev
```

## 验证与构建
```sh
npm test
npm run test:e2e
npm run build
```
端到端测试使用 Playwright Chromium；首次运行前可通过 `npx playwright install chromium` 安装浏览器。

## 更新图鉴数据
图鉴快照只在维护者明确刷新时更新，部署流程不会运行 `data:sync`，也不会自动访问 PokéAPI。更新顺序如下：
```sh
npm run data:sync -- --refresh
```
检查 `public/data/audit-report.json` 中的同步结果和遗漏记录后，再运行：
```sh
npm run data:audit
```
确认审计通过后，同时提交 `public/data/pokemon.json` 和 `public/data/audit-report.json`。

## 部署
在 GitHub 仓库的 **Settings → Pages** 中将 Source 设为 **GitHub Actions**。对拉取请求和 `main` 分支的推送，`.github/workflows/ci-pages.yml` 会安装依赖、执行完整检查与浏览器测试；只有验证通过的 `main` 推送会上传 `dist` 并部署到 GitHub Pages。

## 许可证
HugePaint 拥有权利的原创源码采用 [MIT License](LICENSE)，原创文档采用 [CC BY-NC-SA 4.0](docs/content-license.md)。Pokémon 相关名称、形象和标志、PokéAPI 派生数据、PokeAPI sprites 内容及题面模板不受上述许可证覆盖，具体边界与来源见 [NOTICE](NOTICE)。

## 素材与权利说明
图鉴数据来自 [PokéAPI](https://pokeapi.co/)；图片地址固定到 [PokeAPI/sprites](https://github.com/PokeAPI/sprites/tree/bf4c47ac82c33b330e33d98b8882d1cedb2f53e7) 提交 `bf4c47ac82c33b330e33d98b8882d1cedb2f53e7`。题面模板由项目使用者提供。

本项目是非官方、非商业项目，与 Nintendo、Game Freak、Creatures 或 The Pokémon Company 不存在隶属或认可关系。相关名称、形象和标志属于各自权利方；本项目及本声明不授予任何 Pokémon 相关知识产权的使用权。

## 替换模板
替换 `src/assets/who-am-i-template.png` 后，只在 `src/features/rendering/template.ts` 调整内容区域和答案区域坐标，并重新运行全部测试。其他渲染文件不应因模板坐标变化而修改。
