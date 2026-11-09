# STATUS（会话交接 · PLAN §15.6）

> 更新：2026-11-09 · 分支 `claude/affectionate-dirac-6zpbqu`

## 当前状态
- **M0 · 项目骨架与内容迁移 — ✅ 已合并上线**（PeterChen1216/Mysite#2，squash 提交 `ea935de`）。
  - https://zhic.me/ — 旧站（不变，直到 `launched: true`）
  - https://zhic.me/v2/ — 新站预览（robots 屏蔽）
  - https://zhic.me/legacy/ — 旧站永久副本
- **内容更新：新简历（2026-11-03）— 本分支**，评审 + CI 通过后按业主决定（DECISIONS 第二轮 R2-4）以业主账号 squash 合并上线。
- 下一个里程碑：**M1 · 长页面版**（未开始）。

## 本次内容更新（新简历 2026-11-03）
- `content/resume/Resume.pdf` 换成新版（旧版在 git 历史中）。新 PDF 不含电话、不含 163 邮箱，也没有旧版那条奇怪的 PDF 作者元数据。
- 按简历**原文**迁入：GPA 3.84/4.00；预计毕业 Mar 2027；Dean's List 2025–2026；新的相关课程列表；
  经历：UW iSchool 本科助教（INFO 180，Oct 2026 – Present）、Merit Interactive Agent Development Intern（Jul–Aug 2026）、HashKey 改为 "Operations Intern (Summer)" 与新的 2 条要点；
  项目：**Clock Stamp**（已上架 App Store，原 "Time Stamp" 文件改名为 `clock-stamp.md`）、X Community Notes Latent-Factor Analysis（INFO 494，Saveski-Lab）；
  新增 **Community**（North Helpline Food Bank 志愿）与 **Skills** 两个区块（`content/skills.yaml`）。
- 业主决定（DECISIONS 第二轮）：邮箱 Outlook 为主 + uw.edu；About 只改 "Senior" 与 "March of 2027"；兴趣第 3 条更新为已上架。
- 我做的取舍（请过目）：
  - **辅修 Applied Mathematics 已移除**：只出现在旧简历，新简历没有；为避免展示可能已不成立的事实先去掉。若仍在修，告诉我即可恢复。
  - **Classmate Map 保留**：新简历未列，但在线页面仍可访问；`featured: false`，排在最后。要删也只需删 `content/projects/classmate-map.md`。
  - 2024–2025 Dean's List 的 "with 4 consecutive quarters" 保留（来源：旧简历，历史事实不会过期）。
  - X Community Notes 的状态记为新增的 `completed`（已结束的课程/研究项目）；Clock Stamp 记为 `shipped`（App Store 页面已核实在线）。
  - Data Science track 保留（来源：旧站与你的站点标语）。
- schema：项目新增可选 `role` / `start` / `end` / `links.other`、状态 `completed`；新增 `skills` 集合；`kind: volunteer` 的经历显示在 Community 区块。
- 测试：M0 一次性迁移验收（逐字比对旧站）在内容按新简历更新后已不再适用，已移除（ADR-013）；常规 E2E 仍从 `content/` 读取全部期望值。

## M0 验收（PLAN §8）— 全部完成
| 验收项 | 结果 |
|---|---|
| `pnpm build` 零警告 | ✅ `scripts/build-strict.mjs` 把任何 WARN/ERROR 行当失败 |
| schema 覆盖全部字段 | ✅ 全部 `.strict()`；单测验证真实 content 通过、常见错误被拒 |
| 部署到预览 URL | ✅ https://zhic.me/v2/（自定义域名下 `*.github.io` 会跳转，见 ADR-010） |
| Lighthouse 移动端 ≥ 95 | ✅ CI（上线配置，中位数）Perf 100 / A11y 100 / BP 100 / SEO 100，LCP ≈ 0.76 s |
| 旧站内容 100% 迁入 | ✅ M0 合并时逐字验收通过（`ea935de`）；之后内容按业主更新演进 |

## 仍待业主确认
1. **拼写/语法**（按原文保留，等你改）：About 中 "Tech fans"、"colaboration"；footer "Expected to updated by each 2 weeks."；site 描述 "This is an personal/academic website"。
2. **Classmate Map** 的一句话简介是我根据旧简历转述的，请确认或改写（其余项目的简介均为新简历原文）。
3. `legacy/work/njzposts.pdf` 没有被任何页面链接，但目前可通过 zhic.me/work/njzposts.pdf 公开访问（内容含社交账号信息）。是否删除？
4. `www.zhic.me` 没有有效证书（只配置了 apex）。需要的话在 DNS 加 `www` CNAME → `peterchen1216.github.io`。
5. 旧首页 zhic.me/ 在 `launched: true` 之前仍显示旧内容（如 GPA 3.81、只有 HashKey 一段经历）；其上的"简历"按钮已指向新 PDF。

## 与计划的偏离
记入 PLAN §13：ADR-009（Astro 7 / TS 6）、ADR-010（分阶段上线 /v2/）、ADR-011（简历作为事实来源）、ADR-012（M0 实现细节）、ADR-013（移除 M0 一次性迁移测试；新简历带来的 schema 扩展）。

实现细节（未单独立 ADR）：
- 分支名：会话指定 `claude/affectionate-dirac-6zpbqu`，未用 `feat/m0-*`；合并一律以业主账号 squash，合并提交不带 Claude 署名（业主要求）。
- favicon：自绘 16×16 体素草方块 SVG（`public/favicon.svg`），用 `block/grass`、`block/dirt` 加两个手选暗部色 `#5f9a3a`、`#6e4520`（尚非 Figma 变量，M1 同步令牌时补进 Figma）；无 Mojang 素材。
- 间距/阴影令牌 Figma 中尚无变量，`tokens.css` 中标注为 provisional，M1 同步。

## 下一步（三条）
1. 合并本次简历更新后打开 zhic.me/v2/ 与 zhic.me/work/Resume.pdf 确认。
2. M1：按 Figma `Home — Voxel / 1440` 实现长页面全部区块与 UI 组件（MCButton/Tooltip/TerminalWindow/PixelBlock）、2.5D 像素地球、hover 粒子、打字机、响应式四档、视觉回归基线；Figma 需补 Skills / Community 区块。
3. M1 验收后把 `content/site.yaml` 的 `launched` 改为 `true` 即正式替换旧站（DECISIONS Q1）。

## 移动端 WebGL 重启触发器（DECISIONS §16）
未触发（场景版尚未上线）。
