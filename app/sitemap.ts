import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://distilledcrux.com';
  const now = new Date();

  return [
    { url: base,                              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/pricing`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/prelims`,                 lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/prelims/history`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/prelims/polity`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/prelims/geography`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/prelims/economy`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/prelims/environment`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/prelims/science`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/prelims/current`,         lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/prelims/csat`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/prelims/quiz`,            lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${base}/sociology/pyqs`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/notes`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/privacy`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terms`,                   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/refund`,                  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/contact`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
  ];
}
