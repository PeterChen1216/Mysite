/**
 * Zod schemas for everything under content/ (PLAN §4.3, §7.1, appendix A).
 *
 * Rules:
 * - Every object is `.strict()`: a misspelled field name fails the build instead of being ignored.
 * - Facts a recruiter may verify (education, experience, honors) require a `source`.
 * - Image fields are built by factories that receive Astro's `image()` helper, so the same
 *   schemas can be unit-tested with a plain string stand-in.
 *
 * Keep this file free of `astro:*` virtual imports so Vitest can load it directly.
 */
import { z } from 'astro/zod';
import { LOCALE_STATES } from '../i18n/locales';
import { BODY, HASH, PROJECT_FIELDS, fieldsOf, translatedFields, type Fields } from '../i18n/translations';
import { isTimeZone } from '../lib/world-clock';
import { MOTION_LEVELS, THEMES } from '../prefs/model';

/** Astro's `image()` schema helper (or a stand-in in tests); generic so the image type flows through. */
export type ImageHelper<I extends z.ZodType = z.ZodType> = () => I;

const text = z.string().trim().min(1);
/** Free text that YAML may parse as a number (e.g. `aircraft: 787`). */
const looseText = z.union([z.number(), z.string()]).transform(String).pipe(text);
const httpUrl = z.url({ protocol: /^https?$/ });
/** `YYYY-MM`, e.g. `2024-07`. */
export const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the YYYY-MM format, e.g. 2024-07');
/** An IANA time zone name, e.g. `America/Los_Angeles` (checked at build time). */
const timeZone = text.refine(isTimeZone, {
  message: 'Use an IANA time zone name, e.g. America/Los_Angeles',
});
const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'Use MAJOR.MINOR.PATCH, e.g. 0.1.0');
/** Where a fact comes from (PLAN §7.5). Free text: a link or a short note. */
const source = text;
/** Loaders inject an `id`; owners never need to write one. */
const id = z.string().optional();

// ------------------------------------------------------------ translations
// PLAN-EXPERIENCE §5.3–5.4, src/i18n/translations.ts: a `zh-hans:` / `zh-hant:` block next to the
// English fields holds their translations, `from:` (the hash of each one's source) and `draft:`.
/** A recorded source hash (`pnpm content:stale` prints the one to write). */
const sourceHashSchema = z
  .string()
  .regex(HASH, 'Use the 8-character hash `pnpm content:stale` prints (e.g. 3fa9c21e)');

/**
 * The block that translates `fields` (each optional: a field left out falls back to English);
 * `extra` names more things `from:` and `draft:` may list (a translated file's `body`).
 */
export function translationBlock(fields: Fields, extra: readonly string[] = []) {
  const names = [...Object.keys(fields), ...extra] as [string, ...string[]];
  const values = Object.fromEntries(
    Object.entries(fields).map(([k, kind]) => [
      k,
      (kind === 'text' ? text : z.array(text).min(1)).optional(),
    ]),
  );
  const present = (b: Record<string, unknown>, k: string) => extra.includes(k) || b[k] !== undefined;
  return z
    .object({
      ...values,
      from: z.partialRecord(z.enum(names), sourceHashSchema).optional(),
      draft: z.union([z.literal(true), z.array(z.enum(names)).min(1)]).optional(),
    })
    .strict()
    .refine((b) => !Array.isArray(b.draft) || b.draft.every((k) => present(b, k)), {
      message: '`draft:` lists a field this block does not translate',
    })
    .refine((b) => Object.keys(b.from ?? {}).every((k) => present(b, k)), {
      message: '`from:` lists a field this block does not translate',
    })
    .refine((b) => translatedFields(b).length > 0 || extra.length > 0, {
      message: 'an empty translation block: remove it, or add the translated fields',
    });
}

/** The two optional translation blocks of an object whose `fields` have language. */
const translations = (fields: Fields) => ({
  'zh-hans': translationBlock(fields).optional(),
  'zh-hant': translationBlock(fields).optional(),
});

// ---------------------------------------------------------------- site.yaml
export const siteSchema = z
  .object({
    id,
    domain: z
      .string()
      .regex(
        /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i,
        'Hostname only, e.g. zhic.me (no https://, no slash)',
      ),
    version: semver,
    /** false → legacy site stays at "/", v2 is served from /v2/ (DECISIONS Q1). */
    launched: z.boolean(),
    /**
     * Each language: `live` (listed and indexed) or `preview` (built at its address but hidden,
     * with a draft notice). English is always live; a live language may hold no draft.
     */
    locales: z
      .object({
        en: z.literal('live', { message: 'English is the source language: it is always live' }),
        'zh-hans': z.enum(LOCALE_STATES),
        'zh-hant': z.enum(LOCALE_STATES),
      })
      .strict(),
    features: z.object({ scene: z.boolean() }).strict(),
    meta: z
      .object({
        title: text,
        description: text,
        keywords: z.array(text).default([]),
        ...translations(fieldsOf('site.yaml', ['meta'])),
      })
      .strict(),
    footer: z
      .object({
        copyright_holder: text,
        copyright_start: z.number().int().min(2000).max(2100),
        update_note: text.optional(),
        ...translations(fieldsOf('site.yaml', ['footer'])),
      })
      .strict(),
  })
  .strict();

// ------------------------------------------------------------- profile.yaml
const emailEntry = z
  .object({
    address: z.email(),
    label: text.optional(),
    primary: z.boolean().default(false),
    /** DECISIONS R2-1: the hero shows the primary address; Contact shows every `public: true` one. */
    public: z.boolean().default(false),
  })
  .strict();

const socialEntry = z
  .object({
    network: z.enum(['github', 'linkedin', 'x', 'website', 'other']),
    label: text,
    url: httpUrl,
  })
  .strict();

export const profileSchema = <I extends z.ZodType>(image: ImageHelper<I>) =>
  z
    .object({
      id,
      name: z
        .object({
          display: text,
          full: text,
          zh: text.optional(),
        })
        .strict(),
      tagline: text,
      location: text,
      status: text,
      emails: z
        .array(emailEntry)
        .min(1)
        .refine((list) => list.filter((e) => e.primary).length === 1, {
          message: 'Exactly one email must have `primary: true`',
        })
        .refine((list) => list.every((e) => !e.primary || e.public), {
          message: 'The primary email must be `public: true`',
        }),
      socials: z.array(socialEntry).default([]),
      avatar: image(),
      avatar_alt: text,
      ...translations(fieldsOf('profile.yaml', [])),
    })
    .strict();

// ----------------------------------------------------------- education.yaml
export const educationSchema = z
  .object({
    id,
    school: text,
    /** Short label for tight spots, e.g. "UW iSchool". */
    short: text.optional(),
    url: httpUrl.optional(),
    department: text.optional(),
    department_url: httpUrl.optional(),
    degree: text,
    /** The subject alone, e.g. "Informatics" (used in one-line summaries). */
    major: text.optional(),
    track: text.optional(),
    minor: text.optional(),
    start: yearMonth,
    end: yearMonth,
    /** true while `end` is an expected (not yet reached) graduation date. */
    expected: z.boolean().default(false),
    gpa: z
      .string()
      .regex(/^\d\.\d{1,2}\/\d\.\d{1,2}$/, 'Use the form 3.81/4.0')
      .optional(),
    /** How the GPA is labelled (e.g. "Cumulative GPA"); without it, copy.yaml `labels.gpa`. */
    gpa_label: text.optional(),
    honors: z.array(text).default([]),
    coursework: z.array(text).default([]),
    source,
    ...translations(fieldsOf('education.yaml')),
  })
  .strict()
  .refine((e) => e.start <= e.end, { message: '`start` must not be after `end`' });

// ---------------------------------------------------------- experience.yaml
export const experienceSchema = <I extends z.ZodType>(image: ImageHelper<I>) =>
  z
    .object({
      id,
      company: text,
      role: text,
      kind: z.enum(['internship', 'full-time', 'part-time', 'research', 'volunteer']).optional(),
      start: yearMonth,
      end: yearMonth.or(z.literal('present')),
      location: text,
      url: httpUrl.optional(),
      logo: image().optional(),
      /** Optional: logos render as decorative next to the company name. */
      logo_alt: text.optional(),
      /** PLAN appendix A suggests 1–3; up to 5 are accepted so résumé bullets migrate verbatim. */
      highlights: z.array(text).min(1).max(5),
      source,
      ...translations(fieldsOf('experience.yaml')),
    })
    .strict()
    .refine((e) => e.end === 'present' || e.start <= e.end, {
      message: '`start` must not be after `end`',
    });

// -------------------------------------------------------------- honors.yaml
export const honorSchema = z
  .object({
    id,
    name: text,
    org: text,
    /** A year (`2025`) or an academic year (`2024-2025`). */
    year: z
      .union([z.number().int(), z.string()])
      .transform(String)
      .pipe(z.string().regex(/^\d{4}(-\d{4})?$/, 'Use 2025 or 2024-2025')),
    note: text.optional(),
    source,
    ...translations(fieldsOf('honors.yaml')),
  })
  .strict();

// ----------------------------------------------------------- interests.yaml
export const interestsSchema = z
  .object({
    id,
    items: z
      .array(
        z
          .object({
            name: text,
            note: text.optional(),
            /** Short label for the terminal and chips, e.g. "gen-ai". */
            tag: z
              .string()
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words joined by hyphens, e.g. gen-ai')
              .optional(),
            /** An emoji; items with one also appear on the "off the clock" card. */
            icon: z.string().trim().min(1).max(8).optional(),
            ...translations(fieldsOf('interests.yaml', ['items', '*'])),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

// ------------------------------------------------------------ aviation.yaml
// DECISIONS.md "AvGeek 模块重设计": all data hand-curated by the owner; nothing scraped.
const iata = z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter IATA airport code, e.g. SEA');
export const aviationSchema = z
  .object({
    id,
    watching: z
      .array(
        z
          .object({
            from: iata,
            to: iata,
            airline: text,
            aircraft: looseText,
            why: text,
            ...translations(fieldsOf('aviation.yaml', ['watching', '*'])),
          })
          .strict(),
      )
      .max(6)
      .default([]),
    seat_rules: z.array(text).default([]),
    favorite_cabins: z
      .array(
        z
          .object({
            aircraft: looseText,
            cabin: looseText,
            why: text,
            ...translations(fieldsOf('aviation.yaml', ['favorite_cabins', '*'])),
          })
          .strict(),
      )
      .default([]),
    news: z
      .array(
        z
          .object({
            date: z.iso.date(),
            headline: text,
            url: httpUrl,
            ...translations(fieldsOf('aviation.yaml', ['news', '*'])),
          })
          .strict(),
      )
      .default([]),
    fare_examples: z
      .array(
        z
          .object({
            code: z.string().regex(/^[A-Z0-9]{1,15}$/, 'Fare basis codes are A–Z / 0–9'),
            route: text,
            notes: text,
            ...translations(fieldsOf('aviation.yaml', ['fare_examples', '*'])),
          })
          .strict(),
      )
      .default([]),
    tools: z
      .array(
        z
          .object({
            name: text,
            url: httpUrl,
          })
          .strict(),
      )
      .default([]),
    ...translations(fieldsOf('aviation.yaml', [])),
  })
  .strict();

// --------------------------------------------------------- projects/*.md
/** `completed` = a finished course/research project (not a product you keep shipping). */
const projectStatus = z.enum(['idea', 'wip', 'testflight', 'shipped', 'completed', 'archived']);

export const projectSchema = <I extends z.ZodType>(image: ImageHelper<I>) =>
  z
    .object({
      title: text,
      /** One line in your own words. Optional: leave it out rather than invent one. */
      tagline: text.max(120).optional(),
      status: projectStatus,
      platform: z.array(z.enum(['ios', 'web', 'cli', 'research'])).min(1),
      /** Your role, as written on the résumé, e.g. "Group Leader, University of Washington, INFO 494". */
      role: text.optional(),
      location: text.optional(),
      start: yearMonth.optional(),
      end: yearMonth.or(z.literal('present')).optional(),
      links: z
        .object({
          appstore: httpUrl.optional(),
          repo: httpUrl.optional(),
          live: httpUrl.optional(),
          /** Any other link, shown with its own label (e.g. a lab or course page). */
          other: z
            .array(z.object({ label: text, url: httpUrl }).strict())
            .default([]),
        })
        .strict()
        .optional(),
      /** Small square icon (pixel art welcome), decorative. */
      icon: image().optional(),
      cover: image().optional(),
      cover_alt: text.optional(),
      stack: z.array(text).max(8).default([]),
      year: z.number().int().min(2000).max(2100),
      featured: z.boolean().default(false),
      /**
       * A live miniature of the product, drawn beside the project when it is the featured one.
       * `world-clock`: the phone with a 24-hour dial (copy.yaml `projects.phone`).
       */
      demo: z.enum(['world-clock']).optional(),
      source,
    })
    .strict()
    .refine((p) => !p.cover || !!p.cover_alt, { message: '`cover_alt` is required with `cover`' })
    .refine((p) => !p.end || !!p.start, { message: '`end` needs a `start`' })
    .refine((p) => !p.start || !!p.end, { message: '`start` needs an `end` (YYYY-MM or present)' })
    .refine((p) => !p.start || !p.end || p.end === 'present' || p.start <= p.end, {
      message: '`start` must not be after `end`',
    });

// --------------------------------------------------------------- skills.yaml
export const skillsSchema = z
  .object({
    id,
    groups: z
      .array(
        z
          .object({
            name: text,
            items: z.array(looseText).min(1),
            /** Shown after a semicolon as "; basic …" (e.g. Java). */
            basic: z.array(looseText).default([]),
            ...translations(fieldsOf('skills.yaml', ['groups', '*'])),
          })
          .strict(),
      )
      .min(1),
    source,
  })
  .strict();

// ----------------------------------------------------------------- copy.yaml
// Interface text from the Figma design. Facts never live here (PLAN §2.4).
const lines = z.array(text).min(1);
const navLink = z.object({ label: text, href: text }).strict();
const prefOption = z.object({ name: text, note: text }).strict();
export const copySchema = z
  .object({
    id,
    nav: z
      .object({
        links: z.array(navLink).min(1),
        status: text,
        resume: text,
        say_hi: text,
        /** Screen-reader names of the logo link and of the section links. */
        logo_label: text,
        sections_label: text,
      })
      .strict(),
    hero: z
      .object({
        /** [brackets] mark the highlighted word. */
        headline: lines,
        terminal_title: text,
        cmd_whoami: text,
        cmd_interests: text,
        ok: text,
        summon: text,
        /** The answer to /summon; {status} = profile.yaml `status`. */
        summon_ok: text,
        /** {name} = full name, {programme} = major · track, {year} = class year (’27). */
        whoami_line: text,
        cta_projects: text,
        cta_resume: text,
        eyebrow_prefix: text,
        /** The hero globe as a keyboard slider: its name, and its value ({deg} = degrees turned). */
        globe_label: text,
        globe_value: text,
        avgeek_badge: text,
        /** Badge once aviation.yaml `watching` has a route; {from} and {to} are its airports. */
        avgeek_route: text,
      })
      .strict(),
    ticker: z
      .object({
        /** Screen-reader name of the band. */
        label: text,
        /** Tag words; platform and interest tags come from content. */
        tags: z.object({ xp: text, now: text, work: text, ping: text, edu: text }).strict(),
      })
      .strict(),
    about: z
      .object({
        cmd: text,
        title: lines,
        blurb: text,
        whoami_title: text,
        card_whoami: text,
        card_gpa: text,
        card_now: text,
        card_education: text,
        card_off: text,
        card_avgeek: text,
        card_skills: text,
        avgeek_title: text,
        now_link: text,
        skills_basic: text,
        gpa_out_of: text,
        track_suffix: text,
        minor_prefix: text,
        coursework: text,
        /** Panel headings, keyed like aviation.yaml. */
        avgeek_panels: z
          .object({
            watching: text,
            seat_rules: text,
            favorite_cabins: text,
            news: text,
            fare_examples: text,
            tools: text,
          })
          .strict(),
      })
      .strict(),
    projects: z
      .object({
        cmd: text,
        title: lines,
        blurb: text,
        featured: text,
        stack_label: text,
        /** Status terminal title; the featured project's id is appended (`~/projects/<id>`). */
        status_title: text,
        status_cmd: text,
        link_appstore: text,
        link_repo: text,
        link_live: text,
        next_label: text,
        next_title: text,
        next_body: text,
        next_tags: z.array(text).default([]),
        next_progress: text,
        /**
         * The phone drawn beside a project with `demo: world-clock` (decorative, aria-hidden): a
         * 24-hour dial with one hand per city, after the app's own clock face.
         */
        phone: z
          .object({
            /** The viewer's "here": the status-bar clock, the arrow hand, and what +16h counts from. */
            home_zone: timeZone,
            /**
             * 1–4 cities, each a mark on the dial: its `code` (an airport-style code such as FRA)
             * or, without one, its name. The first city that is not in the home zone is the
             * selected one (name, big clock, date); a city in the home zone is the "here" hand.
             */
            cities: z
              .array(
                z
                  .object({
                    code: z
                      .string()
                      .regex(/^[A-Z]{3}$/, 'Use a 3-letter code, e.g. FRA')
                      .optional(),
                    name: text.max(12),
                    time_zone: timeZone,
                  })
                  .strict(),
              )
              .min(1)
              .max(4),
            /** Under the date, where the app names its weather source. */
            weather: text,
            /** The 24-hour switch and the two tabs at the bottom. */
            hours: text,
            tab_list: text,
            tab_clock: text,
          })
          .strict(),
      })
      .strict(),
    experience: z
      .object({
        cmd: text,
        title: lines,
        blurb: text,
        head_hint: text,
        head_dates: text,
        /** Heading of the community log (volunteer entries), shown below the commit history. */
        community_cmd: text,
        community_title: text,
      })
      .strict(),
    contact: z
      .object({
        cmd: text,
        title: lines,
        say_hi: text,
        github: text,
        linkedin: text,
        resume: text,
        /** Title bar of the ping terminal. */
        terminal_title: text,
        /** The ping terminal's output (the reply line is green) and its last command. */
        ping: z.object({ request: text, reply: text, summary: text }).strict(),
        open_cmd: text,
        /** Shown before the list of public email addresses. */
        emails_label: text,
      })
      .strict(),
    footer: z
      .object({
        tagline: text,
        back_to_top: text,
        rights: text,
        updated: text,
        /** The footer button that opens the settings window. */
        prefs: text,
      })
      .strict(),
    /** The settings window (PLAN-EXPERIENCE §2.1) and the nav keys that open it and pause. */
    prefs: z
      .object({
        open_label: text,
        pause_label: text,
        title: text,
        heading: text,
        intro: text,
        close: text,
        reset_cmd: text,
        reset: text,
        theme: z
          .object({
            cmd: text,
            legend: text,
            /** Every theme, and `auto`: a plain name and a note (the in-world name). */
            options: z.record(z.enum([...THEMES, 'auto']), prefOption),
            contrast_note: text,
          })
          .strict(),
        motion: z
          .object({
            cmd: text,
            legend: text,
            options: z.record(z.enum([...MOTION_LEVELS, 'auto']), prefOption),
            reduced_note: text,
          })
          .strict(),
        /** `option` is a template: {size} = 100, 115 or 130. */
        text: z.object({ cmd: text, legend: text, option: text }).strict(),
        keys: z.object({ cmd: text, legend: text, on: text, off: text, note: text }).strict(),
        /** The language row: one link per language, each named in its own language. */
        lang: z.object({ cmd: text, legend: text, note: text, draft: text }).strict(),
      })
      .strict(),
    labels: z
      .object({
        now: text,
        /** End of an ongoing project on its card (`Mar 2026 – Present`). */
        present: text,
        expected: text,
        /** Short GPA label on the hero badge. */
        gpa: text,
        /** Month names, January first, and how a month is written with its year. */
        months: z.array(text).length(12),
        /** {month} and {year}: `{month} {year}` → "Mar 2027". */
        year_month: text,
        /** Between the items of a list (skills, a project's stack and platforms). */
        list_separator: z.string().min(1),
        /** One word per project platform (projects/*.md `platform`). */
        platform: z.record(z.enum(['ios', 'web', 'cli', 'research']), text),
        /** One word per project status (every status in projects/*.md needs one). */
        status: z.record(projectStatus, text),
        new_tab: text,
        skip_link: text,
      })
      .strict(),
    /** Languages (PLAN-EXPERIENCE §5): this file's language and the notices about languages. */
    i18n: z
      .object({
        /** This language's own name (English, 简体中文, 繁體中文). */
        name: text,
        /** Shown on every page of a language that is still a preview. */
        preview_notice: text,
        preview_link: text,
        /** The first-visit suggestion, in this language, shown on the other languages' pages. */
        suggest: text,
        suggest_go: text,
        suggest_dismiss: text,
        suggest_label: text,
      })
      .strict(),
    /**
     * The WebGL scene (PLAN-EXPERIENCE §7). The canvas is decorative and says nothing; `hud` is the
     * `?debug=1` line: {fps} {ms} {tier} {reason} {draws} {dpr}.
     */
    scene: z.object({ hud: text }).strict(),
  })
  .strict();

// ------------------------------------------- copy.zh-hans.yaml / copy.zh-hant.yaml
/**
 * A translated copy file: every key of copy.yaml (src/content/parsers.ts `translatedCopy` also
 * fails the build on a missing or extra key, defaults included), plus the block's `from:` (copy
 * key → source hash) and `draft:` (`true`, or the keys still drafts; a key covers the keys under it).
 */
export const translatedCopySchema = copySchema.extend({
  from: z.record(z.string(), sourceHashSchema).optional(),
  draft: z.union([z.literal(true), z.array(text).min(1)]).optional(),
});

// ---------------------------------------------- projects/<id>.zh-hans.md (twins)
/** A project's translation: its frontmatter is the block, its body the translated bullets. */
export const projectTranslationSchema = translationBlock(PROJECT_FIELDS, [BODY]);

// ------------------------------------------------ about.md / now.md (no frontmatter)
export const proseSchema = z.object({}).strict();
/** about.zh-hans.md and the like: the body is the translation; frontmatter `from:` / `draft:`. */
export const proseTranslationSchema = translationBlock({}, [BODY]);

export type Site = z.infer<typeof siteSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Honor = z.infer<typeof honorSchema>;
export type Interests = z.infer<typeof interestsSchema>;
export type Aviation = z.infer<typeof aviationSchema>;
export type Skills = z.infer<typeof skillsSchema>;
export type Copy = z.infer<typeof copySchema>;
export type TranslatedCopy = z.infer<typeof translatedCopySchema>;
export type Project = z.infer<ReturnType<typeof projectSchema>>;
