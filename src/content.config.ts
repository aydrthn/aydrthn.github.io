import { defineCollection, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const postSchema = ({ image }: SchemaContext) => z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  pubDate: z.coerce.date(),
  lang: z.string().default('en'),
  draft: z.boolean().default(false),
  cover: image().optional(),
  coverAlt: z.string().default(''),
});

export const collections = {
  notes: defineCollection({
    loader: glob({ base: './src/docs/notes', pattern: '**/*.md' }),
    schema: postSchema,
  }),
  essays: defineCollection({
    loader: glob({ base: './src/docs/essays', pattern: '**/*.md' }),
    schema: postSchema,
  }),
  archive: defineCollection({
    loader: glob({ base: './src/docs/archive', pattern: '**/*.md' }),
    schema: postSchema,
  }),
};
