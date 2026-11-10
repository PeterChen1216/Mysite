/**
 * Share cards (Open Graph images; PLAN §11, M3): one per page per locale — the home page, the
 * projects directory, each project — drawn at build time from content/ and the theme tokens
 * (src/og/render.ts). Pages name theirs in `og:image` (Night, the default theme); the home page
 * of each locale also has one per theme, `home.<theme>.png`, for sharing in that theme.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { stripFallback } from '../../i18n/fallback';
import { LOCALE_KEYS, type Locale } from '../../i18n/locales';
import { ogImagePath, type SitePage } from '../../i18n/routing';
import { fillTemplate } from '../../lib/derive';
import { getPageData } from '../../lib/page-data';
import { THEMES } from '../../prefs/model';
import { projectView } from '../../components/sections/projects-view';
import { renderCard, type CardText } from '../../og/render';

type Props = {
  locale: Locale;
  page: SitePage;
  theme: string;
};

export const getStaticPaths = (async () => {
  const out: Array<{ params: { card: string }; props: Props }> = [];
  for (const locale of LOCALE_KEYS) {
    const data = await getPageData(locale);
    const pages: SitePage[] = [
      { kind: 'home' },
      { kind: 'projects' },
      ...data.projects.map((p) => ({ kind: 'project' as const, id: p.id })),
    ];
    for (const page of pages)
      for (const theme of page.kind === 'home' ? THEMES : (['night'] as const)) {
        const path = ogImagePath(locale, page, '/', theme === 'night' ? null : theme);
        out.push({
          params: { card: path.replace(/^\/og\//, '').replace(/\.png$/, '') },
          props: { locale, page, theme },
        });
      }
  }
  return out;
}) satisfies GetStaticPaths;

export const GET: APIRoute<Props> = async ({ props }) => {
  const { locale, page, theme } = props;
  const data = await getPageData(locale, page);
  const w = data.copy.windows;
  const plain = (s: string) => stripFallback(s);
  let text: CardText;
  if (page.kind === 'project') {
    const p = data.projects.find((x) => x.id === page.id)!;
    const v = projectView(p, data.copy.projects, data.copy.labels);
    text = {
      bar: fillTemplate(w.project_title, { id: p.id }),
      cmd: fillTemplate(w.project_cmd, { id: p.id }),
      title: plain(p.title),
      line: plain([v.stat, p.tagline].filter(Boolean).join(' — ')),
      foot: data.site.domain,
    };
  } else if (page.kind === 'projects') {
    text = {
      bar: w.directory_title,
      cmd: w.directory_cmd,
      title: w.directory_heading,
      line: plain(data.projects.map((p) => p.title).join(' · ')),
      foot: data.site.domain,
    };
  } else {
    text = {
      bar: plain(data.copy.hero.terminal_title),
      cmd: data.copy.hero.cmd_whoami,
      title: plain(data.head.title),
      line: plain(data.hero.whoami),
      foot: data.site.domain,
    };
  }
  const png = await renderCard(text, theme, locale);
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
