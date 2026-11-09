import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { list, singleton } from './content/parsers';
import { strictFile } from './content/strict-file';
import {
  aviationSchema,
  educationSchema,
  experienceSchema,
  honorSchema,
  interestsSchema,
  profileSchema,
  projectSchema,
  proseSchema,
  siteSchema,
  skillsSchema,
} from './content/schema';

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
      pattern: '*.md',
      base: 'content/projects',
      generateId: ({ entry }) => entry.replace(/\.md$/, ''),
    }),
    schema: ({ image }) => projectSchema(image),
  }),
  prose: defineCollection({
    loader: glob({ pattern: ['about.md', 'now.md'], base: 'content' }),
    schema: proseSchema,
  }),
};
