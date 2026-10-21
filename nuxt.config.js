// Configuração do Nuxt. Cada bloco tem um motivo:
// - nuxt-security: cabeçalhos de segurança em toda resposta (meta: A+ no securityheaders.com).
// - @nuxtjs/supabase: liga o projeto ao banco, guardando a sessão em cookies que o servidor consegue conferir.
// - @nuxtjs/color-mode: tema claro, escuro ou do sistema, aplicado antes da primeira pintura (sem piscar).
// - css + vite.plugins: Tailwind 4 pelo plugin oficial do Vite, com os tokens de cor em main.css.
// - app.head: idioma da página e "noindex", porque as telas internas não devem aparecer no Google. Só a apresentação
//   (/) troca para "index" e ganha título, descrição e imagem de prévia (og.png).
// - runtimeConfig.public.siteUrl: o endereço do site (NUXT_PUBLIC_SITE_URL), usado no link de prévia e no sitemap.
import tailwindcss from '@tailwindcss/vite'

const emDesenvolvimento = process.env.NODE_ENV === 'development'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: emDesenvolvimento },
  modules: ['nuxt-security', '@nuxtjs/supabase', '@nuxtjs/color-mode'],
  // KaTeX desenha as contas (fração, raiz, índice); o CSS traz as fontes de matemática dele.
  css: ['katex/dist/katex.min.css', '~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // Sem barra no fim, como https://nome-do-projeto.vercel.app. Vazio: usa o endereço de quem pediu a página.
      siteUrl: '',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'PGC',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#2f5bff' },
        { name: 'description', content: 'PGC, Plataforma de Gerenciamento do Conhecimento: questões que voltam no dia certo.' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preload', href: '/fonts/onest.woff2', as: 'font', type: 'font/woff2', crossorigin: '' },
        { rel: 'preload', href: '/fonts/bricolage-grotesque.woff2', as: 'font', type: 'font/woff2', crossorigin: '' },
      ],
    },
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'pgc-tema',
  },
  supabase: {
    // O controle de quem pode ver cada página fica no middleware app/middleware/autenticacao.global.js.
    redirect: false,
    // Projeto em JavaScript: sem arquivo de tipos do banco.
    types: false,
    // A sessão dura 30 dias sem uso. Quem desmarca "Continuar conectado" sai ao fechar o navegador
    // (conferido no middleware). Em desenvolvimento o cookie aceita http, para testar pelo celular na rede de casa.
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      secure: !emDesenvolvimento,
    },
  },
  security: {
    headers: {
      // As DevTools do Nuxt só abrem em desenvolvimento com esta política relaxada.
      ...(emDesenvolvimento ? { crossOriginEmbedderPolicy: 'unsafe-none' } : {}),
      // Em desenvolvimento o banco local responde em http://127.0.0.1:54321: não forçar https nesse caso.
      contentSecurityPolicy: { 'upgrade-insecure-requests': !emDesenvolvimento },
    },
    // O validador de XSS recusava qualquer pedido com "<" ou ">" (comuns em matemática e em código, como "Δ<0").
    // A tela nunca mostra HTML vindo da pessoa: o Vue escapa tudo. Por isso ele fica desligado.
    xssValidator: false,
    // Na escola todos saem pelo mesmo endereço de internet: o limite padrão (150 pedidos em 5 minutos) travaria a turma.
    rateLimiter: { tokensPerInterval: 600, interval: 60000 },
  },
})
