# 业主决策记录（DECISIONS）

> 对应 `docs/PLAN.md` §14。Opus 开工前以本文为准；新决定追加在末尾并标日期。

## 2026-11-09 · 第一轮（Peter）

| # | 问题 | 决定 | 对计划的影响 |
|---|---|---|---|
| Q1 | 上线节奏 | **M1 长页面完成即替换旧站**；场景版 M2/M3 后续迭代上线 | M1 验收标准即"可上线标准"；旧站保留 `/legacy/` 30 天 |
| Q2 | 移动端策略 | **先静态像素插画 + 长页面**；WebGL 轻量场景写入计划，**时机成熟时提醒业主再切换**（触发条件见下） | 新增 §16"移动端 WebGL 重启触发器" |
| Q3 | 项目清单 / Clock Stamp | 暂不急。**简历已更新**；先把框架搭出来，业主会在 `content/artifacts/` 放入素材 | M0 建 `content/` 骨架与 `content/artifacts/`；项目内容字段允许 `status: wip` + `TODO:`（仅在非 main 分支）；Opus 发现 artifacts 有新文件时主动迁入 content 并提 PR |
| Q4 | 航空彩蛋 | 同意做，但 **SEA⇄PVG 不要**（不真实且俗）。业主的真实兴趣：看 FR24（Flightradar24）、用 aerolopa 查座位布局、看 aeroroutes 航线新闻、用 ITA Matrix 查航线/票价代码 | 航空模块改为"AvGeek 控制台"（见下文方案）；地球上的航线改为"正在关注的航线"，数据由业主手动维护 |
| Q5 | 预览环境 / 分析 | 按建议：**Cloudflare Pages 预览 + Cloudflare Web Analytics** | ADR-005/006 定稿；业主需注册 Cloudflare 并授权仓库（M4 时提醒） |
| Q6 | 邮箱展示 | 参照公开个人站，**明文公开即可** | Hero/Contact 直接展示 `zchen75@uw.edu`（主）；163 邮箱是否展示待业主补充，默认只放 uw.edu |
| Q7 | 头像 / 状态文案 / 要素排序 | 都可以，由实现方判断 | 头像：像素化头像为主，hover 切真人照片（成本低、两者都有）；状态文案保留"Open to internships & collaborations"，不写具体年份直到业主确认；要素排序采用建议：相机穿梭 > 漂浮窗 > 常驻微动效 > 开场闪名 > 滤镜颗粒 |

未答/默认：语言=仅英文（Q3 旧编号）；可玩度=保留键盘飞行与拖拽但默认不强调；域名 DNS 记录待业主在 M5 前提供。

---

## AvGeek 模块重设计（替代 SEA⇄PVG）

### 原则
- 只展示 **Peter 真正在做的事**：追踪航班、研究座位图、读航线新闻、研究票价/航线代码。不展示虚构的"飞过的航线"。
- 数据 **全部手动策展**，存于 `content/aviation.yaml`；**不爬取** FR24 / aerolopa / aeroroutes / ITA Matrix（它们的 ToS 禁止抓取，且会让站点依赖外部可用性）。可放"外链到原站"的入口。
- 视觉延续终端/体素语言：一个名为 `avgeek --console` 的终端窗口，内部四个"面板"，对应四个真实工具的精神，但全是自绘像素 UI。

### 四个面板
1. **Radar（致敬 FR24）**：像素地球上画的是 `watching[]`——业主当前关注的 3–6 条航线（如新开航线、想飞的机型航线），用虚线大圆 + 图钉 + 机型代码标签；地球旁一行像素"雷达扫描"动画。字段：`from, to, airline, aircraft, why`（一句话：为什么关注）。
2. **Seat map（致敬 aerolopa）**：一张 12–16 列的像素座位图（自绘，不复制 aerolopa 图），高亮业主偏好座位规则（如"2-4-2 靠窗、远离厨房"）。字段：`seat_rules[]`、`favorite_cabins[]`（机型 + 舱位 + 理由）。
3. **Route news（致敬 aeroroutes）**：ticker 式滚动的"最近看到的航线变动"3–5 条，每条带日期与外链。字段：`news[]: {date, headline, url}`。业主两周更新时顺手加一两条即可。
4. **Fare lab（致敬 ITA Matrix）**：一个"解码器"小彩蛋：输入/展示一个 fare basis code（如 `QH7X0N`），像素终端逐字段解释（舱位字母、季节、提前购票天数…）；默认展示 2–3 个业主觉得有趣的例子。字段：`fare_examples[]: {code, route, notes}`。

### 数据模型（`content/aviation.yaml` 草案）
```yaml
watching:
  - from: SEA
    to: NRT
    airline: "ANA"
    aircraft: "787-9"
    why: "想试 THE Room 商务舱"      # 示例，待业主替换
seat_rules:
  - "宽体机优先 2-4-2 靠窗"
favorite_cabins: []
news:
  - date: 2026-11-01
    headline: "示例：某航司宣布 SEA–XXX 新航线"   # TODO 由业主替换
    url: https://www.aeroroutes.com/
fare_examples:
  - code: "QH7X0N"
    route: "SEA-LHR"
    notes: "Q 舱、…"                 # TODO
tools:   # 页面上的外链"工具栏"
  - { name: Flightradar24, url: https://www.flightradar24.com/ }
  - { name: aerolopa, url: https://www.aerolopa.com/ }
  - { name: AeroRoutes, url: https://www.aeroroutes.com/ }
  - { name: ITA Matrix, url: https://matrix.itasoftware.com/ }
```
业主只需维护 `watching` 与 `news`，其余可长期不动。

### 对 Figma 的影响
- 把现有 SEA⇄PVG 航线/图钉/"AvGeek · SEA⇄PVG"气泡替换为 `watching[]` 航线与 `avgeek --console` 窗口（M1 前由设计侧更新 Figma 对应节点）。

---

## §16 · 移动端 WebGL 重启触发器（Q2）

满足以下 **任意两条** 时，Opus/Claude 在 `docs/STATUS.md` 顶部写入 `⚠️ 建议重启移动端 WebGL 评估`，并在下次会话开头主动提醒业主：
1. 桌面场景版（M2/M3）上线 ≥ 4 周，且 KPI 全绿连续 2 次周报；
2. Cloudflare Analytics 显示移动端访问占比 ≥ 50%，且移动端 plain 版的平均停留 < 桌面场景版的一半；
3. 真机测试中 iPhone 12 / 中端 Android 的轻量场景原型 ≥ 50 fps、首屏 ≤ 3 s；
4. 业主主动提出。

评估内容：轻量场景（≤ 600 体素实例、无粒子、固定相机 2 停靠）的成本/收益；通过则列为 M6。

---

## 2026-11-09 · 第二轮（Peter，新简历 2026-11-03 上传后）

| # | 问题 | 决定 | 对内容的影响 |
|---|---|---|---|
| R2-1 | 站点展示哪个邮箱（新简历只写 Outlook） | **Outlook 为主，uw.edu 同时展示**；163 仍不展示 | `profile.yaml`：`peterchenzc@outlook.com` primary + public，`zchen75@uw.edu` public；About 段落的 email 链接指向 Outlook（替代 Q6 的"只放 uw.edu"） |
| R2-2 | About 段落与新简历冲突（Junior / June of 2027 vs 简历 Expected Mar 2027） | **只改这两处事实**：Junior → Senior，June of 2027 → March of 2027；其余措辞保持原文 | `content/about.md` |
| R2-3 | 兴趣第 3 条已过期（Clock Stamp 已上架） | **更新**为 "Vibe Coder, released my first iOS app, Clock Stamp, on the App Store." | `content/interests.yaml` |
| R2-4 | 新简历更新是否直接上线 | **评审 + CI 通过后以业主账号 squash 合并上线**（合并提交只署业主名） | 旧首页的 `/work/Resume.pdf` 同步变为新简历 |

同时由新简历确定：项目正式名为 **Clock Stamp**（已上架 App Store），研究项目 X Community Notes、TA、Merit Interactive 实习、志愿经历与技能均按简历原文迁入。

---

## 2026-11-10 · 第三轮（Peter，审计与体验扩展计划之后）

| # | 问题 | 决定 | 对计划的影响 |
|---|---|---|---|
| R3-1 | 语言（PLAN-EXPERIENCE Q-L1） | **英文 + 中文，中文要简体和繁体两个版本** | 三个语言版本：`/`（en）、`/zh-hans/`（简体，`lang="zh-Hans"`）、`/zh-hant/`（繁體，`lang="zh-Hant"`）；按"字体"而不是按地区命名。取代此前"v2 仅英文"。细节见 `PLAN-EXPERIENCE.md` §5 |
| R3-2 | 体验扩展计划整体 | **同意按计划推进**（"sounds good, for now"），由 Opus（xhigh）逐个里程碑实现，从 X1 开始 | 顺序 X1 → X2 → M2 → X3 → M3 → X4 → M4 → M5；其余开放问题按计划里的默认值 |
| R3-3 | Clock Stamp 手机表盘上的城市标记 | **FRA – Frankfurt、SEA – Seattle、SHA – Shanghai** | `content/copy.yaml → projects.phone.cities`（已实现） |
| R3-4 | 繁体用哪种（PLAN-EXPERIENCE Q-L3） | **香港版**：香港的字形与用词 | `/zh-hant/` 页面 `lang="zh-Hant-HK"`（网址与 hreflang 仍按字体写 `zh-Hant`，因为只有这一个繁体版，台湾、澳门读者也会被建议到这里）；草稿脚本用 OpenCC `s2hk`（裏、着、綫、衞，而不是台湾的 裡、著、線、衛）；系统正文字体优先 `PingFang HK` / `Noto Sans HK`；用词不同处（信息→資訊、视频→影片 等）由业主审稿时改 |

由 R3-1 带出的做法（待业主确认的只有 Q-L3）：
- 简体由业主写或审定，是中文的源头；繁体先由脚本从简体**只转换字形**（不改用词）生成草稿，业主读过、改掉一对多的错字（发→發/髮、后→後/后 等）后才上线，之后繁体文本归业主手工维护，脚本不再覆盖。
- 两种中文各用各的像素字体切分（Fusion Pixel `zh_hans` / `zh_hant`）和各自的系统正文字体，不混用。
- 首次访问只"建议"语言、不自动跳转：`zh-TW` / `zh-HK` / `zh-MO` / `zh-Hant` → 繁體；`zh-CN` / `zh-SG` / `zh` → 简体。
- Q-L3 已答：香港版（R3-4）。
- **Q-L4 已答（2026-11-12）**：香港版以**书面语**为底，但**网页界面要有口语元素**（业主原话：「繁体，也要有口语化的元素在web端」）。做法：事实内容（经历、教育、项目描述、自我介绍）用书面语和香港用词；按钮、提示、俏皮话带粤语口语（打聲招呼、睇睇項目、而家、砌、唔使喇…）。
- **两种中文上线（2026-11-14）**：业主选「简体和繁体都启用」「我先通读一遍再启用」；读过 282 处的 EN / 简 / 繁 对照表（其中 20 处标了「请确认」）后答复「可以，启用吧」。据此删掉全部 `draft`，`content/site.yaml → locales` 两种中文改为 `live`。

