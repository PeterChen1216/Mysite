# content/ — 业主只需要碰这个目录

怎么改每一样东西（文件、改前改后、运行什么、结果什么样子）都在 **`docs/CONTENT-GUIDE.md`**——那是唯一的说明，这里只留最要紧的几条。

- 改完运行 `pnpm content:check`（不到一秒）：结尾是 `✔` 就可以提交；有错时它说明哪个文件哪一行、哪个字段、该怎么写（指南 §11）。
- 事实性内容只由 Peter 提供；占位必须写 `TODO:`，带 `TODO:` 的内容不能进 main（检查会拦下）。
- `artifacts/`：新简历（PDF）、项目截图、logo，直接丢进来，文件名随意；Claude 会把它们放到正式位置（指南 §14）。
- 简历只有一个：`resume/Resume.pdf`（指南 §5，`pnpm resume`）。

## 翻译（Translations）

其他文件注释里写的 `content/README.md "Translations"` 指的就是这里：译文放在哪里、`draft: true`、让一种语言上线、`pnpm content:hant`、`pnpm content:stale`——全部在 **`docs/CONTENT-GUIDE.md` §9**。
