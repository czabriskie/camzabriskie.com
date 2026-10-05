import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const byteSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  draft: z.boolean().default(false),
});

// Primers: grouped by topic folder (primers/<topic>/<slug>.md), read in `order`,
// and revised over time, so they carry `updated` rather than a publish date (Decision 0006).
const primerSchema = z.object({
  title: z.string(),
  description: z.string(),
  order: z.number().int().nonnegative(),
  updated: z.coerce.date(),
  draft: z.boolean().default(false),
});

export const collections = {
  'tech-bytes': defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/tech-bytes' }),
    schema: byteSchema,
  }),
  'life-bytes': defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/life-bytes' }),
    schema: byteSchema,
  }),
  primers: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/primers' }),
    schema: primerSchema,
  }),
};
