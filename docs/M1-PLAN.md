# M1 · 长页面版 — 边界与执行计划

> 2026-11-09 夜间开工（业主指示："明确边界就可以开工，需要审核和确认的滞后到早上"）。
> 依据：`docs/PLAN.md` §5、§8 M1、§9；`docs/DECISIONS.md`；Figma `Home — Voxel / 1440`（node `17:2`）。

## 1. 设计来源（已核实）
- `17:2` 是一个 **Code Layer**：Figma 给出完整参考代码（React + motion + Tailwind，1279 行）与 55 个资产（方块 SVG ×10 种、像素头像、HashKey 像素 logo、地球分层、背景网格/星点/光晕、轨道），以及 7.1 s 的开场动效时间线（`get_motion_context`）。
- 以参考代码为**视觉合同**，转换为 Astro 组件 + scoped CSS + `tokens.css`；不引入 Tailwind/React。
- 地球 = **条带法**：648×324 等距圆柱投影地图 ×3 平铺，在像素圆形 ocean 遮罩内水平平移 = 自转。纯 CSS，无 canvas/WebGL。

## 2. 范围内
| 区块 | 内容来源 |
|---|---|
| Nav（logo 方块、`~/about` 等、在线状态、RESUME / SAY HI） | 链接与邮箱来自 content |
| Hero（标题、终端打字、CTA、社交；舞台：地球、轨道、9 个方块、玩家卡、徽章） | 事实全部来自 content；标题为设计文案 |
| Ticker | 由 content 生成（GPA、项目状态、在职、兴趣、now.md） |
| About bento（whoami、GPA、NOW、Education、Off-the-clock、AvGeek） + **Inventory/Skills（新增）** | about.md 原文、education、projects、interests、aviation、skills |
| Projects（Featured 卡 + 手机样机、其余项目卡、"next chunk" 预告卡） | projects/*.md |
| Experience（git log：HEAD、各段经历、教育、志愿、init） | experience、education、profile.status |
| Contact（ping 终端、按钮）、Footer（版本、更新时间、回到顶部） | profile、site |
| 组件：MCButton、TerminalWindow、Tooltip、Chip、VoxelBlock、SectionHeader、CardTitle | — |
| 动效：开场序列（单次播放）、光标、轨道、地球自转（hover 减速、离屏暂停、可拖拽）、hover 像素粒子、ticker、MCButton hover 蓝底黄字 steps(3)、头像 hover 切真人照（Q7） | `src/motion/params.ts` 集中参数 |
| reduced-motion 全覆盖；无 JS 可读全部信息；响应式 390/768/1024/1440；键盘可达 | — |

## 3. 范围外（本次不做）
- WebGL 场景、相机停靠、漂浮窗口/目录、项目详情页、404、OG 图（M2/M3）。
- CONTENT-GUIDE、预览环境（M4）；分析、SEO 冲刺、域名切换（M5）。
- **不改 `launched`、不合并 M1 到 main、不改 Figma 文件**——这些都等早上业主审核。

## 4. 内容真实性边界（最重要）
Figma 稿里有设计者写的文案，其中不少是关于业主本人的事实或"风味描述"，部分已过期或被否决：
1. **事实只来自 `content/`**。不用 Figma 中的：GPA 3.81、"a junior"、"graduating June 2027"、SEA⇄PVG 航线与图钉、"Operation Intern"、Clock Stamp "WIP / eta 2026 / 70%"、"Next.js" 技术栈等。
2. **纯界面文案**（区块标题、提示语、按钮文字、终端窗口标题）原文照录 Figma，放进 `content/copy.yaml`（可改、有 schema），早上请审。
3. **关于业主本人的风味描述**（如 "forehand loops, late-night rallies"、"harmony beats a solo"、"built solo"、"moved to Seattle for UW"、"remote or Seattle"、"Something with generative AI"）**不上页面**，列入早上建议清单，业主同意后再加。
4. Whoami 卡片正文仍用业主的 `about.md` 原文；Figma 的改写版作为建议。
5. 低对比度文字：Figma 在真实文字上用了 `text/lo`（3.0:1，不达 WCAG AA）——实现改用 `text/mid`，记为 Figma 偏差。

## 5. 技术决定（ADR-014 草案）
- 交互用 Astro `<script>`（原生 TS，打包后按需加载），暂不引入 React/Preact：M1 交互简单，省约 45 KB gz；M2/M3 需要窗口管理时再评估。
- 动效参数集中在 `src/motion/params.ts`（与 Figma motion 数据、PLAN §5.2 对应），禁止散落魔法数字。
- 字体：为四款像素/等宽字体提供度量匹配的 fallback（size-adjust），避免字体加载引起 CLS（简历更新时已遇到 CLS 0.28）。

## 6. 执行顺序
1. 基础（我）：copy.yaml + schema、资产入库与命名、UI 组件、动效参数与脚本骨架、页面骨架。
2. 分区实现（工作流，独立 worktree 并行）：Nav+Hero+Ticker / About bento / Projects / Experience+Contact+Footer。
3. 集成：合并分支、全量 CI、390/768/1024/1440 截图、与 Figma 截图对照。
4. 对抗式评审：事实保真、视觉对照、无障碍、reduced-motion、性能预算。
5. 推送分支、开 **draft PR**（不合并），更新 STATUS 与早上清单。

## 7. 验收（PLAN §8 M1）
- 视觉与 Figma 对照（1440 允许 ±4 px；其他断点无设计稿，按设计语言推导并截图供审）。
- 移动端 LCP ≤ 2.5 s；Lighthouse 四项 ≥ 95；axe 0 严重；键盘可达所有交互；reduced-motion 下无动效。
- 首屏 JS ≤ 180 KB gz。
