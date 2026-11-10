# zhic.me v2 — 网站建设总体计划（供 Claude Opus 执行）

> 状态：v0.1 草案 · 2026-11-09 · 作者：Claude（Fable）/ 审阅：Peter Chen
> 本文是**可执行的项目章程 + 实施计划**，不是灵感板。目标读者是接手实现的 Opus 会话，以及作为业主的 Peter。
> 任何与本文冲突的即兴想法，先写进 §13 决策记录，再改代码。
>
> **2026-11-10 起**：M2 之后的顺序与范围以 [`PLAN-EXPERIENCE.md`](PLAN-EXPERIENCE.md) 为准（主题、多语言、无障碍、hover 目录、图形分级与 WebGL 占比、移动端）；本文的目标、边界、护栏与 M0–M5 的验收仍然有效。实际技术栈见 §13 ADR-009 / ADR-014（Astro 7、原生 TS，无 React）。
>
> 关联资产：Figma 原型 https://www.figma.com/design/cA9xh6uSZZvmFCUzrAhxjk （页 `Home — Voxel`：长页面版、🎬 Scroll-driven scene 相机停靠版、🧱 Components、🎨 Style tile、✨ Motion & Interactions）
> 参考站：https://0z5a.github.io/ （单场景 + 相机路径 + 漂浮窗口的交互范式）

---

## 0. 怎么读这份文档

| 你是谁 | 先读 | 然后 |
|---|---|---|
| Peter（业主） | §1 目标、§2 边界、§8 路线图、§14 待决问题 | 回答 §14，批准 §2 的边界 |
| Opus（实现者） | §15 工作协议 → §6 架构 → §8 当前里程碑 | 每个里程碑按 §9 验收，写 §13 决策记录 |
| 未来的你（维护） | §7 内容更新机制 | 只改 `content/`，不碰 `src/` |

全文维度总览（先列全，§1–§15 逐条展开）：

1. 目标与成功标准
2. 边界（范围、非目标、约束、预算）
3. 用户与使用场景
4. 信息架构与内容清单
5. 视觉与动效规范（引用 Figma）
6. 技术架构与选型
7. 内容更新与迭代机制（业主自助维护）
8. 路线图：里程碑、交付物、验收标准
9. 质量保证：性能、兼容、无障碍、视觉回归
10. 风险登记册
11. 部署、域名、分析、SEO
12. 法务、许可与隐私
13. 决策记录（ADR）
14. 待业主决定的问题
15. 给 Opus 的工作协议

---

## 1. 目标与成功标准

### 1.1 一句话定位
zhic.me 是 Peter Chen 的个人站：**一个会转的像素地球所在的体素世界，用终端命令讲述一个 UW 信息学 / 数据科学学生在做什么**。它要同时做到三件事：让招聘者 30 秒内拿到关键信息；让同好觉得"这人有意思，想聊聊"；让 Peter 自己每两周能在 5 分钟内更新一次而不碰代码。

### 1.2 目标（按优先级）
1. **可信的作品集**：教育、经历、项目、简历、联系方式准确、可找到、可下载。
2. **记忆点**：Minecraft 体素 × 终端 的视觉语言 + 滚动驱动的相机场景，让访客愿意分享。
3. **可维护**：内容与代码分离，非技术路径（改 Markdown/YAML、上传 PDF）即可更新；"最近更新于"自动生成。
4. **工程体面**：Lighthouse 四项 ≥ 90（移动端），无 WebGL 时有完整降级，键盘可操作。

### 1.3 成功指标（KPI，上线后 8 周评估）
| 指标 | 目标 | 测量方式 |
|---|---|---|
| 移动端 LCP | ≤ 2.5 s（4G 模拟） | Lighthouse CI / WebPageTest |
| 桌面端场景帧率 | ≥ 55 fps（M1 Air / 中端 Windows 独显均测） | 内置 perf HUD（?debug=1） |
| 首屏到可交互（TTI） | ≤ 3.5 s | Lighthouse |
| 简历下载/邮件点击 | 有计量（隐私友好分析） | Plausible/Umami 事件 |
| 业主更新一次内容耗时 | ≤ 5 分钟，零代码 | 由 Peter 实测并记录 |
| 无障碍 | axe 0 严重问题；reduced-motion 全链路生效 | axe-core CI |
| 浏览器 | 最新 2 版 Chrome/Edge/Safari/Firefox + iOS Safari 16+ | BrowserStack 或真机 |

### 1.4 非目标（明确不做）
- 不做博客系统/评论系统/登录；不做多语言（除非 §14 Q3 改变）。
- 不做服务器端渲染或数据库；纯静态输出。
- 不追求照片级 3D；体素风格是刻意的低多边形。
- 不在 v2 做 CMS 后台 UI（内容走 Git，见 §7）。

---

## 2. 边界（Bounds）

### 2.1 范围内
- 单页主站（相机场景版）+ 降级长页面版（同一内容源渲染）。
- 内容模块：Hero/关于/经历/项目/荣誉/兴趣/联系/页脚；简历 PDF；项目详情（弹层或子页，≤ 5 个项目）。
- 体素场景资产：像素地球（含 GIS 航线/图钉）、灯塔、浮岛、≥ 8 种方块、粒子、CRT 滤镜。
- 内容更新机制与文档、CI、部署到 GitHub Pages（自定义域名 zhic.me）。

### 2.2 范围外
- 原生 App、Newsletter、后台、第三方登录、电商。
- 真实航班数据接入（v3 候选，见 §14 Q6）。

### 2.3 硬约束
| 约束 | 值 | 说明 |
|---|---|---|
| 托管 | GitHub Pages（现状 CNAME=zhic.me） | 零成本；只能静态；每站 1 GB、月流量 100 GB 软限 |
| 预算 | ¥0 运行成本；字体/库全部开源许可 | 见 §12 |
| 首屏 JS 预算 | ≤ 180 KB gz（不含 Three.js chunk） | Three.js 场景按需加载，≤ 250 KB gz |
| 图片/贴图预算 | 总计 ≤ 1.5 MB；贴图 ≤ 64 px 像素风 | 体素风天然省流量 |
| 时间盒 | 6 个里程碑，每个 ≤ 1 周有效工作量 | 见 §8；超时即砍范围不砍质量 |
| 内容真实性 | 一切事实性内容由 Peter 提供；占位必须标 `TODO:` 并在 CI 中禁止进入 main | 防"编造" |

### 2.4 护栏（Opus 不得越界的事项）
- 不得编造经历、数据、奖项、项目描述；缺内容就留 `TODO:` 并提问。
- 不得引入需要付费或闭源许可的字体/模型/库。
- 不得把 Google Analytics 之类重追踪脚本加回（现有 index.html 中的 GA/GTM 注释块应删除）。
- 不得在无降级方案的情况下让 WebGL 成为访问内容的唯一途径。
- 不得改动 `content/` 中的事实字段以"让页面更好看"。

---

## 3. 用户与使用场景

| 画像 | 来源 | 任务 | 设计含义 |
|---|---|---|---|
| **招聘者 / 导师**（主） | 简历链接、LinkedIn | 30 秒验证身份、看项目、下简历、找邮箱 | Hero 必须有姓名/学校/年级/邮箱/简历；按 `?plain=1` 或自动降级直达长页面 |
| **同好 / 潜在合作者** | X/Twitter、GitHub | 看他在做什么、是否有共同兴趣（Gen-AI、航空、iOS） | 项目与兴趣要"可聊"，终端窗口里的命令与彩蛋有记忆点 |
| **朋友 / 同学** | 口口相传 | 玩一下、分享 | 场景可玩（键盘/滚轮飞行、hover 粒子），分享卡片（OG 图）好看 |
| **Peter 本人** | — | 两周更新一次 | §7 |

设备分布假设：移动端 ≥ 55%（来自社交），桌面端为招聘者主要入口。**移动端必须完整可用，但相机场景可降为"轻量场景"或静态插画。**

---

## 4. 信息架构与内容清单

### 4.1 页面与路由
```
/                 主站（相机场景；无 WebGL/低性能/reduced-motion → 长页面）
/?plain=1         强制长页面
/projects/<slug>  项目详情（静态生成；也可作为弹层打开）
/resume.pdf       简历（content/resume/Resume.pdf 发布时复制并带版本号）
/404              体素风 404（"chunk not found"）
sitemap.xml, robots.txt, og.png（自动生成）
```

### 4.2 模块 → 内容字段（以现有 index.html 为事实来源）
| 模块 | 字段 | 现状 |
|---|---|---|
| Hero | 姓名（中英）、一句话定位、学校/专业/届、城市、状态（"open to…"）、邮箱、社交链接、简历 | 有 |
| 关于 | 简介段落、兴趣列表、GPA、Dean's List | 有（文案需重写） |
| 教育 | 学校、学位、专业/track、起止、荣誉 | 有 |
| 经历 | 公司、职位、起止、城市、logo、1–3 条要点 | 仅 HashKey 一条，要点缺 |
| 项目 | 名称、一句话、状态、平台、链接、封面/图标、技术栈、时间 | Clock Stamp 仅名称 → **TODO** |
| 荣誉 | 名称、机构、年份 | 1 条 |
| 兴趣/彩蛋 | 航空（AvGeek 控制台：关注航线、座位规则、航线新闻、票价代码）、乒乓、合唱 | 结构已定（DECISIONS.md），数据由 Peter 两周一补 |
| 联系 | 邮箱、GitHub、LinkedIn、X | 有 |
| 元信息 | 最近更新日期（自动）、版本号（自动） | 手写 → 自动 |

### 4.3 内容数据模型（`content/` 目录，YAML/MD，见 §7）
```
content/
  profile.yaml        # 姓名、定位、状态、联系、社交
  education.yaml
  experience.yaml     # 数组，每项含 highlights[]
  projects/*.md       # frontmatter + 正文；slug = 文件名
  honors.yaml
  interests.yaml
  aviation.yaml       # AvGeek 控制台：watching[] 航线、seat_rules、news[]、fare_examples[]（见 DECISIONS.md）
  now.md              # "现在在做什么"，驱动 hero 终端输出
  resume/Resume.pdf
  site.yaml           # 域名、主题、功能开关（scene: true/false）
```
所有 schema 用 Zod 定义（`src/content/schema.ts`），构建时校验，字段缺失直接 fail build。

---

## 5. 视觉与动效规范

### 5.1 唯一真源
- 令牌（色板、字体、间距）：Figma 变量集 `Voxel/Night` + 文字样式 `Pixel/* Term/* Code/*` → 导出为 `src/styles/tokens.css`（CSS 变量），**手动同步，变更需在 PR 中附 Figma 链接**。
- 组件：`Block/*`（11 种方块 SVG）、`PixelGlobe`、`MCButton`、Tooltip、终端窗口 → 对应 React/Astro 组件同名。
- 字体：Pixelify Sans（标题）、Press Start 2P（8-bit 标签/按钮，仅 8/10/12 px 倍数）、VT323（终端输出）、JetBrains Mono（正文/代码）。全部 OFL，自托管 woff2 子集化（中文若需则用 Fusion Pixel，OFL）。

### 5.2 场景（相机停靠版）规范
- 一个固定 WebGL 场景，相机沿 5 个停靠点路径：Hero 全景 → About 推近灯塔 → Projects 钻到地球下方 → Experience 浮岛上空 → Contact 拉远。停靠点以 `scrollY / viewport` 归一化到 [0,1] 驱动，`lerp` 平滑（阻尼 0.08–0.12），禁止 scroll-jacking（不接管滚轮，不强制吸附；可选"轻吸附"开关）。
- 漂浮窗口（终端面板）是唯一 DOM 内容层：不透明、硬像素阴影、每个窗口绑定一个停靠点，进入时 `translateY(48→0)+opacity`，400 ms，`power4.out`。桌面端可拖拽标题栏；`more ▸` 放大为目录页；ESC 关闭。
- 常驻动效：地球自转 12 s/圈（可拖拽旋转，hover 减速）；轨道环漂移；飞机沿大圆航线；光尘粒子 ≤ 60 个；光标闪烁 500/500 ms。
- 开场：纯底色 + 三色错位像素名闪 ~1.4 s，同时预热渲染（连续 3 帧 < 25 ms 才淡入）；loading 条绑定真实资产进度。
- Hover：卡片/方块 → 16 个 4/6 px 像素粒子径向爆开（canvas 覆盖层，pointer-events:none），300–400 ms；按钮 → Minecraft 经典蓝底黄字 120 ms steps(3)。
- 滤镜：一层 quad——扫描线 14%、暗角 55%、轻颗粒；纯 alpha，不用 blend mode/filter()。
- `prefers-reduced-motion`：相机静止、窗口即时出现、无开场闪、无粒子、地球静止。

### 5.3 长页面版（降级/移动端）
- 与 Figma `Home — Voxel / 1440` 一致：导航、Hero（静态像素地球 PNG/SVG 或 2.5D 条带法）、ticker、About bento、Projects、Experience（git log 样式）、Contact、Footer。
- 触发条件：无 WebGL2、`navigator.hardwareConcurrency ≤ 4 且移动端`、`deviceMemory ≤ 4`、reduced-motion、`?plain=1`、场景 3 s 内未达稳定帧率。

### 5.4 内容声音（文案口吻）
- 终端式：命令 `$ whoami` / `$ cat ~/interests.txt` 引出真实信息；输出用第一人称、短句、少形容词。
- 禁用营销腔；允许轻幽默（"built with voxels, coffee & too many flights"）。
- 中英文：v2 英文为主（受众是美国招聘者），中文 §14 Q3。

---

## 6. 技术架构与选型

### 6.1 选型决策（ADR-001）
| 候选 | 评价 | 结论 |
|---|---|---|
| **Astro + React islands** | 静态输出天然适配 GitHub Pages；内容集合（Content Collections）+ Zod 校验内置；Three.js 只在一个 island 里加载；零 JS 的降级页 | **采用** |
| Next.js (static export) | 可行但对纯静态站偏重；image 优化在 export 下受限 | 备选 |
| 纯 Vite + vanilla | 最轻，但内容管理和路由要自己造 | 否 |

### 6.2 技术栈
- 框架：Astro 5 + TypeScript；交互岛用 React（或 Preact 以省 KB）。
- 3D：Three.js（InstancedMesh 体素球 ≈ 1200 实例；方块为合批几何）；可选 `@react-three/fiber`——**先用原生 Three 以控体积**。
- 动效：GSAP（ScrollTrigger 仅用于长页面版）；场景相机用自写 lerp + 停靠点表；文字打字自写 rAF。
- 样式：CSS 变量令牌 + 少量 CSS Modules；不引入 Tailwind（保持像素网格的手工控制）。
- 字体：`@fontsource` 或自托管子集；`font-display: swap`，像素字只用整数倍尺寸。
- 构建/质量：pnpm、ESLint、Prettier、Vitest（schema/工具函数）、Playwright（E2E + 视觉回归截图）、Lighthouse CI、axe-core。
- 部署：GitHub Actions → `gh-pages` 分支或 Pages artifact；CNAME 保留。

### 6.3 目录结构
```
/
  content/                 # 业主唯一需要碰的目录（§7）
  public/                  # favicon、og、robots；不放源资产
  src/
    content/schema.ts      # Zod schemas（Astro content collections）
    styles/tokens.css      # 来自 Figma 变量
    components/ui/         # MCButton, Tooltip, TerminalWindow, PixelBlock...
    components/sections/   # Hero, About, Projects, Experience, Contact
    scene/                 # Three.js：world.ts(建模) camera.ts(停靠点) globe.ts particles.ts filter.ts
    layouts/
    pages/index.astro, projects/[slug].astro, 404.astro
  scripts/                 # 生成 og 图、简历版本化、"last updated"
  tests/                   # vitest + playwright
  docs/PLAN.md, docs/adr/*.md, docs/CONTENT-GUIDE.md
```

### 6.4 关键实现要点
- **地球**：经纬网格 36×18（后续替换为 Natural Earth GeoJSON 栅格化到 10°→5°）；陆地/海洋/冰三色 + 面向光照的明暗；图钉与航线来自 `aviation.yaml → watching[]`（业主正在关注的真实航线，手动维护），大圆插值 CatmullRom；不展示虚构的"飞过的航线"。
- **相机**：`stops[]` 存 position/target/fov；`progress = clamp(scrollY / (docHeight - vh))`；取相邻两 stop 做 smoothstep 插值；再对结果做阻尼。窗口的"出现"用同一 progress 的阈值区间驱动，不监听各自元素位置，保证与相机同步。
- **自适应画质**：移动中若帧时间 > 20 ms，`renderer.setPixelRatio` 阶梯下调（1.0→0.75→0.5），静止 1 s 后恢复；在绘制前切换以免闪黑帧。
- **窗口拖拽**：Pointer Events；边界限制在"桌面"区域；最近屏幕中线的窗口持有硬阴影（阈值 1/6 屏高防抖）。
- **降级判定**：在 `<head>` 内联 1 KB 脚本做能力检测，决定加载场景 island 还是直接渲染长页面，避免布局抖动。
- **可访问性**：所有信息同时存在于 DOM（窗口即语义化 section）；场景 canvas `aria-hidden`；键盘：↓/↑/PgDn/PgUp 飞行、Tab 可达所有链接、ESC 关闭目录；焦点可见样式（像素描边）。

---

## 7. 内容更新与迭代机制（业主自助）

### 7.1 原则
- **内容在 `content/`，代码在 `src/`，两者不混。** Peter 永远只改前者。
- 一切事实性字段都有 schema；写错字段名/日期格式，CI 立刻红。
- "最近更新"与版本号自动来自 git（最后一次 `content/` 提交日期 + 短 hash），**删除手写日期**。

### 7.2 三条更新路径（由易到难）
1. **GitHub 网页编辑**（推荐，零安装）：打开 `content/xxx.yaml` → 铅笔图标 → 修改 → "Commit changes" → Actions 2–3 分钟自动部署。`docs/CONTENT-GUIDE.md` 提供每个文件的字段说明与示例，含截图。
2. **PR 预览**：对非 main 分支的改动自动部署预览（Pages 不支持多环境 → 用 Cloudflare Pages/Netlify 免费预览，或 Actions 产出 artifact 链接；见 §14 Q7）。
3. **Claude 对话更新**：Peter 在 Claude Code 里说"把实习经历加一条…"，Claude 只被允许改 `content/`（通过 CLAUDE.md 约束），并自动跑校验。

### 7.3 更新频率与清单（每两周）
- [ ] `now.md`：当前在做什么（驱动 hero 终端输出与 ticker）
- [ ] `projects/`：状态变化（WIP → shipped，加链接）
- [ ] `resume/Resume.pdf`：若更新则替换；脚本自动生成 `/resume.pdf` 与版本号文件名
- [ ] `experience.yaml`/`honors.yaml`：新增条目
- [ ] 不需要做：改日期、改版本、重新生成 OG 图（全部自动）

### 7.4 版本与发布
- 语义化版本写在 `site.yaml`，仅在结构性变化时手动升；内容变化走自动 `vX.Y.Z+<date>.<hash>`。
- `CHANGELOG.md` 由 Actions 根据提交信息自动追加（conventional commits：`content:`, `feat:`, `fix:`, `design:`）。

### 7.5 内容真实性守则
- 每个事实字段可选 `source:`（链接/说明），招聘者可能核验的内容（GPA、奖项、实习）必须有。
- CI 规则：`content/` 中出现 `TODO:` / `lorem` / `placeholder` → build 失败（main 分支）。

---

## 8. 路线图：里程碑、交付物、验收

> 每个里程碑一个 PR（或一组小 PR），合并前必须通过 §9 的自动检查 + Peter 的人工验收。超时策略：砍 §2.2 可选项，不砍验收标准。

### M0 · 项目骨架与内容迁移（≤ 2 天）
- 交付：Astro 项目初始化；`content/` 全部文件 + Zod schema；现有 index.html 内容 100% 迁入；tokens.css；CI（lint/test/build/axe/Lighthouse）；GitHub Pages 部署工作流；旧站保留于 `legacy/` 并可通过 `/legacy/` 访问直至 M3。
- 验收：`pnpm build` 零警告；schema 校验覆盖全部字段；部署到 `*.github.io` 预览 URL；Lighthouse 移动端 ≥ 95（此时无场景）。

### M1 · 长页面版（降级版即正式版的基线）（≤ 1 周）
- 交付：与 Figma `Home — Voxel / 1440` 一致的全部区块；MCButton/Tooltip/TerminalWindow/PixelBlock(SVG) 组件；像素地球的 2.5D 条带版（CSS/Canvas，无 WebGL）；hover 粒子 canvas；打字机；reduced-motion 全覆盖；响应式（390/768/1024/1440）。
- 验收：视觉回归截图与 Figma 对照（允许 ±4 px）；移动端 LCP ≤ 2.5 s；axe 0 严重；键盘可达所有交互。**此里程碑完成即可正式替换旧站**（可选，见 §14 Q1）。

### M2 · 体素场景（Three.js）与相机停靠（≤ 1.5 周）
- 交付：`scene/` 模块：世界建模（灯塔、浮岛、方块库）、体素地球（InstancedMesh）、航线与图钉、粒子光尘、CRT 滤镜 quad、相机路径 5 停靠、自适应画质、能力检测与降级切换、开场闪名与预热。
- 验收：桌面端 ≥ 55 fps（两台参考机）；场景 chunk ≤ 250 KB gz 且懒加载；无 WebGL 自动进入 M1 版本且首屏无抖动；`?debug=1` 显示帧时间 HUD。

### M3 · 漂浮窗口、目录页、项目详情（≤ 1 周）
- 交付：窗口停靠/拖拽/硬阴影规则；`more ▸` 放大为目录；ESC/标题栏关闭；项目详情页（静态）+ 弹层；404 页；OG 图生成脚本。
- 验收：Playwright 覆盖：键盘飞行、拖拽、打开/关闭目录、深链接 `/projects/clock-stamp` 直达；a11y 焦点管理（打开目录后焦点进入、关闭后返回）。

### M4 · 内容机制与业主体验（≤ 3 天）
- 交付：`docs/CONTENT-GUIDE.md`（含截图）；自动 last-updated/版本/CHANGELOG；简历版本化脚本；PR 预览链接；`CLAUDE.md`（约束 Claude 仅改 content 的规则 + 常用命令）；Peter 实测一次"零代码更新"并记录耗时。
- 验收：Peter 独立完成一次更新 ≤ 5 分钟；CI 对 `TODO:` 拦截生效。

### M5 · 打磨与上线（≤ 4 天）
- 交付：性能冲刺（字体子集、贴图图集、代码分割）；跨浏览器真机测试矩阵；分析（Plausible/Umami 自托管或免费层，§14 Q8）；SEO（meta、JSON-LD Person、sitemap）；域名切换 zhic.me → 新站；旧站 `/legacy/` 下线或保留 30 天。
- 验收：§1.3 全部 KPI 达标；§10 风险全部有 owner；发布公告（X 帖子 + OG 图）。

### 之后（v3 候选，不在本计划内）
真实航班数据（FlightAware/自己维护的 CSV）、中/日文、博客（Markdown 集合已天然支持）、Clock Stamp 发布页联动、WebGPU 路径。

---

## 9. 质量保证

### 9.1 自动化（每个 PR）
| 检查 | 工具 | 阈值 |
|---|---|---|
| 类型/规范 | tsc, ESLint, Prettier | 0 error |
| 内容 schema | Zod via Astro content | 0 error；`TODO:` 拦截（main） |
| 单元 | Vitest | 关键工具函数（相机插值、大圆、日期格式）覆盖 ≥ 80% |
| E2E | Playwright（Chromium/WebKit） | 关键路径全部通过 |
| 视觉回归 | Playwright 截图 vs 基线（390/1440） | 差异 ≤ 0.5% 像素，否则人工确认 |
| 性能 | Lighthouse CI（移动端） | Perf ≥ 90，A11y ≥ 95，BP ≥ 95，SEO ≥ 95 |
| 无障碍 | axe-core | 0 serious/critical |
| 体积 | size-limit | 首屏 ≤ 180 KB gz；场景 ≤ 250 KB gz |

### 9.2 人工验收（每个里程碑）
- 设计对照：与 Figma 并排截图，记录偏差与原因。
- 设备矩阵：iPhone（Safari）、Android 中端（Chrome）、MacBook（Safari/Chrome）、Windows（Edge/Firefox）、iPad 横屏。
- 降级路径：手动禁用 WebGL、开启 reduced-motion、节流 CPU 4×，三种情况都必须能读到全部信息。

### 9.3 "效果如何保证"的工程手段
- **以 Figma 为合同**：每个组件 PR 附 Figma 节点链接 + 截图对比。
- **动效参数表**（时长/缓动/阈值）集中在 `src/motion/params.ts`，与 §5.2 一一对应，禁止散落魔法数字。
- **perf HUD**：`?debug=1` 显示 fps、帧时间、pixelRatio 阶梯、drawcalls，截图进 PR。
- **预算即测试**：size-limit 与 Lighthouse 阈值写进 CI，超了就红。

---

## 10. 风险登记册

| # | 风险 | 可能性 | 影响 | 缓解 | Owner |
|---|---|---|---|---|---|
| R1 | 低端移动设备上 WebGL 卡顿/发热 | 高 | 高 | 能力检测 + 自适应画质 + 一键 plain 版；移动端默认轻量场景或静态 | Opus |
| R2 | 内容编造或占位进入线上 | 中 | 高 | §2.4 护栏 + CI `TODO:` 拦截 + `source:` 字段 | Peter/Opus |
| R3 | 范围蔓延（更多方块、更多彩蛋） | 高 | 中 | 每里程碑时间盒；新想法先进 backlog | Peter |
| R4 | 字体/素材许可问题 | 低 | 高 | 只用 OFL/CC0/自绘；§12 清单 | Opus |
| R5 | GitHub Pages 无多环境预览 | 中 | 低 | Cloudflare Pages 免费预览或 artifact | Opus |
| R6 | Three.js 体积超预算 | 中 | 中 | 只引入所需模块；考虑 OGL 替代；贴图用程序化 | Opus |
| R7 | Scroll-jacking 招致反感 | 中 | 中 | 不接管滚轮；相机跟随而非吸附；提供 plain 版 | Opus |
| R8 | 业主更新流程太繁琐而荒废 | 中 | 高 | M4 实测 ≤ 5 分钟；Claude 对话更新路径 | Peter |
| R9 | Safari 的 100vh/工具栏问题导致画布跳动 | 高 | 中 | 用 `lvh`/固定最大视口高度缓冲（参考站同解） | Opus |

---

## 11. 部署、域名、分析、SEO
- 部署：GitHub Actions（`actions/deploy-pages`），main 合并即发布；`CNAME` 文件保留 `zhic.me`；强制 HTTPS。
- DNS：A/AAAA 指向 GitHub Pages，`www` CNAME → apex（当前配置需核对，§14 Q9）。
- 分析：隐私友好、无 cookie（Plausible 免费层/自托管 Umami/Cloudflare Web Analytics 免费）；事件：简历下载、邮件点击、目录打开、plain 版触发率（用于评估 R1）。
- SEO：标题/描述、`Person` JSON-LD、OG/Twitter 卡片（自动生成像素风 OG 图）、sitemap、robots；保留旧 URL 行为（当前只有 `/` 和 PDF）。
- 监控：UptimeRobot 免费层；Lighthouse CI 每周定时跑一次并开 issue。

---

## 12. 法务、许可与隐私
- 字体：Pixelify Sans、Press Start 2P、VT323、JetBrains Mono（均 OFL）；中文如需：Fusion Pixel（OFL）。
- 视觉：Minecraft 为灵感来源，**不得使用 Mojang 的贴图、logo、字体文件或"Minecraft"商标作为站名/标题**；方块贴图全部自绘程序化；文案中可提"voxel"，避免品牌词。
- 第三方 logo（HashKey、UW）：仅作事实性标识使用，尺寸克制；UW 商标遵循学校使用规范。
- 隐私：无 cookie、无指纹；分析匿名；邮箱以文本展示（接受爬虫风险）或用轻量混淆（§14 Q10）。
- 许可：仓库代码 MIT，内容（文案/照片）保留所有权（README 注明）。

---

## 13. 决策记录（ADR，追加式）
- **ADR-001** 选 Astro + React islands 而非 Next.js：静态托管、内容集合、体积可控。（2026-11-09）
- **ADR-005** 预览环境 Cloudflare Pages；分析 Cloudflare Web Analytics。（2026-11-09，业主确认）
- **ADR-006** 航空模块不展示虚构航线；改为手动策展的 AvGeek 控制台，不爬取第三方站点。（2026-11-09）
- **ADR-007** M1 完成即上线替换旧站；移动端先静态，WebGL 重启按 DECISIONS.md §16 触发器。（2026-11-09）
- **ADR-002** 主站采用"单场景 + 相机停靠 + 漂浮窗口"范式；长页面版作为同内容源的降级/移动端基线。（2026-11-09）
- **ADR-003** 像素字体体系：Pixelify Sans / Press Start 2P / VT323 / JetBrains Mono，整数倍像素尺寸。（2026-11-09）
- **ADR-004** 内容以 Git 为 CMS，不做后台 UI；提供网页编辑指南与 Claude 对话更新路径。（2026-11-09）
- ADR-008 中文支持：由 ADR-017（X2）取代。
- **ADR-009** 框架版本：采用 Astro 7（计划写的 Astro 5 已落后两个大版本）+ TypeScript 6（`@astrojs/check`、`typescript-eslint` 尚不支持 TS 7）。内容层用 Astro 5+ 的 Content Layer（`file()`/`glob()` loader），schema 放 `src/content/schema.ts`，集合定义在 `src/content.config.ts`。（2026-11-09，M0）
- **ADR-010** 分阶段上线：`content/site.yaml → launched: false` 时，Pages 产物根目录仍是旧站（zhic.me 不变），v2 以 base `/v2/` 预览于 `zhic.me/v2/`（robots 屏蔽）；旧站同时保留于 `/legacy/`。M1 验收后业主把 `launched` 改为 `true` 即切换：v2 占根目录、旧站留 `/legacy/`、`/work/Resume.pdf` 旧链接继续可用。原因：自定义域名下 `*.github.io` 会 301 到 zhic.me，无法另开预览 URL；同一仓库只能有一个 Pages 站点。部署改为 GitHub Actions（需业主在 Settings → Pages 把 Source 改为 GitHub Actions）。（2026-11-09，M0）
- **ADR-011** 事实来源：除旧 `index.html` 外，允许从业主本人上传的 `Resume.pdf` 迁入事实（经历要点、辅修、课程、项目），**原文照录**并在 `source:` 字段注明；简历中的电话、志愿活动、技能暂不在页面上展示，待业主确认（注意：可下载的简历 PDF 本身含电话与 163 邮箱）。（2026-11-09，M0）
- **ADR-012** M0 的实现细节偏离：① 经历 `highlights` 上限放宽为 5（简历原文 5 条照录，M1 设计按 1–3 条展示，待业主挑选）；② Lighthouse 验收在"上线配置"（base `/`）下测量，CI 同时对上线配置做组装 + E2E；③ 根目录 `CNAME` 保留，但 Pages 产物中的 CNAME 由 `content/site.yaml → domain` 生成；④ WebKit E2E 仅在 CI 运行；⑤ 逐字核对旧站事实的迁移测试改为一次性验收（`pnpm test:migration`），常规 E2E 改为从 `content/` 读取期望值，业主改文案不需要改测试；⑥ 简历只有一个来源 `content/resume/Resume.pdf`，组装时复制到 `/work/Resume.pdf` 与 `/legacy/work/Resume.pdf`。（2026-11-09，M0 评审后）
- **ADR-013** 新简历（2026-11-03）迁入后：① 移除 M0 一次性逐字迁移测试（`pnpm test:migration`）——它在 M0 合并（`ea935de`）时已通过，而内容按业主更新后旧站事实不再是期望值；常规 E2E 继续从 `content/` 读取期望值。② 内容模型扩展：项目可选 `role`/`location`/`start`+`end`（成对）/`links.other`、状态 `completed`，`tagline` 由必填改为可选（偏离附录 A：宁缺不编）；教育 `gpa_label`；技能组 `basic`；新增 `content/skills.yaml`；`kind: volunteer` 的经历单列 Community 区块。M1 设计需为 Skills / Community 补 Figma 区块。（2026-11-09）
- **ADR-014** M1 实现方式：① Figma `Home — Voxel / 1440` 是 Code Layer，以其参考代码为视觉合同，转换为 Astro 组件 + scoped CSS + tokens，不引入 Tailwind/React；交互用原生 TS（Astro `<script>`，当前 1.8 KB gz），React/Preact 留待 M2/M3 窗口管理再评估。② 动效 CSS 优先：`html.motion` 类仅在 JS 可用且未开启 reduced-motion 时添加，开场序列参数取自 Figma motion 数据（原型 7.1 s 循环 → 站点单次播放），集中在 `src/motion/params.ts`。③ 像素地球用"条带法"（等距圆柱贴图在像素圆形遮罩内平移），纯 CSS，无 canvas/WebGL。④ 字体改用 Astro Fonts API（local provider）生成度量匹配的 fallback 并预加载关键字重，消除字体加载导致的布局偏移。⑤ 所有展示的事实由 `src/lib/derive.ts`（有单测）与 `src/lib/page-data.ts` 从 `content/` 计算；界面文案外置到 `content/copy.yaml`；Figma 中关于业主的设计文案不上页面（见 `docs/M1-PLAN.md` §4）。⑥ 为满足 WCAG AA，按钮/徽章/低对比文字颜色相对 Figma 做了最小调整（待业主与设计确认后回写 Figma）。（2026-11-09，M1）
- **ADR-015** X1 偏好设置：① 一个 `localStorage` 值 `zhic:prefs:v1`（theme / motion / text / lang / keys），不发送任何数据；② `<head>` 内联脚本由 `src/prefs/boot.ts` 的函数经 `Function#toString` 生成，与运行时共用同一份 `normalizePrefs` / `resolvePrefs`（单测既直接调用也执行内联文本），首帧前写 `data-theme` / `data-motion` / `--text-scale` / `theme-color`；③ 未选择过的访客默认 Night（Q-T2 默认答案），系统对比度与 forced-colors 总是生效；auto 跟随系统明暗；④ 系统「减少动态效果」总是优先于站内选择；⑤ 全部暂停用 `p` 键（加导航 ⏸），**不用计划写的空格**——页面上空格是浏览器的翻页键；单键快捷键在输入框内不触发、可关闭（WCAG 2.1.4）；⑥ 设置窗口是 `<dialog>` + 原生单选，代码按需加载；语言只存不显示（X2 加入）；语言列表唯一来源 `src/i18n/locales.ts`。（2026-11-10，X1）
- **ADR-016** X1 主题实现：① 主题 = `html[data-theme]` 选择的语义 token 块；「暗色物件」（终端、git log、手机、徽章、chip、设置窗口）用 `data-surface="dark"`，在 Day 里取 Night、在 Mono light 里取 Mono dark 的值；② 冗余符号由 token 开关（`--cue-display` 显示字形、`--cue-on` 以算术切换形状），字形以 `data-cue` 的 `::before` 绘制，不改文本；Night 不显示（原设计、像素不变），其余主题与更高对比度 / forced-colors 显示；③ 美术不做第二套：`--art-filter`（彩色主题为空值，使 `filter: var(--art-filter) drop-shadow(…)` 仍然有效）、`--art-land-filter`、`--art-sky`、`--art-grid`；④ 对比度是单元测试：`src/lib/theme-tokens.ts` 按浏览器层叠规则解析 `tokens.css`，遇到不认识的选择器即报错；⑤ 触屏 44 px 点击区用不可见的伪元素实现（不改外观）。（2026-11-10，X1）
- **ADR-017** X2 多语言（PLAN-EXPERIENCE §5）：① **路由**：`/`（en）、`/zh-hans/`（`lang="zh-Hans"`）、`/zh-hant/`（`lang="zh-Hant-HK"`），预览期都在 `/v2/` 下；Astro i18n、`prefixDefaultLocale: false`；页面主体 `src/components/HomePage.astro` 每种语言渲染一次；没有 `/zh/`。② **草稿怎样不上线（计划没定，这里定）**：`content/site.yaml → locales` 给每种语言一个状态 `live` / `preview`；英文永远 live，两种中文从 preview 开始。preview 语言照常构建、部署，业主在它的网址上读；但它带 `noindex`、不进 hreflang、不出现在 live 页面的语言切换里，每页顶部显示翻译过的「草稿译文，尚未经过审阅」。任何翻译字段或文件都可以带 `draft: true`；**live 语言里只要有一个 draft，内容检查和构建都失败**。所以带草稿的分支可以合并到 main 而不会有未读的译文被当成定稿。上线一种语言 = 删掉它的 draft，把 preview 改成 live。③ **内容模型**：YAML 事实里与英文字段并列的 `zh-hans:` / `zh-hant:` 块（字段级，可选；`from:` 记每个字段来源文字的哈希，`draft:` 是 `true` 或字段列表）；Markdown 用同名翻译文件（`about.zh-hans.md`、`projects/<id>.zh-hant.md`，正文是译文，frontmatter 是块）；界面文字 `copy.<locale>.yaml` 与 `copy.yaml` 键完全一致（少一个或多一个都构建失败）；没有语言的事实（日期、GPA、网址、技术名、机场代码、公司 / 学校 / 产品名）只有一份。规则集中在 `src/i18n/translations.ts`，构建、内容检查、两个脚本共用。④ **回退**：缺译文的字段显示英文并标 `lang="en"`——页面数据用两个私用区字符包住回退文字，`src/middleware.ts` 在页面生成后把它们变成 `<span lang="en">`（属性、`<title>`、脚本里只去掉标记）；没有翻译文件的 Markdown 正文整块标 `lang="en"`。⑤ **繁体由简体生成**：`pnpm content:hant`（opencc-js `s2hk`，只是 dev 依赖）只补缺、从不覆盖已有字段、写入 `draft: true` 和来源哈希、只在 YAML 能逐字节往返时才写（不重排业主的格式），并列出一对多需人工确认的字；代表语言自身的三个键（`i18n.name`、`suggest`、`suggest_go`）不转换，由人写。⑥ **过期报告**：`pnpm content:stale` 比较来源哈希——英文改了，简体列出、繁体以「经由简体」列出；简体改了，繁体列出；只是报告（CI 里跑，不失败）；`--accept <locale>` 记录当前来源。⑦ **字体**：Fusion Pixel 12px（Fontsource SC / TC 包，2024.05.12，OFL；**这个版本没有香港切分**，繁体用 `zh_hant`），构建后按每种语言页面上实际出现的字子集化（简 21 KB、繁 23 KB，预算各 160 KB），因 OFL 保留字体名改名为 zhic Pixel SC / TC，只在本语言页面内联声明且只覆盖 CJK 码位，英文页面不加载；系统 CJK 正文（PingFang / Noto Sans CJK / 微软雅黑 / 正黑…）也是页面内的 `local()` 别名并只覆盖 CJK 码位——直接写进字体栈会让 CJK 字体把 → ★ 画成全角，也会让没装这些字体的系统逐字搜索字体。中文字体 token：像素字号取 12 px 倍数（84 / 48 / 24 / 12，8 与 10 px 标签升到 12），无字距、无大写、行距更松。⑧ **首次访问建议**：按计划的映射读 `navigator.languages`，只建议 live 语言，用被建议语言本身的文字显示一行横幅（浏览器空闲时出现，固定在底部，不造成布局偏移），从不跳转；选择或关闭存进偏好 `lang`。设置窗口的语言行是普通链接（各用自己的语言和 `lang`），切换时保持当前区块。⑨ 原本写在代码里的界面词（月份、平台名、列表分隔符、whoami 句式、/summon 回答）移入 copy，英文输出不变。（2026-11-10，X2）
- **ADR-018** M2 场景（PLAN-EXPERIENCE §7；本 ADR 记录与 PLAN §6.2 / §8 M2、PLAN-EXPERIENCE §7.2–§7.5 不同之处）：① **自写 WebGL 2 渲染器，不用 Three.js**（§6.2 写的是 Three.js）：场景只需实例化立方体、公告板精灵和一张网格平面三个程序；自写后场景 chunk 18 KB gz（Three.js 仅 WebGLRenderer 就约 130 KB gz），解析快、首帧早，绘制调用和「换主题只改 uniform」都在自己手里；PLAN R6 本就预留了替代方案。② **图形等级**：头部内联脚本只决定第 0 级（动效关闭 / 系统减少动态 / 减少数据 / `?tier=0`：不加 `motion` 与 `intro` 类），1–3 级在主脚本里决定，WebGL 探测在页面可用（load 之后、空闲时）才做——与「在 `<head>` 一次决定」不同；因为 1–3 级首帧完全相同（场景出现时只是把 DOM 美术淡出，不改版面），这样不增加首帧工作，也不造成布局偏移。③ **自动化浏览器**（`navigator.webdriver`：测试、爬虫）默认第 1 级，除非 `?tier=` 指定；`?tier=auto` 按真人规则判断。软件渲染：`failIfMajorPerformanceCaveat` + 渲染器字符串（SwiftShader、llvmpipe…）；WebKit 会把渲染器名称伪装成 "Apple GPU"，所以另加预热门槛（3 秒内连续 3 帧 < 25 ms，PLAN §5.2），不过则本次会话降到第 2 级。④ **calm 保留场景**（按委托说明「calm slows it」：循环慢 3 倍、无光尘、XP 球不追指针、相机无滞后）；PLAN-EXPERIENCE §7.2 的表把 calm 放在第 1 级——列为待业主决定。暂停：一切静止，滚动仍直接放置相机（不会自己动）。动效关闭：第 0 级，场景移除、DOM 美术回来；不刷新即可来回切换。⑤ **手机和平板**：第 2 级 = 现在的页面（2D 环境层属 X3）；第 3 级只给能悬停的精细指针且视口 ≥ 1024 px（§7.2 写「桌面和有能力的平板」——平板留到 X4/X5）。更高对比度与强制颜色：第 1 级（画布不跟系统调色板）。⑥ **舞台替换**：第 3 级时英雄区的地球、轨道、卫星、方块与页面背景图、About 的两个方块淡出；玩家卡与三个徽章保留；地球的滑块（键盘 / 拖拽 / 悬停减速 / 暂停）保留在原处、不可见，转动 WebGL 地球。WebGL 地球是真正的球体，DOM 地球是平移的平面地图，所以交接时大陆形状略有不同（位置、大小对齐）。⑦ **WebGL 占比的定义与结果**：在 40 个等距滚动位置、场景暂停时（只算世界本身，不算光尘与扫描：下限），比较「有场景」与「场景透明」的视口截图，某位置有 ≥ 1 % 像素（1440×900 下约一个 115 px 方块）差异 ≥ 24/255 即算「在视野内」。Chromium（SwiftShader）：1440×900 40 %、1280×800 与 1920×1080 42.5 %；**1024×768 为 23–37 %（随字体与运行浮动），可能低于 35 %**——About 在 1024 是两栏、两侧只有 32 px 边距，从英雄区到 AvGeek 之间几乎看不到场景；测试对 ≥ 1280 断言 35 %，对 1024 只断言 25 % 并报告实际值。⑧ **文字后的遮罩**：导航、英雄区文字、滚动条、各区块标题之后，场景在着色器里退回天空色（边缘柔和），并有测试在五个主题、1440 / 1024、英雄区 / About / 淡出位置上，逐像素量文字与真实背景的对比度。⑨ **页边方块**：About 两侧边距里的方块画在相机前固定距离处，随页面滚动（替代 DOM 的两个方块并加几个）。⑩ 场景在 About 结束后溶入天空、停止绘制；第 4–6 站（M3）接入同一张站点表。⑪ 航线机场位置表在 `src/scene/airports.ts`（公开参考位置，0.01°）；`watching` 里有表外机场时 `pnpm content:check` 给出警告（不失败），卡片照常列出该航线。⑫ PLAN §8 M2 里**没做**的：CRT 滤镜、开场闪名（PLAN-EXPERIENCE 的 M2 行没有它们；业主排序里滤镜颗粒最低）、灯塔光束（第 6 站，M3）、Natural Earth 更细地图（沿用 DOM 地球的 36×18 地图，两者一致）。（2026-11-10，M2）
- **ADR-019** X3 交互（PLAN-EXPERIENCE §6 目录 16 行、§7.4 2 级动效；本 ADR 记录与计划不同之处）：① **第 5 行（航线）推迟**：`aviation.yaml → watching` 为空，没有航线可画；不做假航线。第 4 行的「关注的航线变亮」同理。② **第 1 行在 3 级**：英雄区的 DOM 方块被 WebGL 场景替换且隐藏（不接收指针）；它们的盒子仍标出每个方块的位置，指针进入时粒子按该方块自己的颜色从它中心爆开，场景里对应的立方体（草地块 = heroChunk 六块，其余六块按舞台顺序）两帧压扁再弹回。About 两侧与页边的场景方块不可点。③ **第 6 行**：哈希变成 `git show <hash>` 只在哈希栏够宽（≥ 1024 px，16 个字符）时；更窄处那一栏和哈希一样宽，覆盖层会盖住日期——那里只有节点脉动与轨道点亮。「折叠的要点展开」属于 X4 的移动版式（现在没有折叠）。④ **第 10 行**：玩家卡的 XP 条以前是满格，现在静止时就显示真实 GPA 比例（3.84/4.00 = 96 %，剩下 4 % 是空槽）——这是唯一有意改变静止画面的地方；悬停 / 聚焦 / 轻触时它从空重新填满。复制用户名的键只在名字牌显示时（舞台容器 ≥ 440 px）存在。⑤ **第 11 行**：手机原来整个 `aria-hidden`；为了键盘能逐个城市 Tab，有 JavaScript 时指针标签变成按钮，组成一个有名字的组，其余画面仍对读屏隐藏（没有 JavaScript 时与以前一样整个隐藏）。其他指针变暗只在访客选过城市之后（静止画面不变）。暂停时换城市，显示的是暂停那一刻该城市的时间。⑥ **第 12 行**：命令只打印页面或 `content/` 已有的东西（whoami、兴趣、栏目、简历链接、主题名）；终端保持原尺寸、内部滚动，所以页面不移动；命令本身保持英文。⑦ **第 14 行与区块加载过渡**：起始状态只在动画进行时存在（`animation-fill-mode: backwards`，由 `data-enter` 触发），所以没有 JavaScript、减少动态、calm、off、暂停、或打开页面时已在视野里的区块都直接完整显示；暂停或改动效级别会立即结束进行中的入场。标题打字在 1–3 级（动效 full），卡片上升 / 虚线变实线 / 数据条填充只在 2–3 级（§7.2 把它列在 2 级）。⑧ **第 15 行**：桌面上方块与英雄区舞台总是十字光标；「场景上」只在 3 级（有场景时）指没有文字的容器区域；光标是继承属性，所以这些容器把 `auto` 还给每个不是容器的子元素（链接保留手形、地球保留抓手）。⑨ **第 8 行**：下划线在链接下方 3 px（链接点亮时自己有边框）；当前区块的方块光标只在 ≥ 768 px（手机版链接没有右内边距可放）。⑩ **2 级环境层**：calm 时不出现（§4.1 calm = 无视差、无粒子）；光尘只在首屏、英雄区在视野内时动；暂停时光尘停住，但滚动仍移动星空（那是访客自己的动作，同 M2 场景的相机）；浅色主题没有夜空，什么都不画；它出现时页面的静态星星图片隐藏。⑪ **悬停样式**：目录里的悬停都在 `@media (hover: hover)` 里；顺带把已有的按钮、导航链接、导航键、英雄区链接的 `:hover` 也移进去（触屏轻触后不再「粘住」高亮），`:focus-visible` 不变。⑫ **粒子覆盖层**：空闲时把画布缩成 1 × 1 像素，只在粒子飞行时占内存（§1.3 的「1 WebGL + 1 2D」）。⑬ **「正在做」的天数计数器没做**：Clock Stamp 的 `start` 是 `2026-03`（只到月），按天数会编造日期；需要 `start` 精确到日（schema 现只收 `YYYY-MM`）。（2026-11-10，X3）

- **ADR-020** M3 漂浮窗口、目录、项目页、404、第 4–6 站与 OG 图（PLAN §8 M3，PLAN-EXPERIENCE §7.3、§9；本 ADR 记录计划没写清或不同之处）：① **窗口是什么**：长页面版保留（ADR-002 的降级基线就是正式版），各区块不改版；「窗口」是页面之上的两个模态 `<dialog>`（`src/components/ui/Window.astro`）——Projects 的目录、一个项目的窗口——不透明、8 px 硬像素阴影，背后页面与场景变暗到约 1/8（Figma 注释「the scene dims to 12 %」，用 token `--color-backdrop-window`，不用模糊）。② **停靠与拖拽（计划只写了「停靠/拖拽/硬阴影」，这里定最简单的规则）**：桌面 = 视口；窗口停靠在内容栏居中、距顶 64 px（手机 16 px），宽同内容栏、高随内容（超出桌面时窗口内部滚动）；精细指针拖标题栏，窗口始终整个留在桌面内（8 px 边距），松手时离停靠点 24 px 内就回到停靠点、离边缘 24 px 内就贴边；拖动中阴影变硬（12 px，`--color-shadow-lift`）。「最近屏幕中线的窗口持有阴影」没有做：同时最多两个窗口叠放，上面那个就是焦点所在。标题栏上的**移动键**是键盘替身（WCAG 2.5.7）：方向键移 16 px、Shift 64 px，Home / Enter / 空格放回停靠点；Tab 照常离开，不是陷阱。**关闭**：Esc、`[x] close` 键、单击标题栏（按下后移动 ≤ 4 px 才算单击，Figma「ESC / click the bar to shrink the window back」）。所有规则在 `src/lib/windows.ts`（单测）。③ **目录只有 Projects**：Figma 只画了 `projects/ — directory`；其他区块在页面上已经列出全部内容，目录只会重复。`more ▸` 在 Projects 标题的命令行末尾（24 px 高、负边距，不改版面——静止画面只有这 64 × 24 px 不同），没有 JS 时链接到新的 `/projects/` 目录页（计划 §4.1 没有这个路由，是 `more ▸` 的无 JS 去处）。④ **项目页与项目窗口一份来源**：`/projects/<id>/` 每种语言一页（只用 `content/projects/<id>.md` 与译文：标题、平台、年份、状态、tagline、角色 / 地点 / 日期、正文、技术栈、链接；Clock Stamp 带它的实时手机）；首页上点项目标题（标题本身变成链接，静止时外观不变）或目录里的项目，用 `pushState` 推入该页的真实地址，窗口内容从那一页取来（`fetch` 后取 `[data-project]`，h1 改为 h2，首页仍只有一个 h1）；Back 关窗口、Forward 再打开、刷新即静态页；带修饰键或新标签打开交给浏览器。窗口代码按需加载（`windows.*.js`），首屏只有 0.6 KB 的链接拦截（`window-links.ts`）。焦点：打开目录 → 第一个项目链接；打开项目 → 它的标题；关闭 → 回到打开它的那个链接。⑤ **404**：GitHub Pages 只用根目录一个 `404.html`，所以它包含三种语言，首帧前按地址选（`/zh-hant/…` 繁体，否则英文；无 JS 英文）；`launched: false` 时 `/v2/` 以外的地址属于旧站，「回家」指向根目录、不提供项目链接。不收录、没有 canonical 与 OG 图。⑥ **第 4–6 站（世界里新加的地形：峡谷）**：长页面的卡片是不透明的宽面板，场景只能从页边、卡片间隙和区块间的空带露出来，所以 About 以下的世界是一道峡谷的正面（`src/scene/world.ts` `canyon()`：边缘草地、泥土、石头带矿石和萤石、峡谷深处的后壁），相机沿着它往下走——这是计划没有的地形，按「一个场景、相机停靠」的意思选的。第 4 站：峡谷边缘的工作台（工作台方块的面画在第二张贴图里），在 Projects 标题的空位里取景（与第 2 站同一取景法）；每个项目一个方块（Q-G2：通用方块，按平台选），它的卡片第一次进入视野时由八块拼合（全动效 700 ms；calm / off / 暂停时直接拼好）；Clock Stamp 的方块侧面是**实时 24 小时表盘**（16 × 16 贴图，每分钟按 `copy.yaml projects.phone` 的城市重画，颜色同手机）；「next chunk」是一堆永远拼不起来的 TNT 碎块。第 5 站：矿车轨道画在 git log 左边的页边里（贴着页面画在相机前，与 About 的页边方块同法——页边 ≥ 24 px 才画），矿车停在视野中间那一行，滚动时滑过去（全动效阻尼 220 ms）。第 6 站：在 Contact 终端旁的空位里远看地球（连着它的方块、轨道、岛），灯塔光束开启，每秒随一次 ping 闪亮后衰减（`ping` 的默认间隔；calm 慢三倍，暂停停住）。场景**不再在 About 后淡出**（M2 的 ADR-018 ⑩ 被取代）。⑦ **WebGL 占比**：沿用 M2 的量法（40 个位置、场景暂停、有/无画布截图、≥ 1 % 像素差 ≥ 24/255），四个桌面宽度都断言 ≥ 60 %——包括 M2 只能报告的 1024 px（现在页边总有峡谷）。⑧ **窗口打开时场景的循环停住**（同暂停；`html[data-window-open]`），关上继续。⑨ **OG 图**：构建时的 Astro 端点（`src/pages/og/[...card].png.ts`）用 sharp 把 SVG 画成 PNG；文字是仓库依赖里的字体（Pixelify Sans、JetBrains Mono、Fusion Pixel——都是 OFL，画进图片不是再分发字体）的字形轮廓，用 `fontkitten`（新 devDependency，只在构建时，Astro 自己的字体工具也依赖它）读取；颜色全部从 `tokens.css` 按主题解析。每种语言每个页面一张 Night（`og:image` 指它），首页另有每个主题一张（`home.<theme>.png`，给业主选）。⑩ CJK 子集改为每种语言全部页面共用一个（窗口里显示的项目页文字因此也在子集里）；首屏 JS 检查覆盖每个页面并跟随静态 import。（2026-11-10，M3）
- **ADR-021** M4 内容机制与业主体验（PLAN §7、§8 M4，PLAN-EXPERIENCE §9 的 M4 行；本 ADR 记录计划没写清或不同之处）：① **PR 预览**：§7.2 写「Cloudflare Pages/Netlify 免费预览，或 Actions 产出 artifact 链接」，DECISIONS Q5 / ADR-005 选了 Cloudflare Pages（需业主注册并授权仓库）。M4 不接入任何需要账号或密钥的服务，而 GitHub Pages 一个仓库只有一个站点、每次部署替换整个站点（分支预览放到 zhic.me 子路径既做不到，也会公开未审内容），所以现在的预览是：CI 每次推送把组装好的整个网站（`_site`，与部署的完全相同）作为 artifact 上传——放在 E2E 之前，运行开始后约 1 分钟可下载（CI 里组装在第 47 秒完成）——运行的 Summary 页给出下载链接和三步（解压、`pnpm preview:site <文件夹>`、打开它打印的地址）。没有每个 PR 一个网址；Cloudflare Pages 仍是业主已同意的方向，接入要业主的账号，列在 STATUS 待办。② **CHANGELOG**：§7.4 写「由 Actions 根据提交信息自动追加」。实现为每次整份重写（`pnpm changelog`，`scripts/changelog.mjs`；历史不变所以旧条目不变，等同追加）：部署成功后 `deploy.yml` 的 `changelog` 作业生成并以 `github-actions[bot]` 提交到 main（`chore(changelog): … [skip ci]`；用工作流令牌的提交不触发其他工作流，被拒时 rebase 重推）。只列 main 这条线（first-parent：每个合并的 PR、每个直接提交一条），从 v2 开始（创建 `content/site.yaml` 的提交），只用主题行、从不用正文；没有约定前缀但只改了 `content/` 的提交归入 Content（网页编辑器默认的「Update experience.yaml」）。代价：main 上有机器人提交，本机工作前要 `git pull`（指南 §13 写明）。CI 在每个分支上运行同一脚本（写到临时文件）证明它可用；提交与推送那一步只在合并后的第一次部署时真正运行（本机用裸仓库模拟过，包括推送被拒后 rebase 再推）。③ **简历版本化**：§4.1「发布时复制并带版本号」、§7.3「脚本自动生成 /resume.pdf 与版本号文件名」。版本 = `Resume.pdf` 最后一次被提交的日期 + 文件内容 SHA-256 前 8 位（未提交的替换按今天算）；发布 `/resume.pdf`（不变的地址，按钮仍链接它）与 `/resume/<日期>-<hash>.pdf`（只有当前版本——旧 PDF 含电话等个人信息，不保留）；首页与 Contact 的下载按钮的 `download` 属性给出 `<Name>-Resume-<日期>.pdf`（以前存成 `resume.pdf`）——这是 M4 唯一改变访客可见行为的地方，静止画面逐像素不变。`pnpm resume <文件>` 检查是 PDF 并放到位（从 `content/artifacts/` 来的移动，其他复制）。④ **内容检查**：`pnpm content:check` 现在也按构建同一份 schema 检查每个文件（`src/content/check.ts`），因为构建只报第一个错、位置是 `:0:0`、措辞是 Zod 的；报错用英文（脚本、CI 日志、schema 本来的消息都是英文），指南（中文）逐条列出真实报错与改法；在 GitHub Actions 里每条同时是注解。⑤ `CLAUDE.md` 用英文（读者是模型），指南用中文。⑥ **「业主实测一次并记录耗时」**：只有业主能做；我按指南做了演练并计时（STATUS），改了演练中发现的不清楚之处，并给业主留了自测清单。⑦ **部署时间**：§7.2 写「Actions 2–3 分钟自动部署」；现在 Deploy 在发布前跑完整的 Chromium E2E（`e19a7dc` 的 CI 上线配置作业里同样的一步 9 分 8 秒），推送到上线约 11 分钟（按 CI 中同样步骤的耗时估计；本 ADR 写时 main 上还没有 M3 之后的部署可量）。没有缩减（那会削弱发布前的守门），列为业主决定。（2026-11-10，M4）
---

## 14. 待业主决定的问题（请逐条回答，可写"按建议"）

> **2026-11-09 已回答一轮，结论见 `docs/DECISIONS.md`（含 AvGeek 模块重设计与移动端 WebGL 重启触发器）。以 DECISIONS.md 为准；本节保留原问题供追溯。**

1. **上线节奏**：M1 完成即替换旧站（先稳后酷），还是等 M3 场景版一起上？建议：M1 先上。
2. **移动端策略**：A) 轻量 WebGL 场景（更酷、风险 R1）；B) 静态像素插画 + 长页面（更稳）。建议：先 B，M5 视数据加 A。
3. **语言**：仅英文；还是中英双语（内容翻倍、维护成本 ×1.6）？建议：v2 英文，v3 再议。
4. **项目清单**：除 Clock Stamp 和本站，还有哪些项目/课程作业/开源贡献要放？每个给我：名称、一句话、链接、状态、2 张截图（可后补）。
5. **Clock Stamp**：它到底做什么？目标用户？当前阶段（开发/TestFlight/审核）？App Store 链接预计何时？
6. **航空彩蛋的数据**：是否愿意维护一份飞行记录 CSV（日期、航线、机型）驱动地球航线？还是只放 3–5 条"代表航线"？
7. **预览环境**：是否接受把预览部署放在 Cloudflare Pages（免费，需你注册并授权仓库）？否则用 Actions artifact。
8. **分析工具**：Plausible（托管有费用/自托管免费）、Umami（自托管免费）、Cloudflare Web Analytics（免费，无需自托管）——建议 Cloudflare。
9. **域名现状**：zhic.me 的 DNS 由谁托管？能否给我看一下现有记录（去掉敏感信息）？
10. **邮箱展示**：明文（方便招聘者）还是轻度混淆？两个邮箱（uw.edu / 163.com）都放还是只放 uw.edu？
11. **真人照片 vs 像素头像**：主站用像素化头像（已做）还是真人照片 + 像素边框？或 hover 切换？
12. **"状态"文案**："Open to internships & collaborations" 是否准确？目标时间段（2027 暑期实习 / 全职 2027）？
13. **可玩度上限**：是否接受键盘飞行、拖拽窗口这类"玩具"交互？还是只保留滚动驱动？
14. **参考站的哪些要素你最想要**：相机穿梭 / 漂浮窗 / 开场闪名 / 滤镜颗粒 / 常驻微动效——请排序，我按序分配预算。

---

## 15. 给 Opus 的工作协议
1. **开工前**：读完本文 §1–§9；检查 §14 是否已有答案（答案写在 §14 下方或 `docs/DECISIONS.md`）；未决的问题用"按建议"推进并在 PR 描述中标注假设。
2. **分支与提交**：功能分支 `feat/m<N>-<topic>`；conventional commits；每个里程碑一个 PR，PR 模板包含：Figma 节点链接、截图对比、perf HUD 截图、CI 状态、对 §14 假设的说明。
3. **定义完成（DoD）**：§9.1 全绿 + §8 该里程碑验收项逐条勾选 + 文档更新（CONTENT-GUIDE/ADR）。
4. **不要做**：§2.4 护栏；不要为了演示而硬编码内容；不要跳过降级路径；不要引入未在 §6.2 列出的大依赖（> 30 KB gz）而不写 ADR。
5. **提问时机**：事实性内容缺失、许可不明、需要新依赖、设计与 Figma 冲突、性能预算无法达成——立即在 PR 中提问并给出两个可选方案，不要停工等待其他部分。
6. **每次会话结束**：更新 `docs/STATUS.md`（当前里程碑、已完成、阻塞、下一步三条），让下一次会话 2 分钟内接上。
7. **与设计的来回**：实现中发现 Figma 不合理（如移动端窗口尺寸），先改 Figma（或在 Figma 加注释）再改代码，保持"Figma 是合同"。

---

### 附录 A · 内容 schema 草案（节选）
```ts
// src/content/schema.ts
export const Experience = z.object({
  company: z.string(), role: z.string(),
  start: z.string().regex(/^\d{4}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}$/).or(z.literal('present')),
  location: z.string(), url: z.string().url().optional(), logo: z.string().optional(),
  highlights: z.array(z.string()).min(1).max(3), source: z.string().optional(),
});
export const Project = z.object({
  title: z.string(), tagline: z.string().max(120),
  status: z.enum(['idea','wip','testflight','shipped','archived']),
  platform: z.array(z.enum(['ios','web','cli','research'])),
  links: z.object({ appstore: z.string().url().optional(), repo: z.string().url().optional(), live: z.string().url().optional() }).optional(),
  stack: z.array(z.string()).max(8), year: z.number().int(), featured: z.boolean().default(false),
});
```

### 附录 B · 初始 Backlog（按里程碑归档，Opus 可直接转 issues）
- M0: astro init · tokens.css · content/ 迁移 · schema · CI · pages 部署 · legacy/ 保留
- M1: Nav · Hero(static globe) · Ticker · About bento · Projects · Experience · Contact · Footer · 粒子 canvas · 打字机 · reduced-motion · 响应式四档 · 视觉回归基线
- M2: world.ts · globe.ts(InstancedMesh) · routes.ts(大圆) · camera.ts(停靠) · particles.ts · filter.ts · capability.ts · intro flash · adaptive quality · debug HUD
- M3: windows(停靠/拖拽/阴影) · directory · project pages · 404 · og 生成
- M4: CONTENT-GUIDE · last-updated/version/changelog 脚本 · resume 版本化 · 预览 · CLAUDE.md · 业主实测
- M5: 字体子集 · 贴图图集 · 代码分割 · 真机矩阵 · 分析 · SEO/JSON-LD · 域名切换 · 发布
