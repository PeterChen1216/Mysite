# STATUS（会话交接 · PLAN §15.6）

> 更新：2026-11-09 · 分支 `claude/affectionate-dirac-6zpbqu`

## 当前里程碑：M0 · 项目骨架与内容迁移 — ✅ 完成，待业主验收

### 已完成
- Astro 7 + TypeScript 6 项目骨架（ADR-009）；pnpm 10；Node 22。
- `content/` 全部文件 + Zod schema（`src/content/schema.ts`，所有对象 `.strict()`，可核验事实要求 `source:`）。
- 旧 `index.html` 内容 100% 迁入（E2E `tests/e2e/migration.spec.ts` 逐条核对旧页面事实与链接）；简历中的经历要点、辅修、课程、Classmate Map 项目按原文迁入（ADR-011）。
- `src/styles/tokens.css`：由 Figma `Voxel/Night` 变量 + `Pixel/* Term/* Code/*` 文字样式生成（19 色 + 13 文字样式；letter-spacing 百分比已换算为 em，并用节点宽度反推验证）。
- 四款 OFL 字体经 @fontsource 自托管（仅 latin 子集）。
- M0 纯语义长页面（零 JS）：Hero / About / Education / Honors / Projects / Experience / AvGeek（仅工具栏，其余数据为空自动隐藏）/ Contact / Footer（"最近更新"与版本号自动来自 git）。
- `/resume.pdf` ← `content/resume/Resume.pdf`。
- 旧站移至 `legacy/`（仅删除已注释掉的 GA/GTM 块，PLAN §2.4）。
- CI（`.github/workflows/ci.yml`）：Prettier · ESLint · astro check · 内容占位拦截（main 严格）· Vitest（覆盖率 ≥ 80 %）· 严格构建（任何 warning 即失败）· size-limit · Playwright E2E（Chromium / 移动 Chromium / WebKit）+ axe · Lighthouse CI（移动端四项 ≥ 95）。
- 部署（`.github/workflows/deploy.yml`）：main → GitHub Pages，分阶段上线（ADR-010）。

### M0 验收（PLAN §8）
| 验收项 | 结果 |
|---|---|
| `pnpm build` 零警告 | ✅ `scripts/build-strict.mjs` 把任何 WARN/ERROR 行当失败 |
| schema 覆盖全部字段 | ✅ 全部 `.strict()`；单测验证真实 content 通过、常见错误被拒 |
| 部署到预览 URL | ⏳ 合并后为 `https://zhic.me/v2/`（自定义域名下 `*.github.io` 会跳转，见 ADR-010）；需先完成下方"业主操作 1" |
| Lighthouse 移动端 ≥ 95 | ✅ 本地 3 次：Perf 100 / A11y 100 / BP 100 / SEO 100，LCP ≈ 0.76 s |

## 阻塞 / 需要业主操作
1. **合并 M0 PR 之前**：仓库 Settings → Pages → Build and deployment → Source 改为 **GitHub Actions**。否则 main 根目录已没有 `index.html`，旧的"从分支部署"会让 zhic.me 显示 README。改完后合并，`Deploy` 工作流会发布：zhic.me（旧站不变）+ zhic.me/v2/（新站预览）+ zhic.me/legacy/。
2. Custom domain 在 Settings → Pages 中保持 `zhic.me`（Actions 部署不读仓库里的 CNAME 文件；产物里仍会写入一份）。

## 待业主确认的内容（未改动事实，均按原文迁移）
1. **项目名**：旧站项目区与简历写 "Time Stamp"，兴趣列表写 "Clock Stamp"，计划文档写 Clock Stamp。目前用 **Time Stamp**（`content/projects/time-stamp.md`）。哪个是正式名？App Store 链接？
2. **"I am a Junior"**（`content/about.md`）：2026-11 应已是大四（Senior）？
3. **兴趣第 3 条** "about to release … in around April/May" 已过期，请更新。
4. **拼写/语法**（按原文保留，等你改）：about 中 "Tech fans"、"colaboration"；footer "Expected to updated by each 2 weeks."；site 描述 "This is an personal/academic website"。
5. **经历要点**：HashKey 有 5 条（简历原文），M1 设计建议 1–3 条，请挑选/改写。
6. **项目一句话简介（tagline）**是我根据简历要点转述的（简历没有一句话简介）：Time Stamp、Classmate Map 两条，请确认或改写；Classmate Map 的状态我标为 `shipped`（有在线链接），对吗？
7. **邮箱**：按 Q6 只公开 `zchen75@uw.edu`；163 邮箱在 `profile.yaml` 中 `public: false`。About 段落原来的 "email" 链接指向 163，已改为 uw.edu。
8. 简历中**未上站**：电话、North Helpline Food Bank 志愿经历、技能/语言。要不要加？
9. 仓库里的简历是 2026-03-31 版；DECISIONS 提到"简历已更新"——新版请放进 `content/artifacts/`，我会迁入。
10. `legacy/work/njzposts.pdf` 没有被任何页面链接，但目前可通过 zhic.me/work/njzposts.pdf 公开访问（内容含社交账号信息）。是否删除？

## 与计划的偏离（均已记入 PLAN §13）
- Astro 7 / TS 6 而非 Astro 5（ADR-009）。
- 预览方式：zhic.me/v2/ 而非 `*.github.io`（ADR-010）。
- 分支名：会话指定 `claude/affectionate-dirac-6zpbqu`，未用 `feat/m0-*`。
- WebKit E2E 仅在 CI 运行（本地容器无 WebKit）；Lighthouse 在"上线配置"（base `/`）下测量，因为预览路径被 robots 屏蔽。
- favicon：自绘 16×16 体素草方块 SVG（`public/favicon.svg`，仅用 tokens 颜色，无 Mojang 素材）。
- 间距/阴影令牌 Figma 中尚无变量，`tokens.css` 中标注为 provisional，M1 同步。

## 下一步（三条）
1. 业主：完成"业主操作 1"，回答上面 1–10，合并 M0。
2. M1：按 Figma `Home — Voxel / 1440` 实现长页面全部区块与 UI 组件（MCButton/Tooltip/TerminalWindow/PixelBlock）、2.5D 像素地球、hover 粒子、打字机、响应式四档、视觉回归基线。
3. M1 验收后把 `content/site.yaml` 的 `launched` 改为 `true` 即正式替换旧站（DECISIONS Q1）。

## 移动端 WebGL 重启触发器（DECISIONS §16）
未触发（场景版尚未上线）。
