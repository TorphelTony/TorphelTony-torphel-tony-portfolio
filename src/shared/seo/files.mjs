export function seoDocuments(origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:') throw new Error('PUBLIC_SITE_URL must use HTTPS.');
  const base = url.origin;
  return {
    'robots.txt': `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`,
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>\n`,
  };
}
