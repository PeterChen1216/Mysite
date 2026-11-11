# CLAUDE.md — rules for a Claude session on zhic.me

Peter Chen's personal site: Astro 7, TypeScript, pnpm, static, deployed to GitHub Pages from
`main`. Peter (the owner) writes to you in Chinese: answer in Chinese; file names, keys and
commands stay as they are. How content is updated, task by task: `docs/CONTENT-GUIDE.md`.

## What you may change

- **Only `content/`**, unless Peter explicitly asks for a code, design, workflow or docs change.
  `docs/CONTENT-GUIDE.md` §1 maps every part of the page to its file and field.
- **Never invent a fact** (`docs/PLAN.md` §2.4): no job, date, number, project, award, link, route
  or wording about Peter that he did not give you or that is not in a file he supplied
  (`content/artifacts/`, `content/resume/Resume.pdf`). Missing → ask. A placeholder on a branch
  must say `TODO:`; `pnpm content:check` blocks it from `main`. Record where a fact comes from in
  `source:` (education, experience, honors, projects).
- **Never change `launched`** in `content/site.yaml`, nor a language's `live` / `preview` state,
  unless Peter asks in so many words.
- **Translations** (`docs/PLAN.md` ADR-017): you may draft Chinese, always marked `draft: true`;
  never remove a `draft` Peter has not approved. Traditional (Hong Kong) drafts come from
  `pnpm content:hant`. After changing English that has translations, run `pnpm content:stale`.
- **Files Peter drops in `content/artifacts/`**: move them into place (a résumé:
  `pnpm resume content/artifacts/<file>.pdf`; images: `content/images/`) and tell him what you did.
- Interface wording lives in `content/copy*.yaml`, colours only in `src/styles/tokens.css` — never
  in code. No analytics, trackers, third-party scripts or services that need accounts.
- Peter's emails, phone number (it is in the résumé PDF) and other personal details go to no
  outside service.
- Never weaken a check or a test to make something pass; fix the content, or improve the message.

## Checks

- After any content edit: `pnpm content:check` (under a second; must end with `✔`). Its messages
  name file:line, the field and what to write; `docs/CONTENT-GUIDE.md` §11 explains each kind.
- To see it: `pnpm dev`, then open http://localhost:4321/ (the site is launched; `/v2/…` only
  redirects).
- Before pushing a content change: `pnpm content:check && pnpm build`. Before pushing anything in
  `src/`, `scripts/`, `tests/` or workflows: `pnpm verify` (format, lint, colours, types, content,
  unit tests, build, size budgets, E2E; about 10 minutes).
- CI (`.github/workflows/ci.yml`) runs the same on every push; `TODO` / `lorem` / `placeholder` in
  `content/` fail it on `main` and on pull requests into `main`. A deploy runs only from `main`.

## Commits and branches

- Work on a branch, never directly on `main`; Peter reviews and squash-merges
  (`docs/DECISIONS.md` R2-4). Do not merge or force-push.
- Conventional commit subjects: `content: …` for content, `feat:`, `fix:`, `design:`, `docs:`,
  `test:`, `chore:`. `CHANGELOG.md` is written from the subjects after each deploy
  (`pnpm changelog`): never edit it by hand. Subjects end up in it, bodies never do. A pull
  request is one entry however it is merged: its squash commit's subject, or its title when
  merged with a merge commit — so a pull request's title is written like a subject.
- The footer's version and "updated" date come from Git (`src/lib/build-info.ts`); never write
  dates or versions by hand. `content/site.yaml → version` changes only for structural changes.

## Where things are

- `docs/PLAN.md` — the charter: goals, guardrails (§2.4), content model (§4.3, §7), milestones
  (§8), QA (§9), decisions (§13 ADRs).
- `docs/PLAN-EXPERIENCE.md` — themes, languages, accessibility, interactions, WebGL, mobile.
- `docs/DECISIONS.md` — Peter's answers; they override the plans.
- `docs/STATUS.md` — progress and hand-over notes (Chinese, newest first). Update it at the end
  of a session that changed more than content.
- `docs/CONTENT-GUIDE.md` — the owner's guide; keep it true when you change how content works.
