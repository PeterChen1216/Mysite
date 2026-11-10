import { readFileSync } from 'node:fs';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { list, parseYaml, singleton, translatedCopy } from './content/parsers';
import { strictFile } from './content/strict-file';
import { TRANSLATED_LOCALES } from './i18n/locales';
import {
  aviationSchema,
  educationSchema,
  experienceSchema,
  honorSchema,
  interestsSchema,
  profileSchema,
  projectSchema,
  projectTranslationSchema,
  proseSchema,
  proseTranslationSchema,
  siteSchema,
  skillsSchema,
  copySchema,
  translatedCopySchema,
} from './content/schema';

/** copy.yaml as written, for the key check of the translated copy files. */
const englishCopy = () => parseYaml(readFileSync('content/copy.yaml', 'utf8'));
/** A translation twin's id: its file name without `.md` (`clock-stamp.zh-hans`). */
const twinId = ({ entry }: { entry: string }) => entry.replace(/\.md$/, '');
const twins = (names: string) => TRANSLATED_LOCALES.map((l) => `${names}.${l}.md`);

// Paths are relative to the project root. Owners only ever edit content/ (PLAN §7).
export const collections = {
  site: defineCollection({
    loader: strictFile('content/site.yaml', singleton('site')),
    schema: siteSchema,
  }),
  profile: defineCollection({
    loader: strictFile('content/profile.yaml', singleton('profile')),
    schema: ({ image }) => profileSchema(image),
  }),
  education: defineCollection({
    loader: strictFile('content/education.yaml', list('education.yaml')),
    schema: educationSchema,
  }),
  experience: defineCollection({
    loader: strictFile('content/experience.yaml', list('experience.yaml')),
    schema: ({ image }) => experienceSchema(image),
  }),
  honors: defineCollection({
    loader: strictFile('content/honors.yaml', list('honors.yaml')),
    schema: honorSchema,
  }),
  interests: defineCollection({
    loader: strictFile('content/interests.yaml', singleton('interests')),
    schema: interestsSchema,
  }),
  copy: defineCollection({
    loader: strictFile('content/copy.yaml', singleton('copy')),
    schema: copySchema,
  }),
  // Interface copy per translated locale: every key of copy.yaml (PLAN-EXPERIENCE §5.3).
  copy_zh_hans: defineCollection({
    loader: strictFile(
      'content/copy.zh-hans.yaml',
      translatedCopy('copy.zh-hans.yaml', englishCopy),
    ),
    schema: translatedCopySchema,
  }),
  copy_zh_hant: defineCollection({
    loader: strictFile(
      'content/copy.zh-hant.yaml',
      translatedCopy('copy.zh-hant.yaml', englishCopy),
    ),
    schema: translatedCopySchema,
  }),
  skills: defineCollection({
    loader: strictFile('content/skills.yaml', singleton('skills')),
    schema: skillsSchema,
  }),
  aviation: defineCollection({
    loader: strictFile('content/aviation.yaml', singleton('aviation')),
    schema: aviationSchema,
  }),
  projects: defineCollection({
    // id = file name exactly (e.g. clock-stamp.md → clock-stamp), never a slugified guess,
    // so two files can't collapse into one id and /projects/<id> URLs (M3) stay stable.
    loader: glob({
      pattern: ['*.md', ...twins('!*')],
      base: 'content/projects',
      generateId: ({ entry }) => entry.replace(/\.md$/, ''),
    }),
    schema: ({ image }) => projectSchema(image),
  }),
  // A project's translations: projects/<id>.zh-hans.md, id `<id>.zh-hans`.
  project_translations: defineCollection({
    loader: glob({ pattern: twins('*'), base: 'content/projects', generateId: twinId }),
    schema: projectTranslationSchema,
  }),
  prose: defineCollection({
    loader: glob({ pattern: ['about.md', 'now.md'], base: 'content' }),
    schema: proseSchema,
  }),
  // about.zh-hans.md and the like, id `about.zh-hans`.
  prose_translations: defineCollection({
    loader: glob({ pattern: twins('{about,now}'), base: 'content', generateId: twinId }),
    schema: proseTranslationSchema,
  }),
};
