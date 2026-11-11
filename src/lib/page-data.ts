/**
 * Everything the voxel page shows, gathered once per locale at build time. Sections receive this
 * object and only lay it out; every fact is taken from content/ directly or computed by
 * src/lib/derive.ts.
 *
 * On a translated page (PLAN-EXPERIENCE §5.3) each fact with language comes from its
 * translation, or is the English text marked as a fallback (src/i18n/fallback.ts: shown with
 * `lang="en"`); facts without language are the same on every page. A `live` locale with any
 * draft translation fails the build (content/site.yaml `locales`).
 */
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../i18n/locales';
import { markFallback } from '../i18n/fallback';
import {
  headLinks,
  liveLocales,
  localeHome,
  ogImagePath,
  pagePath,
  switchLocales,
  type SitePage,
} from '../i18n/routing';
import {
  BODY,
  PROJECT_FIELDS,
  assertNoDrafts,
  fieldsOf,
  isDraft,
  localize,
  type Block,
  type Fields,
  type LocalizeHooks,
} from '../i18n/translations';
import { contentStamp, formatVersion } from './build-info';
import { downloadName, resumeInfo } from './resume';
import {
  getAviation,
  getCommunity,
  getCopy,
  getEducation,
  getExperience,
  getHonors,
  getInterests,
  getLanguageWords,
  getNowLines,
  getProfile,
  getProjectTranslation,
  getProjects,
  getProse,
  getSite,
  getSkills,
  render,
} from './content';
import {
  displayUrl,
  experienceRows,
  fillTemplate,
  gitLog,
  githubHandle,
  gpaBadge,
  heroEyebrow,
  nowProject,
  projectBadge,
  tagSlug,
  tickerItems,
  whoamiLine,
  withGpaLabel,
} from './derive';
import { copyrightYears } from './format';
import { withBase } from './paths';
import { personJsonLd } from './seo';

/**
 * `page` is the page being built (M3: the home page, the projects directory or a project's page):
 * its head links, its language links and the preview notice's link point at the same page in the
 * other locales.
 */
export async function getPageData(
  locale: Locale = DEFAULT_LOCALE,
  page: SitePage = { kind: 'home' },
) {
  const [
    site,
    profileEn,
    educationEn,
    experienceEn,
    communityEn,
    honorsEn,
    interestsEn,
    skillsEn,
    aviationEn,
    projectEntries,
  ] = await Promise.all([
    getSite(),
    getProfile(),
    getEducation(),
    getExperience(),
    getCommunity(),
    getHonors(),
    getInterests(),
    getSkills(),
    getAviation(),
    getProjects(),
  ]);

  // ---- every fact in this page's language (English stays as written)
  const drafts: string[] = [];
  const hooks = (file: string): LocalizeHooks => ({
    mark: markFallback,
    draft: (field) => drafts.push(`content/${file}: ${field}`),
  });
  const L = <T extends object>(obj: T, fields: Fields, file: string) =>
    localize(obj, fields, locale, hooks(file));
  const each = <T extends object>(list: T[], file: string, at?: string[]) =>
    list.map((x) => L(x, fieldsOf(file, at), file));

  const meta = L(site.meta, fieldsOf('site.yaml', ['meta']), 'site.yaml');
  const siteFooter = L(site.footer, fieldsOf('site.yaml', ['footer']), 'site.yaml');
  const profile = L(profileEn, fieldsOf('profile.yaml', []), 'profile.yaml');
  const educationEntries = each(educationEn, 'education.yaml');
  const experience = each(experienceEn, 'experience.yaml');
  const community = each(communityEn, 'experience.yaml');
  const honors = each(honorsEn, 'honors.yaml');
  const interests = {
    ...interestsEn,
    items: each(interestsEn.items, 'interests.yaml', ['items', '*']),
  };
  const skills = { ...skillsEn, groups: each(skillsEn.groups, 'skills.yaml', ['groups', '*']) };
  const aviationTop = L(aviationEn, fieldsOf('aviation.yaml', []), 'aviation.yaml');
  const aviation = {
    ...aviationTop,
    watching: each(aviationEn.watching, 'aviation.yaml', ['watching', '*']),
    favorite_cabins: each(aviationEn.favorite_cabins, 'aviation.yaml', ['favorite_cabins', '*']),
    news: each(aviationEn.news, 'aviation.yaml', ['news', '*']),
    fare_examples: each(aviationEn.fare_examples, 'aviation.yaml', ['fare_examples', '*']),
  };
  const onDraft = (where: string) => drafts.push(where);

  const edu0 = educationEntries[0]!;
  const primaryEmail = profile.emails.find((e) => e.primary)!.address;
  const copy = await getCopy(
    locale,
    {
      displayName: profile.name.display,
      location: profile.location,
      domain: site.domain,
      email: primaryEmail,
      edu: edu0,
    },
    onDraft,
  );

  const projects = await Promise.all(
    projectEntries.map(async (p) => {
      // A project's translation is a twin file: its frontmatter is the block, its body the text.
      const twin = locale === 'en' ? undefined : await getProjectTranslation(p.id, locale);
      const file = `projects/${p.id}.${locale}.md`;
      const block = twin?.data as Block | undefined;
      const data = localize(p.data, PROJECT_FIELDS, locale, hooks(file), block);
      if (isDraft(block, BODY)) onDraft(`content/${file}: ${BODY}`);
      return {
        id: p.id,
        ...data,
        Body: (await render(twin ?? p)).Content,
        /** The body as written (Markdown), for a page's description. */
        body: (twin ?? p).body,
        /** `en` when the body is the English text on a translated page. */
        bodyLang: locale !== 'en' && !twin ? ('en' as const) : undefined,
      };
    }),
  );
  const [about, now, i18n] = await Promise.all([
    getProse('about', locale, onDraft),
    getNowLines(locale, onDraft),
    getLanguageWords(),
  ]);

  assertNoDrafts(locale, site.locales, drafts);

  const education = withGpaLabel(educationEntries, copy.labels.gpa);
  const edu = education[0]!;
  const publicEmails = profile.emails.filter((e) => e.public).map((e) => e.address);
  const github = profile.socials.find((s) => s.network === 'github');
  const linkedin = profile.socials.find((s) => s.network === 'linkedin');
  const featured = projects.find((p) => p.featured) ?? projects[0]!;
  const building = nowProject(projects);
  const stamp = contentStamp();
  const year = new Date().getFullYear();
  const route = aviation.watching[0];
  const nowText = now.english ? now.lines.map(markFallback) : now.lines;

  return {
    locale,
    lang: LOCALES[locale].lang,
    /** content/site.yaml `locales`: whether this page and every other language is live. */
    states: site.locales,
    preview: site.locales[locale] === 'preview',
    home: localeHome(locale, import.meta.env.BASE_URL),
    /** The page being built, and where the projects directory and each project page live. */
    page,
    paths: {
      projects: pagePath(locale, { kind: 'projects' }, import.meta.env.BASE_URL),
      project: (id: string) => pagePath(locale, { kind: 'project', id }, import.meta.env.BASE_URL),
    },
    head: {
      title: meta.title,
      description: meta.description,
      keywords: meta.keywords,
      ...headLinks(locale, site.locales, `https://${site.domain}`, import.meta.env.BASE_URL, page),
      /**
       * M5: the `Person` JSON-LD, on each locale's home page — from content/ only (src/lib/seo.ts):
       * the English facts (names, school names stay as written: Q-L2), the English home as `url`.
       */
      jsonLd:
        page.kind === 'home'
          ? personJsonLd({
              name: profileEn.name.display,
              fullName: profileEn.name.full,
              url: new URL(
                pagePath(DEFAULT_LOCALE, { kind: 'home' }, import.meta.env.BASE_URL),
                `https://${site.domain}`,
              ).href,
              sameAs: profileEn.socials.map((s) => s.url),
              schools: educationEn.map((e) => ({
                name: e.school,
                url: e.url,
                current: !!e.expected,
              })),
            })
          : undefined,
      /** The page's share card (src/pages/og/), in the default theme (none on the 404). */
      image: new URL(ogImagePath(locale, page, import.meta.env.BASE_URL), `https://${site.domain}`)
        .href as string | undefined,
    },
    site: { ...site, meta, footer: siteFooter },
    copy,
    profile,
    edu,
    education,
    experience,
    community,
    honors,
    interests,
    skills,
    aviation,
    projects,
    featured,
    building,
    About: about.Content,
    aboutLang: about.lang,
    now: nowText,
    /** The education track as a chip tag, from the English track on every page. */
    trackTag: educationEn[0]?.track ? tagSlug(educationEn[0].track) || undefined : undefined,
    links: {
      resume: withBase('resume.pdf'),
      /** What the download is saved as: whose résumé, and which (src/lib/resume.ts). */
      resumeFile: downloadName(profile.name.display, resumeInfo().date),
      email: `mailto:${primaryEmail}`,
      github: github?.url,
      linkedin: linkedin?.url,
    },
    primaryEmail,
    publicEmails,
    socials: profile.socials.map((s) => ({ ...s, display: displayUrl(s.url) })),
    githubHandle: githubHandle(profile.socials),
    hero: {
      eyebrow: heroEyebrow(profile.name.display, edu, profile.location, copy.hero.eyebrow_prefix),
      whoami: whoamiLine(profile.name.full, edu, copy.hero.whoami_line),
      tags: interests.items.map((i) => i.tag).filter((t): t is string => Boolean(t)),
      gpaBadge: gpaBadge(edu, honors, copy.labels.gpa),
      projectBadge: projectBadge(
        featured,
        copy.projects.link_appstore,
        copy.labels.status,
        copy.labels.platform,
      ),
      avgeekBadge: route
        ? fillTemplate(copy.hero.avgeek_route, { from: route.from, to: route.to })
        : copy.hero.avgeek_badge,
      summonOk: fillTemplate(copy.hero.summon_ok, { status: profile.status }),
    },
    ticker: tickerItems({
      edu,
      honors,
      projects,
      experience,
      interests: interests.items,
      now: nowText,
      email: primaryEmail,
      tags: copy.ticker.tags,
      statusLabels: copy.labels.status,
      platformLabels: copy.labels.platform,
    }),
    log: gitLog({
      status: profile.status,
      headHint: copy.experience.head_hint,
      headDates: copy.experience.head_dates,
      experience,
      education,
      nowLabel: copy.labels.now,
      expectedLabel: copy.labels.expected,
    }),
    communityLog: experienceRows(community, copy.labels.now),
    footer: {
      copyright: `${copyrightYears(site.footer.copyright_start, year)} ${site.footer.copyright_holder}`,
      version: formatVersion(site.version, stamp),
      updated: stamp.date,
    },
    /** The settings window's language row: the languages this page offers, in their own words. */
    languages: switchLocales(locale, site.locales).map((l) => ({
      locale: l,
      lang: LOCALES[l].lang,
      hreflang: LOCALES[l].hreflang,
      href: pagePath(l, page, import.meta.env.BASE_URL),
      name: i18n[l].name,
      current: l === locale,
      preview: site.locales[l] === 'preview',
    })),
    /** The first-visit suggestions this page can make: every other live locale, in its words. */
    suggestions: liveLocales(site.locales)
      .filter((l) => l !== locale)
      .map((l) => ({
        locale: l,
        lang: LOCALES[l].lang,
        hreflang: LOCALES[l].hreflang,
        href: pagePath(l, page, import.meta.env.BASE_URL),
        ...i18n[l],
      })),
    /** The English page (the preview notice links to it). */
    english: {
      href: pagePath(DEFAULT_LOCALE, page, import.meta.env.BASE_URL),
      lang: LOCALES.en.lang,
    },
  };
}

export type PageData = Awaited<ReturnType<typeof getPageData>>;
