// GET /sitemap.xml
// Só a apresentação entra: é a única página pública feita para a busca (as outras pedem login ou têm "noindex").
export default defineEventHandler((event) => {
  const site = (useRuntimeConfig(event).public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`
})
