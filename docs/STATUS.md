# STATUS（会话交接 · PLAN §15.6）

> 更新：2026-11-09 夜 · 分支 `claude/affectionate-dirac-6zpbqu`

## 当前状态
| 里程碑 | 状态 |
|---|---|
| M0 骨架与内容迁移 | ✅ 已上线（PeterChen1216/Mysite#2，`ea935de`） |
| 内容更新：新简历 2026-11-03 | ✅ 已上线（PeterChen1216/Mysite#3，`e6f033c`；业主 R2-4 同意直接合并） |
| **M1 长页面版（Figma `Home — Voxel / 1440`）** | 🟡 **实现完成、自动检查全绿，等待你早上审核**（draft PR，未合并；未改 `launched`；未改 Figma） |
| M2 体素场景 / M3 窗口 | 未开始 |

线上：zhic.me/（旧站，不变）· zhic.me/v2/（目前仍是 M0 纯页面；M1 合并后更新）· zhic.me/legacy/。

---

## ☀️ 早上请审核 / 确认（按优先级）

### A. 是否接受 M1
1. 看 PR 描述里的截图（1440 / 390）或下载 CI 产物 `site-<sha>` 本地打开 `v2/index.html`。
2. 接受 → 合并 PR（zhic.me/v2/ 更新；旧首页不变）。
3. 是否同时 **正式上线**（`content/site.yaml` → `launched: true`，v2 替换旧首页，旧站移到 /legacy/）？DECISIONS Q1 说 "M1 完成即替换旧站"，但这一步我不会替你做。

### B. 设计稿里的界面文案（`content/copy.yaml`）——保留还是改？
这些是 Figma 原文或由你的内容拼出来的界面文字；`{占位符}` 会自动填入你的内容，copy.yaml 里不写关于你的事实。
- Hero 标题："Crafting **data** into things people love_"
- 区块标题与说明："Player stats & loaded chunks" / "Builds, shipped & in progress" / "Commit history" / "Let's craft something." 及各自右侧说明句
- About 卡片标题模板 `Hi, I’m {first} — {major} at the {department}.` → "Hi, I’m Peter — Informatics at the Information School."（Figma 原文写年级 "a junior…"，不放事实，见 C）
- 导航状态模板 `online · {city}` → "online · Seattle"（Figma 写 "online · SEA"）
- AvGeek 标题 "Routes, seats, mileage plans."（用你兴趣原文的 "mileage plans"；Figma 写 "mileage runs"，见 C）；Hero 徽章 "AvGeek ✈ routes · seats · mileage"
- Experience HEAD 行日期列 "now →"（Figma 写 "2026 →"；按 DECISIONS Q7 不写年份）；说明句改为 "newest first"（Figma 写 "in chronological order"，与倒序列表不符）
- 页脚："built with voxels, coffee & too many flights"（PLAN §5.4 举过的例子）
- "next --chunk ??? (loading…)" 预告卡

### C. Figma 里关于你本人的文案（**没有上页面**；你同意的我再加）
1. Whoami 改写版："Informatics, Data Science track, graduating June 2027. Huge tech fan…"（若采用需改为 March 2027）——目前页面用你的 about.md 原文；卡片标题 Figma 原文 "Hi, I’m Peter — a junior at the UW Information School."（若要写年级，改模板即可）
1b. "Routes, seats, mileage **runs**."（专门为攒里程而飞的行程——你的内容里没有）
2. 兴趣的风味描述（可写进 `interests.yaml` 的 `note:`）：table-tennis "forehand loops, late-night rallies"；choir "harmony beats a solo"；vibe-coding "weekend builds that occasionally ship"
3. AvGeek："Flight routes, seat maps, aircraft types and mileage programs — I track them all for fun."
4. Clock Stamp："first iOS app · solo build"、"My first iOS app, built solo from idea to App Store…"
5. 预告卡："Something with generative AI." + gen-ai 标签
6. HEAD 行："Next chapter · remote or Seattle · say hi ↓"（目前只显示 "say hi ↓"）
7. init 行："Spawned in Seattle — git init — moved to Seattle for UW"（目前把最早的真实条目 UW 标为 `init`）
8. "This website" 项目卡：需要新增 `content/projects/zhic-me.md`（真实技术栈是 Astro / TypeScript，不是设计稿写的 Next.js / Three.js / GSAP）
9. AvGeek 关注航线：往 `aviation.yaml` 的 `watching` 加 3–6 条（SEA⇄PVG 已按 Q4 去掉），地球和徽章会自动显示

### D. 与 Figma 的偏差（确认后应回写 Figma，PLAN §15.7；我没有改 Figma 文件）
- **无障碍配色**（WCAG AA）：Grass 按钮 #5d9c3a→#44802a（白字 3.2:1→4.8:1）；按钮 hover 蓝 #7b8dff→#4f63e0（黄字 2.9:1→4.8:1）；附魔紫标签/hash #a335ee→#b866f5；所有用 `text/lo` 的正文改为 `text/mid`
- **内容驱动的版式变化**：真实内容比设计稿多（3 段经历 + 志愿、3 个项目、技能、完整课程），页面从 4923 px 变为约 6500 px；新增 **Skills**（inventory 卡）与 **Community**（git log 风格）两个区块、每段经历下的要点、Contact 下的两个邮箱
- 设计稿里过期/被否的事实全部改为 content 数据：GPA 3.81→3.84、junior→senior、June→March 2027、SEA⇄PVG 航线/图钉移除、"Operation Intern"→"Operations Intern (Summer)"、Clock Stamp "WIP/eta 2026"→已上架
- 终端：Contact/Projects 用了带标题栏的终端（Figma 为无标题栏 MiniTerminal）；Contact 用等宽正文字体（VT323 22px 会让长邮箱换行）
- HashKey 用真实 logo 文件（不是设计稿重绘的像素版，避免改动第三方商标）
- 符号 ★ ✈ ⇄ → ↗：像素字体的 latin 子集里没有，改为系统符号字体或 CSS 像素绘制
- 新增：导航随滚动高亮当前区块；页面宽于 1440 时内容居中（1312 px）
- Grass 按钮 hover：Figma 组件是浅绿底黄字（PLAN §5.2 文字写"蓝底黄字"）——按 Figma 组件实现并为 AA 加深；Stone 按钮 hover 为蓝底黄字
- 第二条轨道环：Figma 是倾斜 18° 的椭圆并摆动 30°；实现为来回摆动（整圈旋转的椭圆看起来不对）
- Hero 舞台在 1024–1279 缩小显示；徽章文字始终 ≥ 8 px，缩到 0.78 以下（1024 附近与手机）时徽章隐藏（同样的事实在 About / Projects 里都有）

### E. 之前还没答的问题
1. Classmate Map：新简历没写，是否保留？
2. 旧站页面（zhic.me/ 与 /legacy/）仍显示 163 邮箱和旧事实（GPA 3.81 等）——是否从旧站去掉 163？是否尽快上线 v2？
3. `legacy/work/njzposts.pdf` 公开可访问、含社交账号，是否删除？
4. `www.zhic.me` 无证书：需要的话在 DNS 加 `www` CNAME → `peterchen1216.github.io`
5. Dean's List 2024–2025 的 "with 4 consecutive quarters"（仅旧简历有）是否保留？
6. about.md 拼写："Tech fans"→"tech fan"、"colaboration"→"collaboration"；profile tagline "UW 27'" → "UW ’27"？

---

## M1 已完成（本次夜间）
- **视觉合同**：Figma `17:2` 是 Code Layer，取得完整参考代码 + 55 个资产 + 动效时间线；转换为 Astro 组件 + scoped CSS + tokens（ADR-014）。
- **区块**：Nav（滚动高亮）、Hero（逐词标题、打字终端、CTA、舞台：CSS 条带法像素地球 + 轨道 + 10 个下落方块 + 玩家卡（hover 显示真人照片，Q7）+ 3 个数据驱动徽章）、Ticker、About bento（whoami / GPA+荣誉 / now building / 教育 / off the clock / AvGeek / 技能）、Projects（精选 + 实时时钟手机样机 + 项目卡 + 预告卡）、Experience（git log）+ Community、Contact（ping 终端）、Footer。
- **事实**：全部来自 `content/`，由 `src/lib/derive.ts`（16 个单测）与 `src/lib/page-data.ts` 计算；界面文案在 `content/copy.yaml`。
- **动效**：CSS 优先，`html.motion` 仅在 JS 可用且未开启 reduced-motion 时添加；开场序列按 Figma 参数单次播放；hover 像素粒子；地球 hover 减速、拖拽旋转、离屏暂停。无 JS 与 reduced-motion 下页面完整静止。
- **字体**：Astro Fonts API + 度量匹配 fallback（CLS ≈ 0）。
- **质量**：单测 74、E2E 42（Chromium / 移动 Chromium，CI 另跑 WebKit）、axe 0 严重、构建零警告、首屏 JS 2.0 KB gz（预算 180 KB）、Lighthouse 移动端 99–100 / 100 / 100 / 100、LCP ≈ 0.76 s；1440/1024/768/390 无横向滚动。
- **流程**：3 个分区 agent 并行实现（独立 worktree），我集成；独立评审（事实 / 视觉：18 条发现，16 条已修，2 条按 Figma 组件驳回；无障碍 / 代码：见 PR），修复后全部检查重新通过。

## M1 验收（PLAN §8）
| 验收项 | 结果 |
|---|---|
| 与 Figma `Home — Voxel / 1440` 一致（±4 px） | ✅ 固定几何在 ±2 px 内；高度随真实内容增加（见 D） |
| MCButton / Tooltip / TerminalWindow / PixelBlock 组件 | ✅ `src/components/ui/` |
| 2.5D 像素地球（无 WebGL） | ✅ CSS 条带法 |
| hover 粒子、打字机、reduced-motion 全覆盖 | ✅ |
| 响应式 390 / 768 / 1024 / 1440 | ✅ |
| 移动端 LCP ≤ 2.5 s、axe 0 严重、键盘可达 | ✅（LCP ≈ 0.76 s） |
| 业主人工验收 | ⏳ 早上 |

## 与计划的偏离
记入 PLAN §13：ADR-009 至 ADR-014。实现细节：分支名沿用会话指定的 `claude/affectionate-dirac-6zpbqu`；合并一律以业主账号 squash（业主要求）。

## 下一步（三条）
1. 你审核 M1（A–E），合并；决定是否 `launched: true`。
2. 把确认后的偏差与文案回写 Figma（或告诉我，我来改）。
3. M2：Three.js 体素场景与相机停靠（PLAN §8）。

## 移动端 WebGL 重启触发器（DECISIONS §16）
未触发（场景版尚未上线）。
