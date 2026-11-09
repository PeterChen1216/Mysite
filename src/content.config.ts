import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { list, singleton } from './content/parsers';
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
} from './content/schema';

// Paths are relative to the project root. Owners only ever edit content/ (PLAN §7).
export const collections = {
  site: defineCollection({
    loader: file('content/site.yaml', { parser: singleton('site') }),
    schema: siteSchema,
  }),
  profile: defineCollection({
    loader: file('content/profile.yaml', { parser: singleton('profile') }),
    schema: ({ image }) => profileSchema(image),
  }),
  education: defineCollection({
    loader: file('content/education.yaml', { parser: list('education.yaml') }),
    schema: educationSchema,
  }),
  experience: defineCollection({
    loader: file('content/experience.yaml', { parser: list('experience.yaml') }),
    schema: ({ image }) => experienceSchema(image),
  }),
  honors: defineCollection({
    loader: file('content/honors.yaml', { parser: list('honors.yaml') }),
    schema: honorSchema,
  }),
  interests: defineCollection({
    loader: file('content/interests.yaml', { parser: singleton('interests') }),
    schema: interestsSchema,
  }),
  aviation: defineCollection({
    loader: file('content/aviation.yaml', { parser: singleton('aviation') }),
    schema: aviationSchema,
  }),
  projects: defineCollection({
    loader: glob({ pattern: '*.md', base: 'content/projects' }),
    schema: projectSchema,
  }),
  prose: defineCollection({
    loader: glob({ pattern: ['about.md', 'now.md'], base: 'content' }),
    schema: proseSchema,
  }),
};
