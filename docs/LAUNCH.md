# 上线手册（LAUNCH）

> 给业主（Peter）。上线是你做的事：这里写清每一步做什么、做完看什么、出错怎么退回。
> M5（2026-11-11）在本机按「上线配置」把每一步演练过一次（`SITE_STAGE=launched` 构建、本地服务器），
> 演练的记录在 `docs/STATUS.md`「M5（上线前）交付说明」。仓库里看不到的东西（DNS、GitHub 设置、
> Cloudflare 账号）这里只写「你要去哪里看什么」，不猜。

## 目录
1. 现在的状态（仓库里看得到的）
2. 上线前：要你先决定的事
3. 上线：一步一步
4. 上线后：检查清单
5. 回滚
6. 让一种中文上线
7. 分析与预览（Cloudflare，你的账号）
8. 旧站 `/legacy/`
9. 公告素材
10. 真机检查
11. 等你决定的事（全部，去重，按是否阻塞上线排序）
12. KPI（PLAN §1.3）：今天的数字
13. 风险登记（PLAN §10）：owner 与现状

---

## 1. 现在的状态（仓库里看得到的）
| 项目 | 现在 | 在哪里 |
|---|---|---|
| 是否上线 | **`launched: true`（2026-11-11，业主决定）**：`https://zhic.me/` 是新站，旧站在 `https://zhic.me/legacy/`（robots 禁止收录），`https://zhic.me/v2/…` 跳到去掉 `/v2/` 的同一页。上线前是 `false`：旧站在根目录、新站在 `/v2/` | `content/site.yaml` |
| 域名 | 仓库根目录 `CNAME` 写 `zhic.me`；部署产物里的 `CNAME` 由 `content/site.yaml → domain` 生成 | `CNAME`、`scripts/assemble-pages.mjs` |
| 部署 | 推到 `main` → `.github/workflows/deploy.yml`：内容检查（严格）→ 单测 → 构建 → 组装 → Chromium E2E → 发布到 GitHub Pages → 写 CHANGELOG（约 11 分钟） | `deploy.yml` |
| DNS | **仓库里没有**。PLAN §14 Q9 还没答。审计时记下：`www.zhic.me` 没有证书 | 你的域名服务商 |
| 语言 | 英文 `live`；简体、繁体 `preview`（草稿，`noindex`） | `content/site.yaml → locales` |
| 分析 | 没有（CLAUDE.md 不允许无你同意就加） | — |

**你要自己看的（仓库看不到）**：
1. GitHub → 仓库 Settings → Pages：Source 是 **GitHub Actions**；Custom domain 是 `zhic.me`；**Enforce HTTPS** 已勾选。
2. 域名服务商的 DNS：`zhic.me` 的 A 记录是 GitHub Pages 的四个地址（185.199.108.153、185.199.109.153、185.199.110.153、185.199.111.153），AAAA 是 2606:50c0:8000::153 到 2606:50c0:8003::153（这些是 GitHub 文档写的地址，请在 GitHub 的 Pages 文档里核对一次）；要 `www.zhic.me` 的话，加一条 `www` CNAME → `peterchen1216.github.io`，然后在 Pages 设置里等证书出来。
3. 上线不需要改 DNS：域名一直指向同一个 GitHub Pages 站点，变的只是站点里放什么。

## 2. 上线前：要你先决定的事
见 §11 的 **A 组**（阻塞上线的只有那几条）。其他的都有默认值、已经按默认做好。

## 3. 上线：一步一步
| # | 做什么 | 做完看什么 |
|---|---|---|
| 1 | 本机：`git checkout main && git pull`，新开分支 `git checkout -b launch` | `git status` 干净 |
| 2 | `content/site.yaml`：`launched: false` 改成 `launched: true`（只改这一行） | `pnpm content:check` 结尾是 ✔ |
| 3 | 本机预演（可选，约 1 分钟）：`pnpm build && pnpm assemble && pnpm serve:site`，打开它打印的地址 | `/` 是新站；`/legacy/` 是旧站；`/robots.txt` 两行 + Sitemap；`/sitemap.xml` 列出 5 个地址 |
| 4 | `git commit -am "content: launch v2 at zhic.me"`，`git push -u origin launch`，在 GitHub 开 PR 到 `main` | PR 页面的 CI 全绿（约 20 分钟，五个作业） |
| 5 | Squash 合并 PR | Actions → Deploy 运行（约 11 分钟），最后一步绿 |
| 6 | 打开 `https://zhic.me/`（无痕窗口，避开缓存） | 是新站；按 §4 检查 |

**`launched: true` 改变了什么**（`scripts/assemble-pages.mjs`、`src/lib/seo.ts`）：
| | 上线前（现在） | 上线后 |
|---|---|---|
| `/` | 旧站 | 新站（英文） |
| `/zh-hans/`、`/zh-hant/` | 在 `/v2/` 下 | 在根目录下，仍是 preview（`noindex`、草稿提示） |
| `/v2/…` | 新站预览 | 旧地址的跳转页：每个页面一个，`0` 秒跳到去掉 `/v2/` 的同一页（`noindex`，canonical 指新地址）；`/v2/resume.pdf` 仍是简历 |
| `/legacy/` | 旧站 | 旧站（robots 禁止） |
| `/work/Resume.pdf` | 当前简历 | 当前简历（旧站的链接不断） |
| `/resume.pdf`、`/resume/<日期>-<hash>.pdf` | 在 `/v2/` 下 | 在根目录下 |
| `robots.txt` | `Disallow: /v2/` | `Disallow: /legacy/` + `Sitemap: https://zhic.me/sitemap.xml` |
| `sitemap.xml` | 没有 | 只列 live 语言能收录的页：`/`、`/projects/`、三个项目页 |
| canonical、`og:url` | `https://zhic.me/v2/…` | `https://zhic.me/…` |
| OG 分享图 | `https://zhic.me/v2/og/…`（robots 禁止，有的预览抓不到） | `https://zhic.me/og/…` |
| JSON-LD `Person` 的 `url` | `https://zhic.me/v2/` | `https://zhic.me/` |
| 404 | 根目录的 404 是新站的「chunk not found」；`/v2/` 外的地址「回家」回旧站 | 同一个 404，「回家」回新站 |
| `CONTENT-GUIDE.md` §12 | 写的是 `/v2/` | 上线后让 Claude 改成 `/`（只改文档） |

## 4. 上线后：检查清单（约 10 分钟）
在无痕窗口里，每条打开、看结果：
1. `https://zhic.me/` → 新站，页脚 `updated` 是最近一次内容提交的日期。
2. `https://zhic.me/projects/`、`https://zhic.me/projects/clock-stamp/` → 目录与项目页。
3. `https://zhic.me/zh-hans/`、`https://zhic.me/zh-hant/` → 中文页，顶上有「草稿译文」提示。
4. `https://zhic.me/resume.pdf` → 简历 PDF；首页 RÉSUMÉ 按钮下载的文件名是 `Peter-Chen-Resume-<日期>.pdf`。
5. `https://zhic.me/legacy/` → 旧站；`https://zhic.me/work/Resume.pdf` → 简历。
6. `https://zhic.me/v2/` → 跳到 `https://zhic.me/`；`https://zhic.me/v2/projects/clock-stamp/` → 跳到项目页。
7. `https://zhic.me/no-such-page` → 「chunk not found」，`cd ~` 回到 `/`。
8. `https://zhic.me/robots.txt` → `Disallow: /legacy/` 和 `Sitemap:` 一行；`https://zhic.me/sitemap.xml` → 5 个地址，都以 `https://zhic.me/` 开头。
9. 分享卡片：把 `https://zhic.me/` 贴到 X / LinkedIn / iMessage 的输入框（不用发出去）看预览：标题 `Zhicheng (Peter) Chen`、像素风的图。图在 `https://zhic.me/og/en/home.png`。
10. Google Search Console（可选，你的账号）：添加 `zhic.me`，提交 `https://zhic.me/sitemap.xml`。
11. 手机上打开 `https://zhic.me/`：底部热键栏、设置 ⚙ 能打开。

## 5. 回滚
任何一步不对：
1. GitHub 上打开那次合并的提交 → **Revert**（会开一个 PR，把 `launched` 改回 `false`）→ 合并。约 11 分钟后 `https://zhic.me/` 回到旧站、新站回到 `/v2/`。
2. 急的话：Actions → Deploy → 选上线前最后一次成功的运行 → **Re-run all jobs**。它按那次的提交重新构建、发布（旧站在根目录）。之后仍要做第 1 步，否则下一次部署又是上线状态。
3. 回滚后看：`https://zhic.me/` 是旧站；`https://zhic.me/v2/` 是新站；`robots.txt` 是 `Disallow: /v2/`；没有 `sitemap.xml`。
4. 浏览器或 CDN 缓存：GitHub Pages 的缓存约 10 分钟；无痕窗口看。

## 6. 让一种中文上线
`docs/CONTENT-GUIDE.md` §9 有完整步骤，简要：
1. 读并改简体文件（`content/copy.zh-hans.yaml`、`content/*.zh-hans.md`、各 YAML 里的 `zh-hans:` 块）。
2. 删掉每一个 `draft: true`（不确定还剩哪些：先做第 3 步再 `pnpm content:check`，它逐条列出）。
3. `content/site.yaml`：`zh-hans: preview` → `zh-hans: live`。
4. 提交、推送、PR、CI 绿、合并。
5. 上线后看：`/zh-hans/` 没有草稿提示、没有 `noindex`；英文页的 `<head>` 有 `hreflang`（en、zh-Hans、x-default）；`sitemap.xml` 多了简体的 5 个地址；设置里的语言一行出现「简体中文」。
繁体同理（`zh-hant`）。

## 7. 分析与预览（Cloudflare，需要你的账号；我没有接）
DECISIONS Q5 你同意过 Cloudflare Web Analytics 与 Cloudflare Pages 预览。两者都要你的 Cloudflare 账号，所以没做。要的话：

**Cloudflare Web Analytics（无 cookie）**
1. Cloudflare 控制台 → Web Analytics → Add a site → 填 `zhic.me` → 选「JavaScript snippet」（不改 DNS 的那种）→ 拿到一段 `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "…"}'></script>`。
2. 告诉 Claude「加 Cloudflare Web Analytics，token 是 …」。它要改的地方（写在这里，现在不改）：
   - `src/layouts/BaseLayout.astro` 的 `<head>` 末尾加这段脚本，只在 `launched` 时输出（预览不计数）；
   - `CLAUDE.md`「No analytics, trackers, third-party scripts…」改成「只允许 Cloudflare Web Analytics 这一个」；
   - `PLAN.md` §13 加一条 ADR；`docs/CONTENT-GUIDE.md` 写一句；
   - 测试：`tests/e2e/quality.spec.ts`「no console errors and no failed requests」会看到对外的请求——测试里拦下 `static.cloudflareinsights.com`；首屏 JS 预算脚本已经不算第三方脚本；
   - 网站现在没有 CSP（GitHub Pages 不能设响应头），所以不用改 CSP。
3. 想计「简历下载 / 邮件点击」（KPI）：Cloudflare Web Analytics 只有页面浏览，没有自定义事件；要事件得换 Plausible / Umami（PLAN §11），那是另一个决定。

**Cloudflare Pages 预览（每个分支一个网址）**：Cloudflare → Workers & Pages → Create → Pages → 连接 GitHub 仓库 → 构建命令 `pnpm build && pnpm assemble`，输出目录 `_site`，环境变量 `NODE_VERSION` 取 `.nvmrc` 的版本。仓库不用改。现在的替代：每次 CI 运行的 Summary 页有整站下载（`CONTENT-GUIDE.md` §12）。

## 8. 旧站 `/legacy/`
计划写「下线或保留 30 天」，你来定（§11 A4）。默认：**保留**（`/legacy/` 在、robots 禁止收录；`/work/Resume.pdf` 一直是当前简历）。
- 下线：让 Claude 从 `scripts/assemble-pages.mjs` 去掉复制 `legacy/` 的两行、删掉 `legacy/` 文件夹，保留 `/work/Resume.pdf`（旧链接）。之后 `/legacy/…` 是 404。
- 注意：旧站页面上还是旧事实（GPA 3.81、Junior、163 邮箱），和 `legacy/work/njzposts.pdf`（5 MB，没有页面链接它）。

## 9. 公告素材
- 分享卡片（OG 图，构建时生成，1200 × 630）：每种语言每页一张 Night，首页另有每个主题一张（共 27 张）。上线后的地址：`https://zhic.me/og/en/home.png`（默认）、`home.day.png`、`home.mono-dark.png`、`home.mono-light.png`、`home.cvd.png`；项目页 `og/en/projects/clock-stamp.png` 等。
- 发帖本身（X 帖子）是你的事；贴首页地址就会带出卡片。

## 10. 真机检查
`docs/A11Y-CHECK.md`：§1–§9 十分钟人工检查；§10 手机矩阵（iPhone 12 / 13 mini、iPhone 15 Pro Max、Pixel 7、4 GB 中端安卓、iPad 竖横、微信内置浏览器、VoiceOver / TalkBack）。**到今天一次都没有在真机上跑过**。建议上线前至少：你的 iPhone（Safari）+ 你的 Mac（Safari 和 Chrome）各走一遍 §1、§7，并在 Mac 上开 `/?debug=1` 看场景帧率（KPI「桌面 ≥ 55 fps」只能这样量）。结果写进 `docs/STATUS.md`。

## 11. 等你决定的事
每条：要决定什么 · **默认（已经这样做了）** · 在哪里改 / 出处。去掉了重复（同一件事在几个里程碑都问过的，合成一条）。

**A. 阻塞上线（上线前要你一句话）**
| # | 决定 | 默认 | 在哪里 / 出处 |
|---|---|---|---|
| A1 | 上线，什么时候 | **不上线**，等你说 | `content/site.yaml → launched`；§3；DECISIONS Q1、审计 1、STATUS A |
| A2 | 首页的 meta description 是「This is a personal/academic website」（搜索结果里显示的那句，也是分享卡片的说明） | **保留原文**（我不替你写关于你的话） | `content/site.yaml → meta.description`（中文在同一处的 `zh-hans:` / `zh-hant:`）；M5 |
| A3 | DNS 与 Pages 设置是否如 §1 所写（尤其要不要 `www.zhic.me`） | **不改**；`www` 没有证书 | 域名服务商、GitHub Settings → Pages；PLAN §14 Q9、STATUS E4 |
| A4 | `/legacy/` 保留多久（旧站上仍是 GPA 3.81、Junior、163 邮箱） | **保留**，robots 禁止 | §8；DECISIONS Q1、PLAN §8 M5、STATUS E2 |
| A5 | `legacy/work/njzposts.pdf`（5 MB，公开、无链接、含社交账号）删不删 | **保留** | `legacy/work/`；审计 2、STATUS E3 |
| A6 | 预览期的 `/v2/…` 地址上线后跳到新地址（M5 加的跳转页），保留多久 | **一直保留**（每个页面一个小文件） | `scripts/assemble-pages.mjs`；M5 |

**B. 上线后、不阻塞：服务与流程**
| # | 决定 | 默认 | 在哪里 / 出处 |
|---|---|---|---|
| B1 | 分析（Cloudflare Web Analytics；要事件计数就得 Plausible / Umami） | **不接**（没有你的账号）；KPI「简历下载 / 邮件点击」因此量不了 | §7；DECISIONS Q5、PLAN §11 |
| B2 | 每个分支一个预览网址（Cloudflare Pages） | **不接**，用 CI 的整站下载 | §7；M4 决定 1、ADR-021 |
| B3 | 部署前跑完整 Chromium E2E（约 11 分钟上线）还是只跑冒烟测试（约 2 分钟） | **完整** | `.github/workflows/deploy.yml`；M4 决定 3 |
| B4 | 每次部署后机器人在 main 上提交 `CHANGELOG.md` | **保留** | `deploy.yml` 的 `changelog` 作业；M4 决定 2 |
| B5 | 简历下载名 `Peter-Chen-Resume-<日期>.pdf`（日期 = 简历被提交那天）；旧版简历不保留 | **如此** | `src/lib/resume.ts`；M4 决定 4、5 |
| B6 | Figma 回写：各里程碑「需要回写 Figma」的清单（我没有改过 Figma） | **没回写** | STATUS 各交付说明；审计 12 |
| B7 | 真机：你手上有哪些手机能测（Q-M2），什么时候跑 §10 | **没跑过** | `docs/A11Y-CHECK.md` §10；X4 决定 3 |
| B8 | 两个远端分支 `claude/affectionate-dirac-6zpbqu`、`claude/upbeat-jones` 删不删 | **保留** | GitHub；审计 11 |

**C. 不阻塞：内容与事实（只有你能写）**
| # | 决定 | 默认 | 在哪里 / 出处 |
|---|---|---|---|
| C1 | Classmate Map 的句子语法不通、新简历没有它：重写、保留还是删 | **原样保留**（也没翻译） | `content/projects/classmate-map.md`；审计 6、STATUS E1、X2 决定 4 |
| C2 | 两个项目都 `featured: true`，只有第一个用大卡片 | **如此** | `content/projects/*.md`；审计 3 |
| C3 | 院长名单在教育卡和荣誉里各一次、写法不同；旧简历的「4 consecutive quarters」 | 桌面两处都显示，手机只在教育卡 | `education.yaml → honors`、`honors.yaml`；审计 4、STATUS E5、X4 |
| C4 | 兴趣里的「crafts」是不是想写 aircraft | **原样** | `content/interests.yaml`；审计 7 |
| C5 | 关注的航线（`watching`）为空：航线弧线、第 5 行交互、地球上的航线都等它 | **不画** | `content/aviation.yaml`；X3 决定 5、M2 决定 9 |
| C6 | 「正在做」的天数计数器需要 Clock Stamp 开始的具体日期 | **不做** | `content/projects/clock-stamp.md → start`；X3 决定 4 |
| C7 | Figma 里关于你本人的文案（whoami 改写、兴趣描述、AvGeek 一句、Clock Stamp 一句、HEAD / init 行、「This website」项目卡） | **没上页面** | STATUS C1–C8 |
| C8 | 设计稿界面文案（标题、各区块说明、页脚一句、预告卡…）保留还是改 | **保留** | `content/copy.yaml`；STATUS B |
| C9 | 头像源文件 2.9 MB 要不要缩到 1200 px（只影响仓库） | **不缩** | `content/images/avatar.jpg`；审计 9 |
| C10 | HashKey logo 在 44 px 格子里看不清 | **原样** | `content/images/`；审计 8 |
| C11 | 导航的 RÉSUMÉ 新标签打开、首屏与 Contact 的是下载：统一成哪种 | **如此** | `src/components/`；审计 5 |

**D. 不阻塞：设计与交互（都已按默认实现，要改告诉我）**
| # | 决定 | 默认 | 出处 |
|---|---|---|---|
| D1 | 手机版式整体按 Figma「📱 Mobile — 390」（你还没审），以及它相对计划的改动（按钮在终端下、顶栏 ⏸、logo 回出生点、院长名单进教育卡、城市键行、320 只显示图标…） | **照画框做** | X4 决定 1、6、7、9、10 |
| D2 | 热键栏第五格：⚙ 设置还是简历（Q-M1）；首屏两个 RÉSUMÉ 要不要换一个成 SEE PROJECTS；顶栏 ⏸ 留不留 | **⚙；两个都留；留** | X4 决定 2、4、5 |
| D3 | calm 动效保留场景（慢 3 倍）还是按计划表变成 1 级 | **保留** | M2 决定 3 |
| D4 | 平板给不给 3 级场景；自动化浏览器（爬虫）一律普通页面 | **不给；如此** | M2 决定 4、6 |
| D5 | 地球的昼夜按真实时间（西雅图晚上看是夜面） | **真实时间** | M2 决定 7 |
| D6 | About 两侧的页边方块；第 4–5 站的峡谷；矿车只在页边 ≥ 24 px 时画 | **都留** | M2 决定 8、M3 决定 1、9 |
| D7 | 玩家卡 XP 条按真实 GPA（96 %）还是满格 | **真实比例** | X3 决定 1 |
| D8 | 终端小命令行的命令；手机的城市键对读屏可见；区块强调色；地区名的粗粒度；2 级环境层在 calm 下不出现 | **如此** | X3 决定 2、3、6、7、8 |
| D9 | 浅色主题下窗口背后变深色；单击标题栏关窗；只有 Projects 有目录；项目标题静止时看不出是链接；`og:image` 用 Night；预览期 404 | **如此** | M3 决定 2–7 |
| D10 | 主题名（朴素名 + 小字游戏名）、没选过主题一律 Night；暂停键 `p`；130 % 字号时舞台不放大；五套配色 | **如此** | X1 决定 1–3、6；Q-T1、Q-T2 |
| D11 | 打印：现在 7 页 A4；要不要两页的打印版式 | **不做**（打印交给 `resume.pdf`） | X1 决定 4 |
| D12 | 轻量模式的电池条件（≤ 20 % 且没充电，只有 Chromium 读得到） | **如此** | X4 决定 11 |
| D13 | 手机上两个圆环随地球淡入（为了 LCP） | **如此** | X4 决定 13 |
| D14 | 页脚第二行加所在地；385 px 以下导航多一行（手机版式后只在 ≥ 768 的窄窗口） | **如此** | X4 决定 10、X1 决定 7 |
| D15 | 没有 JavaScript 时页脚要不要一行语言链接（只在别的语言 live 时出现） | **不加** | X2 决定 6 |
| D16 | 滚动条点击也暂停（键盘之外，鼠标唯一持续暂停的方法） | **如此** | STATUS D |
| D17 | `tokens.css` 里 18 个没用到的 token（对应 Figma 变量） | **保留** | 审计 10 |
| D18 | 声音：永远不要（Q-A1） | **不要** | PLAN-EXPERIENCE §10 |
| D19 | iOS 16.0–17.3 上窗口与设置窗口背后不变暗（那些版本的 `::backdrop` 看不到 `var()`；要修就得在那里写字面颜色，违反「颜色只在 tokens.css」） | **不修**（窗口不透明、仍是模态） | M5「跨浏览器：特性检查」 |

**E. 不阻塞：翻译（两种中文都是草稿，§6 上线时一并处理）**
| # | 决定 | 默认 | 出处 |
|---|---|---|---|
| E1 | 读并改简体草稿、繁体草稿（含各里程碑新增的界面文字） | **草稿，不上线** | X2「请你审阅」、X3/M3/X4 中文草稿 |
| E2 | 学校、公司用官方中文名（Q-L2）；地名译成中文 | **保持英文；译成中文** | X2 决定 1、3 |
| E3 | 香港版书面语还是粤语口语（Q-L4） | **书面语** | X2 决定 2 |
| E4 | 繁体用词（設定、預設、連結、聯絡、載入、原始碼、回饋、資訊學、視窗…）与「併→並」一处 | **转换器原样**（一处错字已列出，没改） | X2「请你审阅」、X3 决定 9、M3 决定 8、X4 决定 12 |
| E5 | 中文页面上 Clock Stamp 手机保持英文界面；小标签升到 12 px；滚动条标签；中文标题 36 px 三行 | **如此** | X2 决定 5、7、8，X4 决定 8 |
| E6 | 「Dean's List」繁体用「院長名單」还是「院長嘉許名單」 | **院長名單** | X2 决定 9 |
| E7 | 浏览器是英文、页面是中文时建议英文 | **建议** | X2 决定 11 |

## 12. KPI（PLAN §1.3）：今天的数字
PLAN §1.3 的 KPI 是「上线后 8 周评估」；这是上线前能量的部分。**量法**：本机，上线配置（`SITE_STAGE=launched pnpm build`），Lighthouse 13.6 默认的手机模拟 + 模拟慢 4G，每页 5 次的中位数，机器空闲时（2026-11-11，M5 这批改动；改前 `af58aa9` 同一台机器同样量过，数字相同）。

| 指标 | 目标 | 今天 | 怎么量的 / 为什么量不了 |
|---|---|---|---|
| 移动端 LCP | ≤ 2.5 s（4G 模拟） | 首页 1.21 s；目录、项目页 0.91 s；404 0.76 s（三种语言相同） | Lighthouse（上面）。真实访客的数字要上线后 Search Console 的 Core Web Vitals 或分析 |
| 首屏到可交互（TTI） | ≤ 3.5 s | 首页 2.3–2.6 s（改前 2.26 s、改后 2.59 s，5 次中位数；模拟节流下的波动） | Lighthouse「Time to Interactive」 |
| 桌面场景帧率 | ≥ 55 fps（M1 Air、中端 Windows 独显） | **没量** | 这里只有软件渲染（约 16 fps，不代表真机）。要你在 Mac 上打开 `/?debug=1`（上线前 `/v2/?debug=1`），左下角 HUD 的 fps，滚动一遍 |
| 简历下载 / 邮件点击 | 有计量 | **没有** | 没有分析（§7、B1）；Cloudflare Web Analytics 也没有事件计数 |
| 业主更新一次内容 | ≤ 5 分钟、零代码 | **没量** | 只有你能量：`docs/STATUS.md`「业主自己计时一次的清单」 |
| 无障碍 | axe 0 严重；减少动态全链路 | axe 0 serious / critical：页面类型 × 语言 × 主题 × 动效 × 等级的修剪矩阵，Chromium、WebKit、iPhone 模拟，M5 起加 Firefox，CI 每次推送；减少动态 = 0 级、静止（E2E） | CI。真读屏（VoiceOver、TalkBack、NVDA）没跑过 |
| 浏览器 | 最新两版 Chrome / Edge / Safari / Firefox + iOS Safari 16+ | CI：Playwright 自带的 Chromium、WebKit、Firefox（各一个版本）；Edge 与 Chrome 同引擎 | 「最新两版」、真 Safari、iOS 16+ 要真机（§10） |

PLAN-EXPERIENCE §1.3 的预算（每一条都是 CI 检查）：
| 预算 | 上限 | 今天 |
|---|---|---|
| 首屏 JS（gz） | 180 KB | 16.0 KB（内联 1.1 KB + 主脚本 15.3 KB），每种语言、每个页面相同；404 1.9 KB |
| WebGL 场景 chunk（gz，按需） | 250 KB | 22.7 KB |
| CSS（gz，含全部主题） | 45 KB | 28.1 KB |
| 拉丁字体，首屏 | 150 KB | 预加载 4 个 59.5 KB；1440 宽时 7 个都用上，共 111.5 KB（`pnpm size`） |
| CJK 字体（每种语言，按需） | 160 KB | 简体 23.9 KB、繁体 25.7 KB（`pnpm size` 的算法；英文页面不加载） |
| CLS | ≤ 0.05（每个主题、语言） | 0；网页字体全部晚到 1 秒：本机 ≤ 0.004（M5 修了导航在 1280 px 与 1024 px 只剩几个像素时的折行：本机 0.47、CI 0.58） |
| 动画时每帧主线程 | 桌面 ≤ 8 ms | 场景自己约 0.6 ms（M2，软件渲染里量的）；真机没量 |
| 同时存在的画布 | 1 WebGL + 1 2D | 是（E2E） |
| 屏幕外、隐藏标签页不动画 | 硬规则 | 是（E2E；M5 起看门狗也不把隐藏 / 暂停当成慢） |

## 13. 风险登记（PLAN §10）：owner 与现状
PLAN §10 的 R1–R9 和 PLAN-EXPERIENCE §11 的 X-R1–X-R9。Owner：**Peter** = 只有你能做或决定；**Claude** = 代码与检查（由你批准的会话）。

| # | 风险 | Owner | 现状（2026-11-11） |
|---|---|---|---|
| R1 | 低端设备上 WebGL 卡顿 / 发热 | Claude | 手机永远不建 WebGL（X4）；桌面只给能悬停的精细指针 + ≥ 1024 px + 硬件 WebGL 2，过不了预热就降级；看门狗现在也能判出每秒不到 4 帧的设备（M5）。**真机没量过**（§10） |
| R2 | 编造的内容或占位进入线上 | Peter（写事实）/ Claude（检查） | `TODO:` / `lorem` / `placeholder` 在 main 和指向 main 的 PR 上让 CI 与部署失败（M4 有测试）；`CLAUDE.md` 禁止编造；JSON-LD 只用 `content/` 的字段（M5 有测试） |
| R3 | 范围蔓延 | Peter | X5（手机 WebGL）没有开始，触发条件没满足；M5 只做了委托的 7 项 |
| R4 | 字体 / 素材许可 | Claude | 字体全是 OFL（Fusion Pixel 的许可证在仓库里）；方块、地球、图标都是自画；没有下载任何美术 |
| R5 | GitHub Pages 没有分支预览 | Peter（Cloudflare 账号） | CI 每次推送提供整站下载；Cloudflare Pages 没接（§7、B2） |
| R6 | 3D 库超预算 | Claude | 已关闭：自写 WebGL，场景 22.5 KB gz（预算 250） |
| R7 | 劫持滚动招人反感 | Claude | 已关闭：相机跟随滚动，从不接管滚轮；键盘飞行用的是浏览器自己的滚动（E2E） |
| R8 | 更新太麻烦而荒废 | Peter | 指南 + `pnpm content:check` + 演练（M4）；**你自己计时一次还没做**（`docs/STATUS.md` M4 清单） |
| R9 | Safari 的 100vh / 工具栏让画布跳动 | Claude | 环境层画布 `100lvh`、每个宽度只取一次尺寸（X4 有模拟测试）；**真 iPhone 没看过** |
| X-R1 | 测试矩阵拖慢 CI | Claude | 主作业分两半 + 手机、Firefox、上线配置各一个作业并行；每个作业都在上限内（见 STATUS M5 的 CI 记录） |
| X-R2 | 五套主题放大设计债 | Claude / Peter（Figma） | 只用语义 token，对比度是单测；Figma 回写没做（B6） |
| X-R3 | 中文破坏像素网格 | Claude | 每种语言的字号 token、版面测试每种语言都跑 |
| X-R4 | 译文过期 | Peter（读）/ Claude（报告） | `pnpm content:stale` 每次 CI 都报；中文仍是草稿 |
| X-R5 | WebGL 占比与性能预算打架 | Claude | 3 级时占比 97.5–100 %（CI 量的）；首屏不等场景（LCP 是文字）；真笔记本上的帧率没量过（KPI 表） |
| X-R6 | 悬停目录变成噪音 | Peter（审） | calm 保留状态变化、去掉动画；等你看 |
| X-R7 | 热键栏挡内容或与浏览器的栏打架 | Claude | 下滑隐藏、安全区、聚焦的元素不被盖住（测试）；微信等内置浏览器没真机看过 |
| X-R8 | 设置拖慢首帧 | Claude | 头部内联脚本约 1.1 KB gz，同步、无网络 |
| X-R9 | 繁简转换选错字 | Peter（审） | 转换结果永远是草稿；转换器标出的一对多字列在 STATUS |
