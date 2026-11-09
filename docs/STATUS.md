# STATUS（会话交接 · PLAN §15.6）

> 更新：2026-11-09（第四轮复核修复后）· 分支 `claude/affectionate-dirac-6zpbqu`

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
- 第二轮评审后新增的界面文字（以前写死在代码里，现在都在 copy.yaml，可改）：读屏用的名称（跳转链接 "Skip to content"、导航 "Sections"、logo "zhic.me — back to top"、滚动条 "Status"）、Hero 眉题前缀 "// player:"、有航线时的徽章模板 `AvGeek ✈ {from} ⇄ {to}`、滚动条标签词 XP/NOW/WORK/PING/EDU、ping 终端的三行输出与 `open mailto:{email}`
- `{占位符}` 现在在 copy.yaml 的**每一行**都能用（新增 `{host}` = 小写名字、`{domain}`、`{email}`），花括号里可以带空格（`{ city }`）；写错的占位符（包括 `{first-name}` 这类，以及把 `{from}`/`{to}` 写在 `hero.avgeek_route` 以外的地方）会让构建失败并指出是哪一行，不会出现在页面上。终端里的 "peter@zhic.me" 和 "ping peter" 都来自 `{host}@{domain}`
- 第三轮又移入 copy.yaml 的界面词：项目状态词 `labels.status`（idea / in progress / TestFlight / shipped / completed / archived，项目卡、徽章、滚动条共用）、进行中项目的结束词 `labels.present`（"Mar 2026 – Present"）、Hero 徽章的 `labels.gpa`（"GPA"）

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
- GPA 徽章：真实荣誉名更长（"Annual Dean's List 2025–26"，徽章比 Figma 长 61 px），按 Figma 的 left 300 会在 1100–1440 被页面右边裁掉。现改为靠右对齐；舞台旁有空间时（≥ 1280 并排、672–1023 居中堆叠）伸出舞台 40 px（Figma 是 24 px；1440 时右缘 1416），与金块不重叠。472–591 与 1098–1279 舞台缩小，徽章保持原字号，会盖住金块上半（37×22 或 42×21 px）和钻石块一角（22×6 或 11×3 px）；592–671 舞台原大但边距不够伸出，只盖住金块右上角 13×14 px（纯装饰，徽章在上层）；≤ 471 与 1024–1097 徽章隐藏。荣誉名再长时重叠会更多
- 玩家卡可以用键盘 Tab 选中，选中时显示真人照片（原来只有鼠标悬停能看到，Q7）；滚动条是可聚焦的命名区域，悬停或聚焦（Tab、点击、轻触）时暂停，焦点移开后继续——点击也会暂停是有意保留的：这是鼠标用户唯一能持续暂停的方式，在触屏上轻触聚焦更是唯一的暂停方式。如果只想让键盘聚焦暂停，把 `Ticker.astro` 里的 `:focus-within` 改成 `:focus-visible` 即可，但触屏用户就没有持续暂停的办法了

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
- **字体**：Astro Fonts API + 度量匹配 fallback；首屏用到的四种字体都预加载（CLS 0）。
- **质量**：单测 112（覆盖率门槛按文件 ≥ 80%，包含 derive.ts、projects-view.ts 与 motion/params.ts）、E2E 72（Chromium / 移动 Chromium，CI 另跑 WebKit）；axe 0 严重——正常动效、reduced-motion、无 JS 三种情况都测；构建零警告、首屏 JS 2.2 KB gz（预算 180 KB）、Lighthouse 移动端 98–100 / 100 / 100 / 100、LCP ≈ 0.76 s、CLS 0。布局测试：320–1920 共 10 个宽度（含 WCAG 1.4.10 的 320 px）逐词检查文字不被裁切、不溢出到相邻元素（旧的"无横向滚动"测试因 `.page{overflow-x:clip}` 永远通过，已替换）。
- **流程**：3 个分区 agent 并行实现（独立 worktree），我集成；两轮独立评审 + 对抗式复核。第一轮（事实 / 视觉）18 条：16 条已修，2 条按 Figma 组件驳回。第二轮（无障碍 / 代码）25 条：24 条确认、1 条驳回；23 条产品问题全部修复（见下），另 1 条是评审流程自身的问题（评审副本共用 node_modules 缓存，已改流程，主仓库未受影响）。第三轮独立复核第二轮的修复：22 条确认修好、3 条只修了一半，另有 22 条新线索（复核 agent 中途碰到用量上限，对抗式复核与性能扫描没跑完）；我逐条核对后全部处理（见下），其中"点击滚动条也会暂停"按设计保留（见 D）。第四轮再次独立复核：第三轮的修复全部确认（Lighthouse 9 + 9 次对比无退化、axe 12 种组合 0 违规、截图除 768 的徽章外逐像素相同），另有 11 条小问题，全部修复（见下）。

### 第二轮评审修复（无障碍 / 动效 / 代码）
- 无障碍：滚动条在 reduced-motion / 无 JS 下是无名称、键盘无法滚动的区域（axe 严重）→ 命名区域 + 可聚焦；键盘聚焦暂停滚动（WCAG 2.2.2）；页面打开后再开启"减少动态效果"时，地球会因滚动 / 拖拽重新转起来、悬停粒子仍会出现 → 已修；h1 末尾的 `_` 光标、"▲ back to spawn"、"say hi ↓" 的符号不再被读出；11 个新标签页链接补上"(opens in a new tab)"
- 布局：GPA 徽章在 1100–1440 被裁切；教育行 "(expected)" 在 1024–1279 压在学校名上 → 日期保持一行、"(expected)" 换到下一行；About 卡片缺席时（无兴趣图标 / 无航空数据 / 无进行中项目）网格留空洞 → 按实际卡片生成网格；技能 basic 组在窄屏不换行
- 内容管线：now.md 原样把 Markdown（`[链接](…)`、`**粗体**`、标题）送进滚动条 → 新解析器只保留文字（有单测）；now.md 注释写的是"驱动 Hero 终端"，实际只进滚动条 → 已更正
- 动效与性能：`src/motion/params.ts` 现在真正驱动 CSS（以 `--m-*` 自定义属性注入），删掉未用 / 已漂移的参数；离屏的循环动画（光标、轨道、滚动条）暂停，页面静止时不再每秒画 60 帧；开场动画结束后不再残留 22 个合成层，也不会让打字行停在最后一步

### 第三轮复核修复
- now.md → 滚动条：改为读取 Astro 渲染后的 HTML（与全站相同的 CommonMark + GFM），不再自己解析 Markdown。自动链接 `<https://…>`（之前整段被删）、引用式链接及其定义行（之前定义行漏进滚动条）、网址里的括号、任务清单、代码里的 `**`、`&amp;` 等实体、脚注都正确变成纯文字；单测用真实构建渲染出的 HTML
- copy.yaml 占位符：`{from}`/`{to}` 只在 `hero.avgeek_route` 有效，别处会让构建失败；`{first-name}` 这类写错同样失败，`{ city }` 可用；报错指出是哪个键
- 剩下写死在代码里的界面词移入 copy.yaml：项目状态词、"Present"、"GPA"（见 B）
- 动效参数：Hero 最后一行光标的打字时长改用同一公式，按钮 hover（120 ms / 3 步）与照片切换（200 ms / 4 步）进入 `params.ts`；新单测保证 CSS 读的每个 `--m-*` 都由 `params.ts` 提供、提供的每个都被用到
- "减少动态效果"开了又关：离屏的地球不再继续转；开着时滚动条变为可手动滚动（之前停在第一条、无法滚动）
- 地球拖拽：之前拖几像素就被浏览器自带的图片拖拽打断、又开始自转；现在全程跟手，舞台缩小时（1100–1279）也按实际大小换算
- 读屏：h1 只隐藏高亮的光标 `_`，标题里写 "&"、"+" 等符号会照常读出；"✈️" 这类带变体符的 emoji 也被识别为装饰；"C++"、"cd ~" 里的 ASCII 符号不再被当作装饰
- GPA 徽章：672–1023 也伸出舞台，平板竖屏不再盖住金块（见 D）
- CI 的 Lighthouse 门槛：阈值不变（四项 ≥ 0.95），改为跑 5 次、取每项的中位数。原来的 `median-run` 会整套采用"FCP/TTI 最接近中位数"的那一次，CI 上常常选中冷启动的第一次（同一提交两次被判 0.83 / 0.88，其余各次都是 1.00），门槛因此随机变红
- 测试：布局检查加 320 px，带 title 的省略号截断（终端标题栏）算正常；About 网格四种卡片组合有单测，各宽度下网格模板有效；技能换行、减少动态效果开关、手机上的离屏暂停都有 E2E；按 copy.yaml 文案找元素时改为精确匹配（"Stats" 这类改动不会误伤）；now.md 的 E2E 只查接线，解析规则由单测负责

### 第四轮复核修复
- now.md → 滚动条：改为逐个标签读取渲染结果（之前用多轮正则），图片说明里的 `<`（Astro 不转义）不再吞掉文字和后面的条目；本地图片也显示其说明文字；内容是标题的条目不再消失；原始 HTML 里的 `&mdash;` 等实体按完整 HTML 表解码（新增依赖 `entities`，此前已在锁文件中）
- now.md 的 E2E 只在"以文字开头的条目"存在时要求滚动条有 [NOW]，只写标题、空条目或链接定义不会让 CI（和部署）变红
- copy.yaml 标签：derive.ts 不再自带英文默认值（"GPA"、状态词、"now"、"(expected)"、"Present"……），漏传就是类型错误，不会悄悄显示内置英文
- About：选卡逻辑（哪些卡出现、哪些兴趣列在 whoami 卡上、网格）移入 `derive.aboutCards` 并有单测；E2E 核对页面网格与内容一致
- h1：高亮部分只有符号时（`[_]` 光标）才对读屏隐藏；`[data & design]` 里的 "&" 照常读出
- 地球：拖拽途中开启"减少动态效果"，地球不会再自己转起来；新增拖拽 E2E（1440 与舞台缩小的 1100），撤掉修复后该测试会失败
- CLS：之前约 0.03——Hero 终端的 VT323 字体没有预加载，换字体时几行文字从三行缩成两行，舞台和按钮跟着移动；现在预加载，本地测得 CLS 0、LCP 不变
- 符号拆分改为线性时间；`{from}` 测试能抓到"到处保留 {from}"的退化

## M1 验收（PLAN §8）
| 验收项 | 结果 |
|---|---|
| 与 Figma `Home — Voxel / 1440` 一致（±4 px） | ✅ 固定几何在 ±2 px 内；高度随真实内容增加（见 D） |
| MCButton / Tooltip / TerminalWindow / PixelBlock 组件 | ✅ `src/components/ui/` |
| 2.5D 像素地球（无 WebGL） | ✅ CSS 条带法 |
| hover 粒子、打字机、reduced-motion 全覆盖 | ✅ |
| 响应式 390 / 768 / 1024 / 1440 | ✅ |
| 移动端 LCP ≤ 2.5 s、axe 0 严重、键盘可达 | ✅（LCP ≈ 0.76 s；axe 覆盖动效 / reduced-motion / 无 JS；照片与滚动条可用键盘操作） |
| 业主人工验收 | ⏳ 早上 |

## 与计划的偏离
记入 PLAN §13：ADR-009 至 ADR-014。实现细节：分支名沿用会话指定的 `claude/affectionate-dirac-6zpbqu`；合并一律以业主账号 squash（业主要求）。

## 下一步（三条）
1. 你审核 M1（A–E），合并；决定是否 `launched: true`。
2. 把确认后的偏差与文案回写 Figma（或告诉我，我来改）。
3. M2：Three.js 体素场景与相机停靠（PLAN §8）。

## 移动端 WebGL 重启触发器（DECISIONS §16）
未触发（场景版尚未上线）。
