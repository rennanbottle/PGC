// GET /robots.txt
// A apresentação (/) é pública e pode aparecer no Google. As outras telas pedem login e têm "noindex" no HTML; a API
// fica fora da busca. O endereço do sitemap usa NUXT_PUBLIC_SITE_URL ou, sem ele, o endereço de quem pediu.
export default defineEventHandler((event) => {
  const site = (useRuntimeConfig(event).public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /auth/', '', `Sitemap: ${site}/sitemap.xml`, ''].join('\n')
})
