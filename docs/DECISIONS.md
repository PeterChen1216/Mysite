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
