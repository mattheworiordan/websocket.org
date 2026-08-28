import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        author: z.string().optional(),
        authorRole: z.string().optional(),
        date: z.coerce.date().optional(),
        category: z
          .enum([
            'guide',
            'reference',
            'tutorial',
            'news',
            'author',
            'resource',
            'tool',
            'infrastructure',
            'comparison',
          ])
          .optional(),
        tags: z.array(z.string()).optional(),
        faq: z
          .array(
            z.object({
              q: z.string(),
              a: z.string(),
            })
          )
          .optional(),
        howto: z
          .object({
            name: z.string(),
            estimatedCost: z.string().optional(),
            totalTime: z.string().optional(),
            steps: z.array(
              z.object({
                name: z.string(),
                text: z.string(),
              })
            ),
          })
          .optional(),
        seo: z
          .object({
            title: z.string().optional(),
            description: z.string().optional(),
            keywords: z.array(z.string()).optional(),
            canonical: z.string().optional(),
            ogImage: z.string().optional(),
          })
          .optional(),
      }),
    }),
  }),
};
