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
const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'Use MAJOR.MINOR.PATCH, e.g. 0.1.0');
/** Where a fact comes from (PLAN §7.5). Free text: a link or a short note. */
const source = text;
/** Loaders inject an `id`; owners never need to write one. */
const id = z.string().optional();

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
    features: z.object({ scene: z.boolean() }).strict(),
    meta: z
      .object({
        title: text,
        description: text,
        keywords: z.array(text).default([]),
      })
      .strict(),
    footer: z
      .object({
        copyright_holder: text,
        copyright_start: z.number().int().min(2000).max(2100),
        update_note: text.optional(),
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
    /** How the GPA is labelled, e.g. "Cumulative GPA". */
    gpa_label: text.default('GPA'),
    honors: z.array(text).default([]),
    coursework: z.array(text).default([]),
    source,
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
  })
  .strict();

// --------------------------------------------------------- projects/*.md
export const projectSchema = <I extends z.ZodType>(image: ImageHelper<I>) =>
  z
    .object({
      title: text,
      /** One line in your own words. Optional: leave it out rather than invent one. */
      tagline: text.max(120).optional(),
      /** `completed` = a finished course/research project (not a product you keep shipping). */
      status: z.enum(['idea', 'wip', 'testflight', 'shipped', 'completed', 'archived']),
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
export const copySchema = z
  .object({
    id,
    nav: z
      .object({ links: z.array(navLink).min(1), status: text, resume: text, say_hi: text })
      .strict(),
    hero: z
      .object({
        /** [brackets] mark the highlighted word. */
        headline: lines,
        terminal_title: text,
        summon: text,
        summon_ok: text,
        cta_projects: text,
        cta_resume: text,
        avgeek_badge: text,
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
      })
      .strict(),
    projects: z
      .object({
        cmd: text,
        title: lines,
        blurb: text,
        featured: text,
        next_label: text,
        next_title: text,
        next_body: text,
        next_progress: text,
      })
      .strict(),
    experience: z
      .object({
        cmd: text,
        title: lines,
        blurb: text,
        head_hint: text,
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
        /** Shown before the list of public email addresses. */
        emails_label: text,
      })
      .strict(),
    footer: z.object({ tagline: text, back_to_top: text }).strict(),
  })
  .strict();

// ------------------------------------------------ about.md / now.md (no frontmatter)
export const proseSchema = z.object({}).strict();

export type Site = z.infer<typeof siteSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Honor = z.infer<typeof honorSchema>;
export type Interests = z.infer<typeof interestsSchema>;
export type Aviation = z.infer<typeof aviationSchema>;
export type Skills = z.infer<typeof skillsSchema>;
export type Copy = z.infer<typeof copySchema>;
export type Project = z.infer<ReturnType<typeof projectSchema>>;
