# STATUS（会话交接 · PLAN §15.6）

## M2 进度（每次推送后更新；新会话从这里接着做）
- ✅ 图形等级与能力检测（`src/scene/tier.ts`、`src/scripts/tier.ts`、`?tier=0..3`、`?tier=auto`）、按需加载的 WebGL 场景（站点 1–3：英雄区地球、关于区浮岛、AvGeek 轨道高度）、主题取色、看门狗、`?debug=1` HUD、文字后的遮罩、单测与 E2E（本提交）
- ⏳ 待做：Lighthouse（上线配置 + 强制 tier 3 的桌面测量）、WebKit 相对测量、五个主题 × 1440 / 1024 × 各站点的截图检查（2 倍像素）、PLAN §13 ADR-018、本文件的「M2 Scene 交付说明」
- 像素对比（`/v2/` 与 `/v2/?tier=1`，Night，1440 / 1024 / 390，对照 `6691017`）：逐像素相同（页脚版本号遮住）
- 下一步：看本提交的 CI；然后上面「待做」

## X2 进度（每次推送后更新；新会话从这里接着做）
- ✅ 三种语言的页面、内容模型、草稿与预览状态、简体草稿、`pnpm content:hant`、`pnpm content:stale`、语言行、首次访问建议、预览提示（`0450191`）
- ✅ CJK 像素字体（Fusion Pixel 子集化 + 改名）与中文字体 token（`1b2e533`）
- ✅ E2E 语言矩阵与 `i18n.spec.ts`（`53ea516`）
- ✅ Lighthouse 三种语言；中文页面的 LCP / 排版修正（`b46cc93`）
- ✅ 本总结、ADR-017、`content/README.md`「翻译」、简历按钮标「英文」、繁体版自称修正（`0d4065d`）
- ✅ CI 上才出现的三处（本提交）：中文 git log 的日期栏在 320 px + 130 % 时只剩 14 px、放不下一个汉字 → 中文页面的日期栏至少留一个字宽、哈希可以换行；WebKit 里中文终端标签行在文字间距覆盖下多出 2 px → 中文页面标签之间的空格可以折行；「字体晚到」的 CLS 测试改为只推迟 CJK 字体（推迟全部字体时 CI 上的**英文**页面 CLS 是 0.46，见「没做」10）
- ✅ CI 里 WebKit 唯一失败的测试（`prefs.spec.ts`「一个存储值」，从「五套主题」那次提交起就红，X1、X2 都带着它交付）——**原因和修法见下面「WebKit 单色主题变慢」**
- 下一步：业主审 X2（下面「请你审阅」「请你决定」），然后 M2

## 🔧 WebKit 单色主题变慢（2026-11-10，X2 之后）
- **现象**：CI 的 WebKit 里 `prefs.spec.ts:106` 超过 30 秒。它不是卡在某一步，而是整条测试变慢：选了 Mono dark 之后页面每次重绘都很慢。同一次 CI 里，同一个主题测试 Night 5.3 秒、Mono light 11.2 秒、Mono dark 25.6 秒。
- **原因**：单色主题给页面背景的 6 张整页 SVG（网格、三层星星、两团光晕）各加了一个 CSS 滤镜（`grayscale(1) contrast(1.15)`）。背景在所有东西后面，前面任何地方重绘，WebKit 都要把这些滤镜重算一遍。Chromium 里几乎没有代价，所以本地一直是绿的。
- **修法**：这 6 张图每张只有一种颜色，滤镜的结果事先就能算出来。`pnpm art:mono` 生成颜色已换好的灰度副本（`src/assets/voxel/bg/mono/`，已提交；`src/lib/mono-art.ts`），单色主题直接显示副本，背景不再有滤镜。副本只在单色主题第一次显示时才下载，Night / Day / 色盲主题不会去取。改了彩色原图后要重新运行 `pnpm art:mono`，否则单元测试失败。
- **验证**：Night 与 Day 在 1440 / 1024 / 390 逐像素不变；Mono dark / Mono light 与改动前最多差 2 / 255（滤镜的取整）。在本机装的 WebKitGTK 2.52 里量重绘：英雄区一次更新 Mono dark 116 ms → 67 ms（Night 60 ms）；整屏重绘 Mono dark 约 495 ms → 317 ms（Night 251 ms）。
- **没做，留给 M2 判断**：① 单色主题剩下的约 25 % 差距来自地球陆地、英雄区图片和方块上的滤镜（每个都不大）。② 同一次测量里，**Night 去掉所有 `drop-shadow` 滤镜后整屏重绘从 251 ms 降到约 125 ms**——方块的像素投影在 WebKit 里占了一半绘制时间。M2 的 WebGL 场景会接管桌面端的英雄区，静态回退（手机、无 WebGL）可以考虑把投影烘焙进图片。
- 本机的 WebKit 是系统包 `webkit2gtk-driver`（不是 Playwright 的 WebKit，引擎相同），只用来量相对快慢；CI 仍是 WebKit 的唯一正式检查。

## 🌐 X2 Languages 交付说明（PLAN-EXPERIENCE §5，§9 的 X2 行；PLAN §13 ADR-017）

### 已交付
| 部分 | 内容 |
|---|---|
| 路由 §5.2 | `/`（英文）、`/zh-hans/`（`lang="zh-Hans"`）、`/zh-hant/`（`lang="zh-Hant-HK"`），全部静态生成，预览期都在 `/v2/` 下；Astro i18n、`prefixDefaultLocale: false`；没有 `/zh/`（404）。每页有自己的 canonical、`og:locale`（en_US / zh_CN / zh_HK）；hreflang = 所有 live 语言 + `x-default`（只有一种 live 语言时不输出） |
| 草稿怎样不上线（计划没定，ADR-017 ②） | `content/site.yaml → locales`：英文 `live`，两种中文 `preview`。preview 照常发布到它的网址供你阅读，但 `noindex`、不进 hreflang、不出现在 live 页面的语言切换里，每页顶上有翻译过的「草稿译文，尚未经过审阅」。任何译文字段或文件都可以 `draft: true`；**live 语言里有任何 draft，`pnpm content:check` 和构建都会失败**（两边都实测过：把 zh-hans 改成 live 后，内容检查逐条列出草稿，构建报「48 处草稿」并停止） |
| 内容模型 §5.3 | `copy.zh-hans.yaml` / `copy.zh-hant.yaml`：与 `copy.yaml` 同样的键（少一个、多一个都构建失败）；有语言的事实在英文字段旁加 `zh-hans:` / `zh-hant:` 块；`about.zh-hans.md` 与 `projects/<id>.zh-hans.md` 这类翻译文件；没有语言的事实只有一份。每个译文字段记 `from`（来源文字的哈希）。Zod 对象全部保持 strict |
| 回退 | 没译的事实显示英文并标 `lang="en"`（读屏用英文读）；没有翻译文件的 Markdown 整块标 `lang="en"` |
| 简体草稿 | Claude 按你的英文逐句翻译：界面文字全部、about、Clock Stamp 与 X Community Notes 两个项目、职位 / 要点 / 地点、教育、荣誉、兴趣、技能组名与「语言」「工具」两组、网站描述与页脚说明。书面语；公司、学校、实验室、产品名保持英文；**没加任何事实**。Classmate Map 没译（英文句子本身待你重写）。全部 `draft: true` |
| 繁体（香港）§5.4 | `pnpm content:hant`：OpenCC `s2hk`（opencc-js，只是 dev 依赖，不进浏览器）把每个「简体有、繁体没有」的字段转成香港字形，写成 `draft: true` 并记来源哈希；**从不覆盖已有的繁体字段**；只在 YAML 能逐字节往返时才写，不重排你的格式；列出一对多要人看的字。已运行、结果已提交。代表语言自身的 `i18n.name / suggest / suggest_go` 不转换（转换后繁体版自称「簡體中文」——已手改为「繁體中文」，内容检查现在会拦下两种语言同名） |
| 过期报告 §5.4 | `pnpm content:stale`：英文改了，两种中文都列出（繁体写「经由简体」）；简体改了，繁体列出；CI 里每次推送都跑，从不失败；`--accept <locale>` 记录当前来源 |
| 字体 §5.5 | 像素 CJK：**Fusion Pixel 12px proportional**（SIL OFL 1.1，从 npm 的 Fontsource 包取得，版本 2024.05.12）——简体用 `zh_hans` 切分，繁体用 `zh_hant`（**这个版本没有香港切分**）。构建后按各语言页面上真正出现的字子集化：简体 472 字 21.6 KB，繁体 477 字 23.2 KB（预算各 160 KB）；因 OFL 保留字体名，子集改名为 zhic Pixel SC / TC；只在本语言页面声明、只覆盖 CJK 码位，**英文页面不加载**。许可证：`src/assets/fonts/fusion-pixel/`（LICENSE.txt 原样 + README 说明改动），构建时也放在字体旁边。正文用系统 CJK 无衬线（PingFang SC / HK、Noto Sans SC / CJK、微软雅黑 / 正黑、文泉驿），以页面内只覆盖 CJK 的 `local()` 别名声明 |
| 中文字体 token | `:root:lang(zh)`：像素字号取 12 px 倍数（84 / 48 / 24 / 12），8 与 10 px 的标签升到 12 px；无字距、无大写、行距更松；标题在各宽度保持一行的中文字号 |
| 设置窗口 | 语言一行（在动效与字号之间，按 §2.1 的顺序）：普通链接，各用自己的语言与 `lang`，不需要脚本；live 页面只列 live 语言，preview 页面列全部（预览语言后标「草稿」）；点了会停在同一区块并记住选择 |
| 首次访问建议 §5.2 | 底部一行横幅（固定定位，不移动版面），用被建议语言自己的文字；按计划的映射（并把 `en*` 映射到英文）；只建议 live 语言；从不跳转；关闭或选择都会记住 |
| 原写在代码里的界面词 | 月份、平台名、列表分隔符、whoami 句式、/summon 回答移入 copy；英文输出不变 |
| 预算与 CI | 每种语言的首屏 JS、两个 CJK 字体各 ≤ 160 KB 进入 `pnpm size`；Lighthouse 跑三种语言；CI 加「翻译过期报告」 |

### 验证（2026-11-10，本容器）
- `pnpm verify` 全绿：单测 258 通过 / 1 跳过（14 个文件）；E2E 360 通过 / 94 跳过（Chromium 桌面 + Pixel 7；内容、布局（10 个宽度、文字间距、130 %）、axe 与无 JS 三种语言都在 Night 下跑，主题与动效级别仍只跑英文，按 §9.1 修剪）。**WebKit 只在 CI 跑，本地没有跑过新的语言测试**
- 体积：CSS 17.1 KB gz（预算 45）；首屏 JS 三种语言各 6.3 KB gz（内联 940 B + 主脚本 5546 B；预算 180）；CJK 字体 简 21.6 KB、繁 23.2 KB（各 160），英文页面 0
- Lighthouse（上线配置 `SITE_STAGE=launched`，每页 5 次中位数）：英文 性能 1.00 / 无障碍 1.00 / 最佳实践 1.00 / SEO 1.00；简体 0.99 / 1.00 / 1.00 / 0.66；繁体 0.99 / 1.00 / 1.00 / 0.66（SEO 0.66 是 preview 的 `noindex`，故意的，对 preview 语言不判 SEO）；LCP 三页都是 0.91 s，CLS 都是 0，TBT 78 / 114 / 112 ms。第一次测时简体只有 0.93（LCP 2.2 s）——原因与修正见 `b46cc93`
- **英文像素对比**（`/v2/`，1440 / 1024 / 390，`reducedMotion: 'reduce'`，时钟固定 2026-10-24T16:45Z，等 `document.fonts.ready`；对照是工作树里重新构建的 `9cd2ecf`）：三种宽度页面高度不变；遮住页脚版本号那一行后**差异 0 像素**；不遮时只有版本号末尾的内容提交哈希不同（399 / 402 / 402 像素，在 54 × 11 px 的方框里）。设置窗口（截图里是关着的）多了语言一行
- 中文页面：两种中文页面上没有对方字形的字（按每个元素自己的 `lang` 检查，OpenCC 字表）；每个英文回退都在 `lang="en"` 里；CLS ≤ 0.05（字体晚到 1 秒也是）

### 没做 / 只做了一部分（原因）
1. **三种语言都 live 时的 hreflang 只在单元测试里验证**：现在只有英文 live，页面按规则不输出 hreflang；E2E 验证的是「页面输出 = 规则函数的结果」以及 preview 永不出现在 hreflang 里。等某种中文 live 时，同一组测试自动覆盖真实输出
2. **繁体没有人审**：那是你的事（见下）。我只修了一处语义错误（繁体版自称「簡體中文」）；转换器选错的字照原样留着，列在下面
3. **没有香港切分的像素字**：Fusion Pixel 2024.05.12 只有 `zh_hant`。它的字形接近台湾标准，个别字与香港写法不同；正文的系统字体按香港优先
4. Classmate Map 没翻译（见上）；`aviation.yaml` 现在没有内容，结构支持翻译但没有可译的东西
5. **没有 JavaScript 时找不到语言切换**：设置窗口要 JS 才能打开（X1 如此）。现在只有英文 live，影响为零；见「请你决定」6
6. `astro dev` 用的是完整字体（不子集化）；只有构建产物子集化
7. 系统 CJK 字体的 `local()` 名称只在 Linux（文泉驿）上实测过；macOS / Windows / Android 的名称按字体的官方名写，没有设备实测（不匹配时浏览器按 `lang` 自己选中文字体，不会坏）
8. `docs/CONTENT-GUIDE.md`（M4）还不存在；翻译说明先写进 `content/README.md`「翻译」一节
10. **CI 上有、本地没有的问题（不是 X2 引起的，没修）**：① 推迟全部网页字体 1 秒时，CI 机器上**英文**页面的 CLS 是 0.46（本容器里约 0.01）——CI 的 Ubuntu 没有 X1 用作替身的 Liberation / Arimo / Roboto，标题在替身字体下换行不同；正常加载时 CLS 是 0。② WebKit 里 `prefs.spec.ts`「一个存储值；刷新后选择还在」超时（`9cd2ecf` 上就失败，X1 遗留）——**已修，见上面「WebKit 单色主题变慢」**。①仍值得在 M2 前单独看
9. A11Y-CHECK 新增第 9 步「语言」，只在无头 Chromium 里看过截图（12 px 中文清楚），没有真读屏、真手机

### 与计划的偏离
- 预览状态（`live` / `preview`）是计划没有的机制（ADR-017 ②，按指示加的）
- hreflang 只在至少两种语言 live 时输出（一种语言没有可替代的页面）
- 字体子集改名为 zhic Pixel SC / TC（OFL 保留了 "Fusion Pixel" 这个名字）
- 系统 CJK 字体不直接写进字体栈，而是页面内只覆盖 CJK 的 `local()` 别名：直接写会让 CJK 字体把 → ★ · 画成全角（没有 Arial / Courier New 的 Linux、Android 上 git log 的箭头溢出——布局测试抓到的），而且一个都没装时浏览器逐字搜索系统字体，排版慢一倍
- 中文页面 8 / 10 px 的标签升到 12 px：8 px 的中文读不了，像素字最小 12 px；同一标签里的拉丁字也一起变大
- 首次访问建议也会建议英文（计划的映射只列了中文）；它在浏览器空闲时才出现（立刻出现时 Lighthouse 量到 LCP 晚 0.5 s）
- 预览提示放在 `.page` 里面而不是上面（放在上面会把背景网格推下去，Chrome 就把网格当成 LCP，模拟 LCP 2.2 s）
- 每种语言自己的名字放进各自 copy 文件的 `i18n.name`（X1 写在 `src/i18n/locales.ts`）
- 中文页面上，终端命令、ping 输出、Clock Stamp 手机画面保持英文（代码与 App 本身的样子）
- 中文页面的简历按钮写明「英文」（§5.3：只有英文 PDF）
- Lighthouse 的 CLS 门槛从 0.1 收紧到 0.05（§1.3 的预算）

### 改过的测试
- `prefs.spec.ts` 键盘测试：Tab 从动效组经过语言链接再到字号组（新的一行，按 §2.1 的顺序）
- `content.spec.ts`：列项目时排除翻译文件；全部改为三种语言各跑一遍，期望值按该语言计算（`tests/e2e/locale.ts`）；平台词与列表分隔符从 copy 取
- `robustness.spec.ts`「字号 130 %」：100 % 的基准改在新的浏览器上下文里测。原来在同一页去掉 `--text-scale` 再量，会与偏好脚本竞争；测试数量变成三倍后约 1/30 失败（en 390、zh-hans 768、en 1024 各一次）。断言没变
- `quality.spec.ts`、`a11y.spec.ts` 的语言测试：改为三种语言各跑
- 单元测试：`format` / `derive` / `projects-view` 的函数现在从 copy 接收月份、平台词、whoami 句式（不再有内置英文）
- 新增：`tests/unit/i18n.test.ts`、`i18n-scripts.test.ts`、`cjk-font.test.ts`，`tests/e2e/i18n.spec.ts`。没有放宽或跳过任何已有断言

### 需要回写 Figma（我没有改 Figma）
1. 中文页面：简体与繁体各一组 1440 / 390 画框；中文字号表（像素 84 / 48 / 24 / 12、行距 1.15–1.35）
2. 设置窗口的语言一行（当前语言的选中态、预览语言后的「草稿」）
3. 预览提示条（深色底、金色下边框、「!」方块）
4. 首次访问建议横幅（底部固定、钻石色边框）
5. 中文页面的简历按钮文字变长（「简历（英文）」）

### 请你审阅（这些都是草稿）
**在哪里读**：合并到 main 后是 https://zhic.me/v2/zh-hans/ 与 https://zhic.me/v2/zh-hant/（搜索引擎不收录）；或在本地 `pnpm build && pnpm assemble && pnpm serve:site` 后打开 `/v2/zh-hans/`。

**简体（Claude 从你的英文翻译）**：`content/copy.zh-hans.yaml`（全部界面文字）、`content/about.zh-hans.md`、`content/projects/clock-stamp.zh-hans.md`、`content/projects/x-community-notes.zh-hans.md`，以及 `site.yaml`、`profile.yaml`、`education.yaml`、`experience.yaml`、`honors.yaml`、`interests.yaml`、`skills.yaml` 里的 `zh-hans:` 块。
**繁体（脚本从简体转换，只转字形）**：同名的 `copy.zh-hant.yaml`、`*.zh-hant.md` 与各文件里的 `zh-hant:` 块。脚本标出的一对多字里，我看到确定要改的一处：`experience.yaml` Merit 第一条「**併**為撰寫技術交底書」应为「**並**為」。其余标出的（發佈、標誌、製圖、每兩週、恢復、稜鏡、時鐘、標籤…）看来没错，但请过目。香港用词建议：設置→**設定**、默認→**預設**、鏈接→**連結**、聯繫→**聯絡**、加載→**載入**、源代碼→**原始碼**、反饋→**回饋**、信息學→**資訊學**？

**上线一种语言的确切步骤**（以简体为例）：
1. 读并修改上面的简体文件（直接在 GitHub 网页上改即可）
2. 删掉每一个 `draft: true`（`content/copy.zh-hans.yaml` 第 8 行；每个 `zh-hans:` 块里的那一行；三个 `.zh-hans.md` 的 frontmatter 里那一行）。不确定还剩哪些：先把第 3 步做了再跑 `pnpm content:check`，它会逐条列出
3. `content/site.yaml` 里把 `zh-hans: preview` 改成 `zh-hans: live`
4. 提交；CI 绿了就上线。之后英文改动时 `pnpm content:stale` 会提醒哪些译文要跟着改；改完运行 `pnpm content:stale --accept zh-hans`（或按报告里给的值改 `from`）
繁体同理，把 `zh-hans` 换成 `zh-hant`（繁体的 `draft` 在 `copy.zh-hant.yaml` 第 5 行、各 `zh-hant:` 块、`.zh-hant.md`）

### 请你决定（都有默认值，已按默认实现）
1. Q-L2：学校与公司是否用官方中文名（华盛顿大学 / 華盛頓大學）？默认保持英文
2. Q-L4：香港版用书面语还是口语粤文？默认书面语
3. 地名译成中文（「华盛顿州西雅图」「中国杭州」）可以吗？还是保持英文？
4. Classmate Map：英文句子重写后我再译（或删掉这个项目）
5. 中文页面上的 Clock Stamp 手机保持 App 的英文界面，可以吗？
6. 没有 JavaScript 时的语言切换：要不要在页脚加一行语言链接（只在有别的 live 语言时出现；现在不会出现）？
7. 中文页面的小标签升到 12 px（徽章、chip 里的拉丁字也变大）可以吗？
8. 滚动条标签在中文页面：XP、PING 保持英文，NOW→当前、WORK→工作，可以吗？
9. 「Dean's List」：简体「院长名单」；繁体用「院長名單」还是香港常见的「院長嘉許名單」？
10. 繁体里「信息學」要不要改成香港常用的「資訊學」？
11. 第一次访问时若浏览器是英文、页面是中文，会建议英文——可以吗？

## X1 进度（每次推送后更新；新会话从这里接着做）
- ✅ token 三层 + 颜色 lint（`6add29a`、`132a76f`）
- ✅ WIP（`ccb78e1`）恢复为可构建（`3d79d54`）
- ✅ 设置窗口与入口、暂停键、快捷键（`3a7cadc`）
- ✅ 五套主题、暗色物件、冗余符号、主题里的美术、对比度单测（`b5cc67f`）
- ✅ 动效级别、全部暂停、地球键盘操作（`faefe28`）
- ✅ 无障碍合同可自动化的行、打印、`docs/A11Y-CHECK.md`（`d5fcbea`）
- ✅ Night 像素对比、Lighthouse、本总结与 ADR-015/016（本提交）
- 下一步：业主审 X1（下面「请你决定」），然后 X2 语言

## 🧱 X1 Foundations 交付说明（PLAN-EXPERIENCE §2、§3、§4，§9 的 X1 行）

### 已交付
| 部分 | 内容 |
|---|---|
| 偏好设置 §2 | 一个 `localStorage` 值 `zhic:prefs:v1`：`theme`（night / day / mono-dark / mono-light / cvd / auto）、`motion`（auto / full / calm / off）、`text`（100 / 115 / 130）、`lang`（auto / en / zh-hans / zh-hant，X1 只存不显示，X2 加那一行）、`keys`（单键快捷键开关）。`<head>` 内联脚本（940 B gz，`src/prefs/boot.ts`，与运行时共用 `normalizePrefs` / `resolvePrefs`）在首帧前设置 `data-theme`、`data-motion`、`--text-scale`、`theme-color`、`color-scheme`：无闪烁，CLS 0。没有 JavaScript 时页面就是 Night、静态、和以前一样（入口按钮隐藏）。语言列表只有一个：`src/i18n/locales.ts`（`zh-Hant-HK` 带地区子标签，`LANG_TAG` 校验） |
| 设置窗口 | `~/.config — prefs`：终端外观下是真正的表单（四组单选，`legend` 是朴素名称，`$ theme --set` 只是皮肤、对读屏隐藏），选了立即生效并保存；`reset` 清除保存值。入口：导航齿轮键、页脚 `prefs`、`,` 键；`Esc` 关闭，焦点回到打开它的地方。代码按需加载（820 B gz，不算首屏）。所有文字在 `content/copy.yaml → prefs` |
| 主题 §3 | Night（默认，像素不变）、Day（纸色底、白卡片，**终端 / git log / 手机 / 徽章 / chip / 设置窗口保持深色**）、Mono dark、Mono light、色盲友好（Okabe–Ito）。auto 跟随系统明暗且不刷新页面；系统「更高对比度」、「减少透明度」、Windows 高对比度（forced-colors）在任何主题下自动生效；打印永远是 Mono light |
| 颜色不是唯一信号 §3.3 | ticker 标签与 chip 前的字形 ◆ ▶ ■ ● ▲（`src/lib/cues.ts`，`::before`，不改文字与读屏内容）、提交节点方 / 菱形 / 环、Mono 下手机表针实线 / 虚线 / 点线 / 点划线。在 Night 之外的所有主题、以及 Night + 更高对比度 / forced-colors 时显示 |
| 主题里的美术 §3.4 | Mono：图片（方块、头像与照片、轨道环、logo、封面、星空）灰度；地球白陆黑海（Mono light 反过来）。浅色主题：无星空，网格 40 %。地球、手机、首屏舞台是固定尺寸的画（`data-type-fixed`，字号设置不放大它们） |
| 动效 §4.1 | full / calm（无开场、无悬停粒子、循环慢 3 倍）/ off（全静止，滚动条手动横滚）；系统「减少动态效果」永远优先（窗口里有说明）；页面打开时切换立即生效、开场不重放。**全部暂停**：导航 ⏸（按下变 ▶ 与金色边）或 `p`：所有 CSS 循环、地球自转、Clock Stamp 手机的实时时钟都停住，恢复时时钟跳到当前时间（WCAG 2.2.2） |
| 无障碍合同 §4.1 | 目标尺寸 ≥ 24 px（2.5.8，含间距 / 行内例外）；触屏上每个 MC 按钮 ≥ 44 × 44 的点击区（标签上透明 `::after`，只在 `pointer: coarse`，外观不变）；文字间距覆盖（1.4.12）与字号 130 % 在各宽度不截断；`lang`；悬停内容（玩家卡照片可悬停、`Esc` 关闭，1.4.13）；地球是带名字的滑块：方向键 15°、PgUp/PgDn 90°、Home 归零（2.5.7）；Tab 遍历顺序、焦点环、不困住；forced-colors 下每个控件有可见边界；打印 §4.5 |
| 文档 | `docs/A11Y-CHECK.md`（十分钟人工检查脚本 + CI 已覆盖的清单）；PLAN §13 ADR-015、ADR-016 |

### 验证（2026-11-10，本容器）
- `pnpm verify` 全绿：单测 211 通过 / 1 跳过（11 个文件；对比度测试按 主题 × 3 种对比模式 × 页面 / 暗色物件 分 30 组，覆盖 > 800 对文字 × 表面），E2E 172 通过 / 42 跳过（Chromium 桌面 + Pixel 7 移动；按 §9.1 修剪：每个主题只在桌面 full 动效跑一次，动效级别只在 Night 跑；WebKit 只在 CI 跑，本地未跑）
- 体积：CSS 16.5 KB gz（预算 45）；首屏 JS 5.9 KB gz（内联 940 B + 主脚本 5137 B；预算 180）；设置窗口 820 B 按需
- Lighthouse（上线配置 `SITE_STAGE=launched`，5 次中位数）：性能 0.99（4 次 0.99、1 次 1.00）/ 无障碍 1.00 / 最佳实践 1.00 / SEO 1.00，LCP 0.91 s，CLS 0，TBT 中位 114 ms。同一容器上 `132a76f`：性能 1.00、LCP 0.91 s、TBT 中位 66 ms——TBT 多了约 50 ms（主脚本变大、样式更多），仍远在门槛内
- **Night 像素对比**（`/v2/`，1440 / 1024 / 390，`reducedMotion: 'reduce'`，时钟固定在 2026-10-24T16:45Z，等 `document.fonts.ready`，与 `132a76f` 的构建比；页脚版本号里的提交哈希两边都遮住，宽度相同）：页面高度三种宽度都不变；**只有设置入口处的像素不同**——
  - 1440：导航行（第 21–56 行）：四个区块链接左移 48 px、「online · Seattle」左移 96 px，为 x 1016–1095 的齿轮键与 ⏸ 键让位；RESUME / SAY HI 不动。页脚第 6487–6499 行 x 1205–1241：新的 `prefs` 按钮
  - 1024：导航行（第 23–50 行）：链接左移 36 px，两个 28 px 键在 x 656–715；按钮不动。页脚第 7091–7103 行 x 789–825：`prefs`
  - 390：导航第一行（第 21–48 行）x 206–265：两个键；页脚第 10938–10950 行：`prefs` 在 x 16–55，「▲ back to spawn」因此右移 55 px
  - 其余所有像素逐一相同

### 没做 / 只做了一部分（原因）
1. **截图基线按主题进 CI（§3.5、§9.1）没做**：整页 PNG 在本容器与 GitHub 运行器上字体光栅化不同，提交的基线会不稳定，且每次更新约 10 MB；Night 的像素对比是用脚本做的（方法见上）。建议：在 CI 运行器上生成并更新基线的工作流，单独做
2. **Lighthouse 跑 Day（§3.5）没做**：lhci 不能在测量前写 localStorage（要加 puppeteer 脚本）。Day 的对比度与 axe 已在单测 / E2E 里覆盖
3. **减少数据（`prefers-reduced-data` / `Save-Data`）这一行没做**：它要跳过的主要是 M2 的 WebGL 场景；跳过网页字体会改变 Night 的排版。挪到 M2
4. **打印不是两页**：A4 打出来 7 页（已缩小字号、收紧区块、去掉装饰与站内跳转按钮，链接附网址，卡片不被截断）。真正的两页摘要需要单独设计的打印版式——见下「请你决定」4
5. **人工检查（A11Y-CHECK）只跑了能模拟的部分**（第 1 次，2026-11-10，无头 Chromium）：1 键盘巡游（由测试覆盖）✅、3 缩放与字号（320–1920 宽度、文字间距、130 %）✅、4 对比模式（模拟 forced-colors 截图、更高对比度、减少透明度）✅、5 动效 ✅、6 主题一瞥（五个主题 1440 截图）✅、8 打印 ✅；**没跑**：2 VoiceOver / NVDA、4.1 真的 Windows 高对比度截图、6 里的色觉模拟、7 真手机读屏——本环境没有这些工具，需要你或在有设备时跑
6. 闪烁（2.3.1）没有逐帧计数：目前的开场没有闪烁；「名字闪现」属于 M2 场景，届时检查
7. WebGL 场景读主题对象（§3.4）属于 M2；CRT 滤镜目前不存在，无需处理

### 与计划的偏离
- 暂停键是 `p`，不是计划写的空格：页面上按空格是浏览器自己的「向下翻页」，占用它会破坏键盘滚动（ADR-015）
- 系统「减少动态效果」打开时，无论在设置里选了什么都是 off（只能更少，不能更多）
- Night 不显示冗余字形（它是原设计，标签本身有文字）；其他主题、更高对比度、forced-colors 都显示
- 触屏 44 px 用的是不可见的点击区，不是把按钮画大（为了 Night 像素不变）
- 导航键在 1280 px 以下是 28 px（1024 px 要一行放下 logo、链接、两个键和两个按钮）；385 px 以下两个键和 SAY HI 一起换到 logo 下面（X4 的 hotbar 会替换手机导航）
- 字号设置不放大首屏舞台与手机（固定尺寸的画）
- 设置窗口按需加载（计划允许）

### 改过的测试
- `robustness.spec.ts`：动画探测函数挪到 `tests/e2e/animations.ts` 供两个 spec 共用（行为不变）；新增地球键盘、带字形的主题布局、文字间距、130 % 字号的用例。没有放宽或跳过任何已有测试
- 冗余字形最初放在 DOM 里，内容测试（`content.spec.ts` 读 textContent）因此失败；改为 `::before` 实现，测试未改

### 需要回写 Figma（我没有改 Figma）
1. Voxel 变量集合新增模式 Day / Mono dark / Mono light / CVD，取 `src/styles/tokens.css` 的值（含 §3.2 之外补的：卡槽、导航与条带的半透明色、各主题阴影、Mono 的 MC 按钮与终端红绿灯）
2. 设置窗口 `~/.config`：1440 与 390 两个画框，单选的选中 / 焦点 / 悬停状态，主题小色板
3. 导航的齿轮键与 ⏸ 键（36 px / 28 px，按下状态 ▶ + 金边）、页脚 `prefs`
4. 冗余符号：标签与 chip 的 ◆ ▶ ■ ● ▲、提交节点方 / 菱形 / 环、Mono 下手机表针线型
5. 主题里的美术：Mono 灰度、地球白陆 / 黑陆、浅色主题无星空与淡网格
6. 地球滑块的焦点环；（可选）打印版式

### 请你决定（都有默认值，已按默认实现）
1. Q-T1 / Q-T2：设置里用朴素名称、小字写游戏内名称（Overworld、Bedrock、Paper、Prism）；没选过主题的访客一律 Night，即使系统是浅色——可以吗？
2. 暂停用 `p` 而不是空格——可以吗？
3. 字号 130 % 时首屏舞台和手机保持原尺寸——可以吗？
4. 打印：现在 7 页 A4。要一个专门的两页打印版式（类似简历），还是打印就交给 `resume.pdf`？
5. 设置窗口的文案（`copy.yaml → prefs`）请过目，例如 "Changes apply at once and are saved in this browser only."
6. Day / Mono / CVD 的配色是计划里的提案，确认或在 Figma 里调整
7. 385 px 以下导航多一行（到 X4 hotbar 为止）——可以接受吗？

## 当前状态
| 里程碑 | 状态 |
|---|---|
| M0 骨架与内容迁移 | ✅ 已上线（PeterChen1216/Mysite#2，`ea935de`） |
| 内容更新：新简历 2026-11-03 | ✅ 已上线（PeterChen1216/Mysite#3，`e6f033c`；业主 R2-4 同意直接合并） |
| **M1 长页面版（Figma `Home — Voxel / 1440`）** | ✅ **业主 2026-11-09 接受并合并**（PeterChen1216/Mysite#4，squash 合并）；zhic.me/v2/ 更新为 M1；`launched` 仍为 false；Figma 未改 |
| **X1 基础（设置、主题、动效、无障碍）** | ✅ 完成，在分支 `claude/happy-einstein-dkkcxx` 上等业主审（见上） |
| **X2 语言（英文 + 简体 + 繁体〔香港〕）** | ✅ 完成，同一分支；两种中文是 preview（草稿，待你审） |
| M2 体素场景 / M3 窗口 | 未开始 |

线上：zhic.me/（旧站，不变）· zhic.me/v2/（M1 长页面版）· zhic.me/legacy/。

---

## 🔎 2026-11-10 全项目审计（分支 `claude/happy-einstein-dkkcxx`，未合并）

基线：格式 / lint / 类型 / 内容检查 / 单测 123 / 构建 / 体积 / E2E 73 全绿；改动后单测 130、E2E 79（Chromium + 移动 Chromium；WebKit 只在 CI 跑，本地未跑），Lighthouse（上线配置，5 次中位数）100 / 100 / 100 / 100，LCP ≈ 0.76 s，CLS 0，首屏 JS 2.7 KB gz。

### 已修（有把握的）
| 类别 | 内容 |
|---|---|
| **线上旧站（zhic.me/ 现在就在用）** | 每次访问 4 个 404：`css/custom.css`、`css/academicons.css`、`js/jquery-2.1.3.min.js`（文件从未存在）与 `main.css` 引用的背景图 → 已去掉；HTML 标签不配对（多余 `</div>`、未闭合 `<ul>`、页面容器未闭合）→ 已配平；"Information School" 的链接是空的 → 已包住文字；头像 2.9 MB → 99 KB（显示 135 px，还被当作 favicon）；删除模板前主人留下的注释块（跳转到别人主页的 meta、别人的论文新闻、未用脚本）；删除没有任何引用的 `bootstrap.css`、`css/style.css`、`stylesheet.css`、`font-awesome/`（共 780 KB）。除头像重采样与新链接外，渲染逐像素不变 |
| **Clock Stamp 手机样机** | 原样机是 "STAMP + 坐标 + 地球"，不是 App 的样子，而且坐标换行后被地球盖住。按业主截图重做为 App 的世界时钟界面（像素风）：城市名、时差、时间、日期、24 小时表盘（夜间点阵地图）+ 每城一根指针。**跑真实时间**（每分钟走针；无 JS 时显示构建用的固定时刻）。表盘标记按业主要求为 **FRA / SEA / SHA**；SEA 在本地时区，所以是带定位箭头的"这里"指针。城市在 `content/copy.yaml → projects.phone` 改；`projects/clock-stamp.md` 新增 `demo: world-clock`（以前任何 featured 的 iOS 项目都会显示这部手机） |
| 不一致 | 多处写死的同一颜色收进 `tokens.css`（AA 紫 `#b866f5` 4 处而 token 仍是 `#a335ee`、`#55ffff` 4 处、`#5000ff` 3 处、墨/纸/字影）；符号字体栈 4 处 → `--font-symbol`；`--gutter` 用 `--content-max`；hover 粒子颜色改为运行时读 token（为主题切换铺路）。**整页截图 1440 / 1024 / 390 逐像素相同** |
| 过期 / 多余 | `WhoamiCard` 的 cyan 颜色补丁（`Chip` 早已有 cyan）；`About` 里重复 `Card` 默认值的 padding / 阴影覆盖；`page-data.ts` 里一次什么都没改的数组复制；未使用的 `hashkey-pixel.svg`；几处过期注释（"M0 plain page"、"sync in M1"、"see integration notes"） |
| 脚本 | `check-js-budget.mjs` 把预览路径写死为 `v2/`，且引用的脚本文件不存在时静默跳过（会少算）→ 改为读 `site.config`，缺文件即失败 |
| 文案拼写（只改拼写 / 语法，不改意思） | `site.yaml`：an personal → a personal；页脚 "Expected to updated by each 2 weeks." → "Expected to be updated every 2 weeks."；`about.md`：Tech fans → tech fan、colaboration → collaboration；`profile.yaml`：UW 27' → UW ’27（原 E6） |

### 请你过目（没动，需要你决定）
1. **是否上线**（`launched: true`）。旧站仍显示过期事实：GPA 3.81、Junior、June 2027、"Time Stamp"、"about to release… April/May"、163 邮箱。上线是修这些最干净的办法。
2. `legacy/work/njzposts.pdf`（5 MB）公开可访问、没有任何页面链接它 → 删除？（原 E3）
3. 两个项目都是 `featured: true`（Clock Stamp、X Community Notes），但只有第一个用大卡片；`featured` 同时决定滚动条里出现哪些项目。是想要两个大卡，还是只留一个 featured？
4. Dean's List 在 About 相邻两张卡里各出现一次、写法不同（`education.yaml → honors` 与 `honors.yaml`）。留哪一处？
5. 导航的 RESUME 在新标签页打开，Hero / Contact 的是下载。统一成哪一种？
6. `projects/classmate-map.md` 的句子 "Created a map show the current schools/cities…" 语法不通，需要你重写；新简历没有这个项目，是否保留？（原 E1）
7. `interests.yaml`："flight routes, seats, crafts, mileage plans" 的 crafts 是否想写 aircraft？
8. HashKey logo 在 44 px 的格子里几乎看不清（深色方块里的小字标）。换成只有图形的版本，或放大格子？
9. `content/images/avatar.jpg` 源文件 2.9 MB（访客拿到的是 2–7 KB，不影响速度，只影响仓库体积）。要不要缩到 1200 px？
10. `tokens.css` 里有 18 个没被用到的 token（`--space-*` 的一部分、`--shadow-hard`、`--radius`、`--type-term-lg`、`--color-block-dirt/stone`、`--color-text-lo`）。它们对应 Figma 变量，我保留了；要不要清掉？
11. 远端分支 `claude/affectionate-dirac-6zpbqu`（与 main 完全相同）和 `claude/upbeat-jones`（已合并）可以删除。
12. **Figma 没改**：手机样机节点（22:1158）还是旧设计；下面 D 的偏差清单也还没回写。需要的话我来改 Figma。
13. 小的技术债（不影响访客）：`getCopy()` 每个按钮 / 新标签提示各算一次（一次构建约 25 次，页面多了再做缓存）；导航高亮按"可见比例"选区块，很高的区块在边界处可能输给矮的邻居（现有测试都过）；`content/README.md` 提到的 `docs/CONTENT-GUIDE.md` 要到 M4 才有。

### 新计划：`docs/PLAN-EXPERIENCE.md`
回应"更多动态图形 / WebGL 占比、主题（多语言、黑白、色盲、更多无障碍）、更多 hover、移动端要有计划"。七条工作线（设置与 token、主题、无障碍、语言、hover 目录、图形分级与 WebGL 占比、移动端），每条有边界、预算、验收；里程碑改为 **X1 基础 → X2 语言 → M2 场景 → X3 交互 → M3 窗口 → X4 移动 → M4 → M5**；末尾 10 个问题等你回答（都有默认值）。五套主题的配色已算过对比度，全部 ≥ AA。

---

## ☀️ 还需要你确认的（按优先级）

### A. M1：✅ 已接受并合并（2026-11-09）；还剩是否正式上线
- 是否 **正式上线**（`content/site.yaml` → `launched: true`，v2 替换旧首页，旧站移到 /legacy/）？DECISIONS Q1 说 "M1 完成即替换旧站"，但这一步我不会替你做——你说一声，我开一个只改这一行的 PR。

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
- Hero 标题：1280–1319 px 用 78 px（设计 84 px）、≤ 341 px 用 40 px（44 px），让最长的一行 "Crafting data" 在这两个宽度也不换行；否则那里的标题要等像素字体到了才换行，页面会跳一下（CLS ≈ 0.18）。改了标题文字后这两个数字可能要跟着调
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
- **字体**：Astro Fonts API + 度量匹配 fallback。Astro 的 fallback 用 Courier New / Arial，Android、Linux、ChromeOS 没有这两种字体，所以另配了同宽的系统字体（`src/styles/global.css`）；首屏四种字体都预加载。字体先到时 CLS 0；字体晚到时（实测 320–1920 px 各宽度、晚 0.3–3 s）CLS ≤ 0.01，之前最高约 0.19。
- **质量**：单测 123（覆盖率门槛按文件 ≥ 80%，包含 derive.ts、projects-view.ts 与 motion/params.ts）、E2E 73（Chromium / 移动 Chromium，CI 另跑 WebKit）；axe 0 严重——正常动效、reduced-motion、无 JS 三种情况都测；构建零警告、首屏 JS 2.2 KB gz（预算 180 KB）、Lighthouse 移动端 97–100（中位数 100）/ 100 / 100 / 100、LCP ≈ 0.76 s、CLS 0。布局测试：320–1920 共 10 个宽度（含 WCAG 1.4.10 的 320 px）逐词检查文字不被裁切、不溢出到相邻元素（旧的"无横向滚动"测试因 `.page{overflow-x:clip}` 永远通过，已替换）。
- **流程**：3 个分区 agent 并行实现（独立 worktree），我集成；两轮独立评审 + 对抗式复核。第一轮（事实 / 视觉）18 条：16 条已修，2 条按 Figma 组件驳回。第二轮（无障碍 / 代码）25 条：24 条确认、1 条驳回；23 条产品问题全部修复（见下），另 1 条是评审流程自身的问题（评审副本共用 node_modules 缓存，已改流程，主仓库未受影响）。第三轮独立复核第二轮的修复：22 条确认修好、3 条只修了一半，另有 22 条新线索（复核 agent 中途碰到用量上限，对抗式复核与性能扫描没跑完）；我逐条核对后全部处理（见下），其中"点击滚动条也会暂停"按设计保留（见 D）。第四轮再次独立复核第三轮的 17 条修复：14 条确认（含 1 条按设计保留）、3 条只修了一半（剩下的部分并入新问题）；Lighthouse 9 + 9 次对比无退化、axe 12 种组合 0 违规、截图除 768 的徽章外逐像素相同；另有 11 条小问题，全部修复（见下）。第五轮复核第四轮的 16 条修复：14 条确认、2 条部分（About 网格、字体晚到时的 CLS）；另有 12 条问题，全部处理（见下）。第六轮只查第五轮的改动：6 条问题、4 处测试没覆盖的地方，全部处理（见下）。

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
- CLS：之前约 0.03——Hero 终端的 VT323 字体没有预加载，换字体时几行文字从三行缩成两行，舞台和按钮跟着移动；现在预加载，字体先到时 CLS 0、LCP 不变（字体晚到的情况见第五轮）
- 符号拆分改为线性时间；`{from}` 测试能抓到"到处保留 {from}"的退化

### 第五轮复核修复
- now.md：状态里提到原始标签又没加反引号（如 "Fixing <style> leaks"）时，之前会吞掉后面所有条目，若出现在第一条前还会让 CI 和部署变红；现在只略去这个标签。属性值里出现别的属性名（`title="old alt=new"`）不再让滚动条出现 JSON 或丢掉链接文字；空注释 `<!-->` / `<!--->` 按 Markdown 与 HTML 的规则处理（之前会吞文字，或让构建报"注释未闭合"）；未闭合的 `<word` 不再拖慢构建
- 字体晚到时的 CLS：见上面"字体"一行（Android / Linux / ChromeOS 的同宽替身字体，截图在字体加载后逐像素不变）
- education.yaml 的 `gpa_label` 不再有内置英文默认值，缺省时用 copy.yaml 的 `labels.gpa`
- 测试：标题的拆词与读屏规则移入 `derive.headlineWords` 并有单测；拖拽途中开启"减少动态效果"有 E2E；now.md 的 E2E 判定规则有单测；兴趣只在 About 区块里核对（滚动条里也有，之前会掩盖漏掉的兴趣）；"只解码一次"有单测
- 已知限制：E2E 只能用现有内容构建一次页面，所以 About 网格在其他内容组合下的正确性靠 `derive.aboutCards` 的单测保证；如果有人把 About.astro 改回写死的网格，而现有内容恰好对应那种网格，CI 发现不了

### 第六轮复核修复
- 字体晚到时的 CLS：第五轮的替身字体在 1280–1319 px 与 320–341 px 不够——那里最长的标题行在像素字体下刚好换行、替身下不换行，加载后整个 Hero 下移 84 / 44 px（CLS ≈ 0.18，第五轮以前也是这样）。现在这两个宽度的标题略小（见 D），实测最差 0.007
- now.md：段落里提到 `<h2>` 而后面又有真正的 `##` 标题时，中间的条目会被吞掉；列表里提到 `<li>` 会让后面的标题变成滚动条条目——都已修正并有单测
- `gpa_label` 的 copy.yaml 兜底移入 `derive.withGpaLabel` 并有单测；注释检查（构建与 content:check）对罕见写法判断一致；空注释在 content:check 的修复有了单独的测试
- CI：WebKit 上"减少动态效果"测试偶发失败过一次（同一提交的另一次运行通过）——它在最后一次操作后 300 ms 数一次所有正在运行的动画，连正在收尾的过渡也算。现在改为等到没有动画在运行（最多 3 s），失败时列出仍在运行的动画和元素；真正停不下来的循环（例如被重新转起来的地球）照样会失败

## M1 验收（PLAN §8）
| 验收项 | 结果 |
|---|---|
| 与 Figma `Home — Voxel / 1440` 一致（±4 px） | ✅ 固定几何在 ±2 px 内；高度随真实内容增加（见 D） |
| MCButton / Tooltip / TerminalWindow / PixelBlock 组件 | ✅ `src/components/ui/` |
| 2.5D 像素地球（无 WebGL） | ✅ CSS 条带法 |
| hover 粒子、打字机、reduced-motion 全覆盖 | ✅ |
| 响应式 390 / 768 / 1024 / 1440 | ✅ |
| 移动端 LCP ≤ 2.5 s、axe 0 严重、键盘可达 | ✅（LCP ≈ 0.76 s；axe 覆盖动效 / reduced-motion / 无 JS；照片与滚动条可用键盘操作） |
| 业主人工验收 | ✅ 2026-11-09 接受并合并 |

## 与计划的偏离
记入 PLAN §13：ADR-009 至 ADR-014。实现细节：分支名沿用会话指定的 `claude/affectionate-dirac-6zpbqu`；合并一律以业主账号 squash（业主要求）。

## 下一步（三条）
1. 决定是否 `launched: true`（A）；确认 B–E 的文案、偏差与旧问题。
2. 把确认后的偏差与文案回写 Figma（或告诉我，我来改）。
3. M2：Three.js 体素场景与相机停靠（PLAN §8）。

## 移动端 WebGL 重启触发器（DECISIONS §16）
未触发（场景版尚未上线）。
