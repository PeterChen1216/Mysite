# STATUS（会话交接 · PLAN §15.6）

> 更新：2026-11-09 · 分支 `claude/affectionate-dirac-6zpbqu`

## 当前里程碑：M0 · 项目骨架与内容迁移 — ✅ 完成，待业主验收

### 已完成
- Astro 7 + TypeScript 6 项目骨架（ADR-009）；pnpm 10；Node 22。
- `content/` 全部文件 + Zod schema（`src/content/schema.ts`，所有对象 `.strict()`，可核验事实要求 `source:`）。
- 旧 `index.html` 内容 100% 迁入：一次性验收 `pnpm test:migration` 逐字核对旧页面全部事实与链接（含 Time Stamp 的 "Links will be update once publish in AppStore" 备注、页脚版权行）；简历中的经历要点、辅修、课程、Classmate Map 项目按原文迁入（ADR-011）。常规 E2E（`tests/e2e/content.spec.ts`）从 `content/` 读取期望值，你改文案不需要改测试（ADR-012）。
- `src/styles/tokens.css`：由 Figma `Voxel/Night` 变量 + `Pixel/* Term/* Code/*` 文字样式生成（19 色 + 13 文字样式；letter-spacing 百分比已换算为 em，并用节点宽度反推验证）。
- 四款 OFL 字体经 @fontsource 自托管（仅 latin 子集）。
- M0 纯语义长页面（零 JS）：Hero / About / Education / Honors / Projects / Experience / AvGeek（仅工具栏，其余数据为空自动隐藏）/ Contact / Footer（"最近更新"与版本号自动来自 git）。
- `/resume.pdf` ← `content/resume/Resume.pdf`。
- 旧站移至 `legacy/`（仅删除已注释掉的 GA/GTM 块，PLAN §2.4）。
- CI（`.github/workflows/ci.yml`）：Prettier · ESLint · astro check · 内容检查（占位符在 main 严格；未闭合 `<!--`、非法项目文件名任何分支都报错）· Vitest（覆盖率 ≥ 80 %）· 严格构建（任何 WARN/ERROR 即失败）· size-limit · Playwright E2E（Chromium / 移动 Chromium / WebKit）+ axe；另一个 job 用**上线配置**跑 Lighthouse CI（移动端四项 ≥ 95，取中位数）+ 组装 + E2E，保证将来改 `launched: true` 的路径也被测过。
- 部署（`.github/workflows/deploy.yml`）：main → GitHub Pages，分阶段上线（ADR-010）；上传前对最终产物跑一遍 Chromium E2E 冒烟测试。
- 内容防呆：YAML 语法错误/重复键直接失败并打印 `✖ content/<文件>: 原因`；未加引号的 `#1` 这类会被 YAML 当注释截断的值会被拦下并提示加引号；文件缺失或解析失败不会用旧缓存渲染；`news` 可以一直往后加，页面只显示最新 5 条。
- 独立评审：5 个视角（事实保真、CI/部署、schema、计划合规、无障碍+令牌）+ 对抗式复核，30 条确认 + 5 条可能问题已全部修复或记录（见下）。

### M0 验收（PLAN §8）
| 验收项 | 结果 |
|---|---|
| `pnpm build` 零警告 | ✅ `scripts/build-strict.mjs` 把任何 WARN/ERROR 行当失败 |
| schema 覆盖全部字段 | ✅ 全部 `.strict()`；单测验证真实 content 通过、常见错误被拒 |
| 部署到预览 URL | ⏳ 合并后为 `https://zhic.me/v2/`（自定义域名下 `*.github.io` 会跳转，见 ADR-010）；需先完成下方"业主操作 1" |
| Lighthouse 移动端 ≥ 95 | ✅ GitHub CI 与本地均通过（中位数 Perf 100 / A11y 100 / BP 100 / SEO 100，LCP ≈ 0.76 s） |

## 阻塞 / 需要业主操作
1. **合并 M0 PR 之前**：仓库 Settings → Pages → Build and deployment → Source 改为 **GitHub Actions**。否则 main 根目录已没有 `index.html`，旧的"从分支部署"会让 zhic.me 显示 README。改完后合并，`Deploy` 工作流会发布：zhic.me（旧站不变）+ zhic.me/v2/（新站预览）+ zhic.me/legacy/。
2. Custom domain 在 Settings → Pages 中保持 `zhic.me`（Actions 部署以 Settings 为准；根目录 `CNAME` 仍保留，产物里的 CNAME 由 `site.yaml → domain` 生成）。

## 待业主确认的内容（未改动事实，均按原文迁移）
1. **项目名**：旧站项目区与简历写 "Time Stamp"，兴趣列表写 "Clock Stamp"，计划文档写 Clock Stamp。目前用 **Time Stamp**（`content/projects/time-stamp.md`）。哪个是正式名？App Store 链接？
2. **"I am a Junior"**（`content/about.md`）：2026-11 应已是大四（Senior）？
3. **兴趣第 3 条** "about to release … in around April/May" 已过期，请更新。
4. **拼写/语法**（按原文保留，等你改）：about 中 "Tech fans"、"colaboration"；footer "Expected to updated by each 2 weeks."；site 描述 "This is an personal/academic website"。
5. **经历要点**：HashKey 有 5 条（简历原文），M1 设计建议 1–3 条，请挑选/改写。
6. **项目一句话简介（tagline）**是我根据简历要点转述的（简历没有一句话简介）：Time Stamp、Classmate Map 两条，请确认或改写；Classmate Map 的状态我标为 `shipped`（有在线链接），对吗？
7. **邮箱**：按 Q6 只公开 `zchen75@uw.edu`；163 邮箱在 `profile.yaml` 中 `public: false`。About 段落原来的 "email" 链接指向 163，已改为 uw.edu。
8. 简历中**未在页面上展示**：电话、North Helpline Food Bank 志愿经历、技能/语言。要不要加？（注意：可下载的 `Resume.pdf` 本身含电话和 163 邮箱，与旧站一致；若不想公开，请换一份去掉这两项的 PDF。）
9. 仓库里的简历是 2026-03-31 版；DECISIONS 提到"简历已更新"——新版请放进 `content/artifacts/`，我会迁入。
10. `legacy/work/njzposts.pdf` 没有被任何页面链接，但目前可通过 zhic.me/work/njzposts.pdf 公开访问（内容含社交账号信息）。是否删除？

## 与计划的偏离
记入 PLAN §13：
- Astro 7 / TS 6 而非 Astro 5（ADR-009）。
- 预览方式：zhic.me/v2/ 而非 `*.github.io`（ADR-010）。
- 简历作为事实来源（ADR-011）。
- highlights ≤ 5、Lighthouse 以上线配置为准、CNAME 生成方式、WebKit 仅 CI、迁移测试改为一次性验收、简历单一来源（ADR-012）。

实现细节（未单独立 ADR）：
- 分支名：会话指定 `claude/affectionate-dirac-6zpbqu`，未用 `feat/m0-*`。
- favicon：自绘 16×16 体素草方块 SVG（`public/favicon.svg`），用 `block/grass`、`block/dirt` 加两个手选暗部色 `#5f9a3a`、`#6e4520`（尚非 Figma 变量，M1 同步令牌时补进 Figma）；无 Mojang 素材。
- 间距/阴影令牌 Figma 中尚无变量，`tokens.css` 中标注为 provisional，M1 同步。
- 项目 schema 已加可选 `icon` / `cover`（`cover` 需 `cover_alt`），供你在 `content/artifacts/` 放截图后使用。

## 下一步（三条）
1. 业主：完成"业主操作 1"，回答上面 1–10，合并 M0。合并后打开 zhic.me（应不变）、zhic.me/v2/、zhic.me/legacy/ 三个地址确认。
2. M1：按 Figma `Home — Voxel / 1440` 实现长页面全部区块与 UI 组件（MCButton/Tooltip/TerminalWindow/PixelBlock）、2.5D 像素地球、hover 粒子、打字机、响应式四档、视觉回归基线。
3. M1 验收后把 `content/site.yaml` 的 `launched` 改为 `true` 即正式替换旧站（DECISIONS Q1）。

## 移动端 WebGL 重启触发器（DECISIONS §16）
未触发（场景版尚未上线）。
