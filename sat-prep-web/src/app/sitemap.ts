import type { MetadataRoute } from 'next';

const rawSiteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : 'https://satguru.edu.vn');

const SITE_URL = rawSiteUrl.replace(/\/$/, '');

const UNI_SLUGS = ['ftu', 'neu', 'hust', 'vnu', 'vinuni', 'fulbright', 'rmit'];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
    { path: '', priority: 1.0, changeFrequency: 'daily' },
    { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/upgrade', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/diagnostic', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/exams', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/real-exams', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/library', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/parent', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/uni-predict', priority: 0.85, changeFrequency: 'weekly' },
    ...UNI_SLUGS.map((slug) => ({
      path: `/uni-predict/${slug}`,
      priority: 0.85,
      changeFrequency: 'weekly' as const,
    })),
    { path: '/terms', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/refund', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  ];

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
