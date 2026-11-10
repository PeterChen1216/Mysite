# content/ — 业主只需要碰这个目录

- `artifacts/`：把新简历（PDF）、项目截图、logo、任何想放上站的素材直接丢进来，文件名随意。
  Opus/Claude 看到新文件会把它们迁入正式字段（`projects/`、`resume/` 等）并提 PR，你只需确认。
- 其余文件（`profile.yaml`、`experience.yaml`、`projects/*.md`、`aviation.yaml`…）在 M0 由 Opus 从现有 index.html 迁移生成，字段说明见 `docs/CONTENT-GUIDE.md`（M4 产出）。
- 规则：事实性内容只由 Peter 提供；占位必须写 `TODO:`，带 `TODO:` 的内容不能进 main。

## 翻译（X2：英文 + 简体中文 + 繁体中文〔香港〕）

网站有三种语言：`/`（英文）、`/zh-hans/`（简体）、`/zh-hant/`（繁体，香港字形）。英文是源头；中文是译文。
详细规则见 `docs/PLAN.md` §13 ADR-017。

**译文放在哪里**
- 界面文字（标题、按钮、提示）：`copy.zh-hans.yaml`、`copy.zh-hant.yaml`。键必须和 `copy.yaml` 一模一样——少一个或多一个，构建都会失败（不会悄悄显示英文）。终端命令、ping 输出、Clock Stamp 手机画面保持英文。
- 有语言的事实（职位、要点、地点、课程、兴趣…）：在英文字段旁边加 `zh-hans:` / `zh-hant:` 块，只写要翻译的字段，例如：
  ```yaml
  - company: HashKey Global        # 公司、学校、产品名、日期、网址、GPA：只写一份，不翻译
    role: Operations Intern (Summer)
    zh-hans:
      role: 运营实习生（暑期）
      from: { role: "1a2b3c4d" }   # 译自哪段英文（由脚本写，见下）
  ```
  没写的字段显示英文（读屏会按英文读）。
- Markdown：在旁边放同名翻译文件——`about.zh-hans.md`、`projects/clock-stamp.zh-hant.md`（正文是译文；frontmatter 里可以翻译 `title`、`tagline`、`role`、`location`）。

**草稿（`draft: true`）与上线**
- `draft: true` 表示「还没人读过」（Claude 起草的简体、脚本转换的繁体都是）。写在块里、文件开头或翻译文件的 frontmatter 里；也可以写成字段列表 `draft: [role, highlights]`。
- `site.yaml → locales` 里每种语言是 `live` 或 `preview`。preview 的语言照常发布在它的网址上给你读，但搜索引擎不收录、语言切换里看不到、每页顶上写着「草稿译文，尚未经过审阅」。
- **live 的语言里不能有任何 `draft`**，否则内容检查和构建都会失败。
- 上线一种语言：① 读它的所有译文并修改；② 删掉它所有的 `draft: true`（`pnpm content:check` 会列出还剩哪些）；③ 在 `site.yaml` 把它从 `preview` 改成 `live`。

**繁体从简体生成：`pnpm content:hant`**
- 把每个「简体有、繁体没有」的字段转换成香港繁体字形（OpenCC `s2hk`：裏、着、綫、衞），写成 `draft: true`。只转字形，不改用词；**已经存在的繁体字段永远不会被覆盖**——读过、改过的繁体由你维护。
- 它会列出一对多、需要人看的字（发 → 發 / 髮，后 → 後 / 后，干 → 乾 / 幹 / 干，面 → 麵 / 面，并 → 並 / 併 …）。
- 审繁体时还要换成香港用词，例如：信息 → 資訊，设置 → 設定，默认 → 預設，链接 → 連結，联系 → 聯絡，加载 → 載入，源代码 → 原始碼，反馈 → 回饋，视频 → 影片，博客 → 網誌。默认用书面语（不是口语粤文）。
- 语言自己的名字（`i18n.name`、`i18n.suggest`、`i18n.suggest_go`）不转换，要手写（否则繁体版会自称「簡體中文」）。

**过期提醒：`pnpm content:stale`**
- 每个译文字段的 `from` 记着它译自的那段文字。英文改了，两种中文都会被列出（繁体写「经由简体」）；简体改了，繁体被列出。只是提醒，不会让构建失败；过期的译文照常显示，直到你更新。
- 更新译文后，按报告里给的值改 `from`，或运行 `pnpm content:stale --accept zh-hans`（或 `zh-hant`，可在后面跟文件名）记录当前来源。
