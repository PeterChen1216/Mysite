# zhic.me

Zhicheng (Peter) Chen's personal site — v2, built with [Astro](https://astro.build) and deployed to GitHub Pages.

- **Edit content:** only touch [`content/`](content/) (YAML + Markdown). Every field is schema-checked in CI.
- **Plan & decisions:** [`docs/PLAN.md`](docs/PLAN.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md) · [`docs/STATUS.md`](docs/STATUS.md)
- **Old site:** kept in [`legacy/`](legacy/); it stays at https://zhic.me/ until `launched: true` in `content/site.yaml`, and at `/legacy/` afterwards. The v2 preview lives at https://zhic.me/v2/.

## Develop

Requires Node ≥ 22.23 and pnpm 10 (`corepack enable`).

```bash
pnpm install
```

```bash
pnpm dev
```

Full local CI (format, lint, types, content guard, unit, strict build, size, Pages assembly, E2E + axe):

```bash
pnpm verify
```

Lighthouse (mobile) against the launch build:

```bash
SITE_STAGE=launched pnpm build && pnpm lhci
```

## License

Code: MIT (see [`LICENSE`](LICENSE)). Content — text, photos, résumé and logos in `content/` and `legacy/` — © Peter Chen, all rights reserved.
