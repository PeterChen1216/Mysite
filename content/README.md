# content/ — 业主只需要碰这个目录

- `artifacts/`：把新简历（PDF）、项目截图、logo、任何想放上站的素材直接丢进来，文件名随意。
  Opus/Claude 看到新文件会把它们迁入正式字段（`projects/`、`resume/` 等）并提 PR，你只需确认。
- 其余文件（`profile.yaml`、`experience.yaml`、`projects/*.md`、`aviation.yaml`…）在 M0 由 Opus 从现有 index.html 迁移生成，字段说明见 `docs/CONTENT-GUIDE.md`（M4 产出）。
- 规则：事实性内容只由 Peter 提供；占位必须写 `TODO:`，带 `TODO:` 的内容不能进 main。
