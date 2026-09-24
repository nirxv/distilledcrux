import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://distilledcrux.com';
  const now = new Date();

  return [
    { url: base,                              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/pricing`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/test`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/sociology/pyqs`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/polsci/pyqs`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/evaluate`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/chat`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/dashboard`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/notes/sociology`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/notes/anthropology`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/notes/polsci`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/notes/geography`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/notes/pub-admin`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/anthropology/pyqs`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/geography/pyqs`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/pub-admin/pyqs`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/geography/mapping`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/notes`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/privacy`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terms`,                   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/refund`,                  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/contact`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
  ];
}
