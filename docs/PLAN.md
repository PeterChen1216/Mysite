# zhic.me v2 — 网站建设总体计划（供 Claude Opus 执行）

> 状态：v0.1 草案 · 2026-11-09 · 作者：Claude（Fable）/ 审阅：Peter Chen
> 本文是**可执行的项目章程 + 实施计划**，不是灵感板。目标读者是接手实现的 Opus 会话，以及作为业主的 Peter。
> 任何与本文冲突的即兴想法，先写进 §13 决策记录，再改代码。
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
- 待补：ADR-008 中文支持（v3）。
- **ADR-009** 框架版本：采用 Astro 7（计划写的 Astro 5 已落后两个大版本）+ TypeScript 6（`@astrojs/check`、`typescript-eslint` 尚不支持 TS 7）。内容层用 Astro 5+ 的 Content Layer（`file()`/`glob()` loader），schema 放 `src/content/schema.ts`，集合定义在 `src/content.config.ts`。（2026-11-09，M0）
- **ADR-010** 分阶段上线：`content/site.yaml → launched: false` 时，Pages 产物根目录仍是旧站（zhic.me 不变），v2 以 base `/v2/` 预览于 `zhic.me/v2/`（robots 屏蔽）；旧站同时保留于 `/legacy/`。M1 验收后业主把 `launched` 改为 `true` 即切换：v2 占根目录、旧站留 `/legacy/`、`/work/Resume.pdf` 旧链接继续可用。原因：自定义域名下 `*.github.io` 会 301 到 zhic.me，无法另开预览 URL；同一仓库只能有一个 Pages 站点。部署改为 GitHub Actions（需业主在 Settings → Pages 把 Source 改为 GitHub Actions）。（2026-11-09，M0）
- **ADR-011** 事实来源：除旧 `index.html` 外，允许从业主本人上传的 `Resume.pdf` 迁入事实（经历要点、辅修、课程、项目），**原文照录**并在 `source:` 字段注明；简历中的电话、志愿活动、技能暂不上站，待业主确认。（2026-11-09，M0）

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
