import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogCategory = 'notes' | 'essays' | 'archive';
export interface BlogPost {
  entry: CollectionEntry<BlogCategory>;
  category: BlogCategory;
  href: string;
}

export const blogCategories = {
  notes: { label: 'Notes', href: '/blog/notes/' },
  essays: { label: 'Essays', href: '/blog/' },
  archive: { label: 'Archive', href: '/blog/archive/' },
};

export async function getBlogPosts(category?: BlogCategory): Promise<BlogPost[]> {
  const categories: BlogCategory[] = category ? [category] : ['notes', 'essays', 'archive'];
  const groups = await Promise.all(categories.map(async (category) => {
    const entries = await getCollection(category, ({ data }) => !data.draft);
    return entries.map((entry) => ({
      entry,
      category,
      href: `/blog/${category}/${entry.id.split('/').map(encodeURIComponent).join('/')}/`,
    }));
  }));
  return groups.flat().sort((a, b) =>
    b.entry.data.pubDate.valueOf() - a.entry.data.pubDate.valueOf()
    || a.href.localeCompare(b.href)
  );
}

export function formatPostDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(date);
}
