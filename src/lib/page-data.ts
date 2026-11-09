/**
 * Everything the voxel page shows, gathered once at build time. Sections receive this object and
 * only lay it out; every fact is taken from content/ directly or computed by src/lib/derive.ts.
 */
import { getEntry } from 'astro:content';
import { contentStamp, formatVersion } from './build-info';
import {
  getAviation,
  getCommunity,
  getCopy,
  getEducation,
  getExperience,
  getHonors,
  getInterests,
  getProfile,
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
  pingLines,
  projectBadge,
  tickerItems,
  whoamiLine,
} from './derive';
import { copyrightYears } from './format';
import { withBase } from './paths';

/** Bullet lines of now.md (HTML comments ignored). */
async function nowLines(): Promise<string[]> {
  const entry = await getEntry('prose', 'now');
  return (entry?.body ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean);
}

export async function getPageData() {
  const [
    site,
    copy,
    profile,
    education,
    experience,
    community,
    honors,
    interests,
    skills,
    aviation,
    projectEntries,
    about,
    now,
  ] = await Promise.all([
    getSite(),
    getCopy(),
    getProfile(),
    getEducation(),
    getExperience(),
    getCommunity(),
    getHonors(),
    getInterests(),
    getSkills(),
    getAviation(),
    getProjects(),
    getProse('about'),
    nowLines(),
  ]);

  const edu = education[0]!;
  const primaryEmail = profile.emails.find((e) => e.primary)!.address;
  const publicEmails = profile.emails.filter((e) => e.public).map((e) => e.address);
  const github = profile.socials.find((s) => s.network === 'github');
  const linkedin = profile.socials.find((s) => s.network === 'linkedin');
  const projects = await Promise.all(
    projectEntries.map(async (p) => ({ id: p.id, ...p.data, Body: (await render(p)).Content })),
  );
  const projectFacts = projects.map((p) => ({ ...p, links: p.links }));
  const featured = projects.find((p) => p.featured) ?? projects[0]!;
  const building = nowProject(projectFacts);
  const stamp = contentStamp();
  const year = new Date().getFullYear();
  const templateVars = {
    first: profile.name.display.split(' ')[0],
    city: profile.location.split(',')[0]?.trim(),
    major: edu.major,
    department: edu.department,
    school: edu.school,
    short: edu.short,
  };

  return {
    site,
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
    now,
    links: {
      resume: withBase('resume.pdf'),
      email: `mailto:${primaryEmail}`,
      github: github?.url,
      linkedin: linkedin?.url,
    },
    primaryEmail,
    publicEmails,
    socials: profile.socials.map((s) => ({ ...s, display: displayUrl(s.url) })),
    githubHandle: githubHandle(profile.socials),
    hero: {
      eyebrow: heroEyebrow(profile.name.display, edu, profile.location),
      whoami: whoamiLine(profile.name.full, edu, copy.labels.class_of),
      tags: interests.items.map((i) => i.tag).filter((t): t is string => Boolean(t)),
      gpaBadge: gpaBadge(edu, honors),
      projectBadge: projectBadge(featured),
      avgeekBadge: aviation.watching[0]
        ? `AvGeek  ✈  ${aviation.watching[0].from} ⇄ ${aviation.watching[0].to}`
        : copy.hero.avgeek_badge,
    },
    ticker: tickerItems({
      edu,
      honors,
      projects: projectFacts,
      experience,
      interests: interests.items,
      now,
      email: primaryEmail,
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
    /** copy.yaml strings with {placeholders} filled from content (no facts live in copy.yaml). */
    navStatus: fillTemplate(copy.nav.status, templateVars),
    whoamiTitle: fillTemplate(copy.about.whoami_title, templateVars),
    ping: pingLines(primaryEmail),
    footer: {
      copyright: `${copyrightYears(site.footer.copyright_start, year)} ${site.footer.copyright_holder}`,
      version: formatVersion(site.version, stamp),
      updated: stamp.date,
    },
  };
}

export type PageData = Awaited<ReturnType<typeof getPageData>>;
