<script setup>
// Página de apresentação do PGC (endereço raiz), pública e a única que pode aparecer no Google. Quem está logado vai
// para /inicio, a não ser que peça para ver (/?ver=apresentacao, no menu da conta): aí os botões levam ao Início.
// Ordem: a abertura (a frase e o mapa de conceitos que se liga sozinho), uma questão de exemplo para responder com a
// linha do tempo de quando ela volta, o ciclo em cinco passos (preso na tela ao rolar, no computador), o que tem no
// PGC e o convite final. As partes entram ao rolar (v-revelar), como no site da escola; com "menos movimento", não.
// Tudo o que aparece já existe no sistema; os desenhos com números dizem que são exemplo.
import { ArrowUp, Lock } from '@lucide/vue'

definePageMeta({ layout: false })

const config = useRuntimeConfig()
const site = (config.public.siteUrl || useRequestURL().origin).replace(/\/$/, '')
const TITULO = 'PGC | Questões que voltam no dia certo'
const DESCRICAO = 'Cadastre as suas matérias, tenha questões do seu material e estude um pouco por dia. O PGC traz cada assunto de volta antes de você esquecer.'
useHead({
  title: TITULO,
  link: [{ rel: 'canonical', href: `${site}/` }],
})
useSeoMeta({
  description: DESCRICAO,
  robots: 'index, follow',
  ogType: 'website',
  ogLocale: 'pt_BR',
  ogSiteName: 'PGC',
  ogTitle: TITULO,
  ogDescription: DESCRICAO,
  ogUrl: `${site}/`,
  ogImage: `${site}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Logo do PGC com a frase: questões que voltam no dia certo.',
  twitterCard: 'summary_large_image',
  twitterTitle: TITULO,
  twitterDescription: DESCRICAO,
  twitterImage: `${site}/og.png`,
})

// A resposta da questão de exemplo, para a linha do tempo ao lado.
const resposta = ref(null)
// Logado vendo a apresentação: no lugar de Entrar e Criar conta, o caminho de volta ao Início.
const sessao = useSupabaseSession()
const logado = computed(() => !!sessao.value)

// Cabeçalho: ganha fundo e borda depois de rolar um pouco. O mapa da abertura sobe mais devagar que o texto
// (parallax), e some aos poucos; parado com "menos movimento".
const rolou = ref(false)
const mapa = ref(null)
let quadro = 0
let semMovimento = false
let mapaEscondido = false
function aoRolar() {
  quadro = 0
  const y = window.scrollY
  if (rolou.value !== y > 12) rolou.value = y > 12
  if (semMovimento || !mapa.value) return
  const alto = window.innerHeight
  if (y > alto * 1.2) {
    if (!mapaEscondido) mapa.value.style.opacity = '0'
    mapaEscondido = true
    return
  }
  mapaEscondido = false
  mapa.value.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0)`
  mapa.value.style.opacity = String(Math.max(0, 1 - y / (alto * 0.95)).toFixed(3))
}
const agendar = () => {
  if (!quadro) quadro = requestAnimationFrame(aoRolar)
}
const voltarAoTopo = () => window.scrollTo({ top: 0, behavior: semMovimento ? 'auto' : 'smooth' })
onMounted(() => {
  semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('menos-movimento')
  window.addEventListener('scroll', agendar, { passive: true })
  aoRolar()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(quadro)
  window.removeEventListener('scroll', agendar)
})
</script>

<template>
  <div class="apresentacao">
    <a href="#conteudo" class="pular-para">Pular para o conteúdo</a>
    <header class="cabecalho sticky top-0 z-30" :class="rolou && 'rolou'">
      <div class="mx-auto flex h-[64px] max-w-[1160px] items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-8">
        <NuxtLink to="/" class="rounded-md text-[26px] no-underline sm:text-[30px]">
          <MarcaPgc entrada />
          <span class="so-leitor">, Plataforma de Gerenciamento do Conhecimento</span>
        </NuxtLink>
        <nav aria-label="Partes da página" class="hidden items-center gap-1 lg:flex">
          <a href="#experimente" class="link-topo">Experimente</a>
          <a href="#ciclo" class="link-topo">Como funciona</a>
          <a href="#recursos" class="link-topo">O que tem</a>
        </nav>
        <nav aria-label="Conta" class="flex items-center gap-1.5 sm:gap-2.5">
          <SeletorTema class="hidden sm:inline-flex" />
          <NuxtLink v-if="logado" to="/inicio" class="botao no-underline">Ir para o Início</NuxtLink>
          <template v-else>
            <NuxtLink to="/entrar" class="botao-fantasma no-underline">Entrar</NuxtLink>
            <NuxtLink to="/criar-conta" class="botao no-underline">Criar conta</NuxtLink>
          </template>
        </nav>
      </div>
    </header>

    <main id="conteudo">
      <!-- Abertura -->
      <section class="abertura relative overflow-hidden" aria-labelledby="titulo-pgc">
        <div class="mx-auto grid max-w-[1160px] items-center gap-x-10 gap-y-6 px-4 pb-10 pt-8 sm:px-8 sm:pt-12 lg:min-h-[min(calc(100dvh-76px),860px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:pb-16">
          <div class="relative z-10">
            <h1 id="titulo-pgc" class="titulo-abertura">
              <span class="linha-titulo" style="--i: 0">Questões que</span>
              <span class="linha-titulo" style="--i: 1">voltam no</span>
              <span class="linha-titulo" style="--i: 2">dia certo.</span>
            </h1>
            <p class="entra m-0 mt-6 max-w-[33em] text-[18px] leading-[1.6] text-texto-2" style="--i: 4">
              Cadastre as suas matérias, tenha questões do seu material e estude um pouco por dia. O PGC traz cada assunto
              de volta antes de você esquecer, e o que você erra volta mais cedo.
            </p>
            <div class="entra mt-8 flex flex-wrap items-center gap-3" style="--i: 5">
              <NuxtLink :to="logado ? '/inicio' : '/criar-conta'" class="botao botao-g no-underline">{{ logado ? 'Ir para o Início' : 'Criar conta' }}</NuxtLink>
              <a href="#experimente" class="botao-secundario botao-g no-underline">Responder uma questão</a>
            </div>
            <p class="entra m-0 mt-5 text-[14px] text-texto-3" style="--i: 6">Abre no navegador do computador e do celular, sem instalar nada.</p>
          </div>
          <div ref="mapa" class="mapa-abertura">
            <ApresentacaoConstelacao class="hidden h-[560px] lg:block" />
            <ApresentacaoConstelacao compacto class="h-[380px] sm:h-[440px] lg:hidden" />
          </div>
        </div>
      </section>

      <!-- Experimente -->
      <section id="experimente" class="faixa scroll-mt-16" aria-labelledby="titulo-experimente">
        <div class="mx-auto max-w-[1160px] px-4 py-16 sm:px-8 lg:py-24">
          <div class="max-w-[40em]">
            <h2 id="titulo-experimente" v-revelar class="titulo-parte">Responda e veja quando ela volta</h2>
            <p v-revelar="1" class="m-0 mt-3 text-[16px] leading-[1.6] text-texto-2">
              Acertou, a questão volta mais tarde. Errou, volta no dia seguinte e o intervalo recomeça curto. Assim você
              revisa o que está quase esquecendo, e não o que já sabe.
            </p>
          </div>
          <div class="mt-10 grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <ApresentacaoQuestaoDemo v-revelar:esquerda class="lg:max-w-[500px]" @respondeu="resposta = $event" />
            <ApresentacaoVoltas v-revelar:direita class="lg:mt-[76px]" :resposta="resposta" />
          </div>
        </div>
      </section>

      <!-- O ciclo -->
      <div id="ciclo" class="scroll-mt-4">
        <ApresentacaoCiclo />
      </div>

      <!-- O que tem -->
      <div id="recursos" class="faixa-fina scroll-mt-16">
        <ApresentacaoRecursos />
      </div>

      <!-- Convite -->
      <section class="faixa" aria-labelledby="titulo-comecar">
        <div class="mx-auto flex max-w-[1160px] flex-col gap-8 px-4 py-16 sm:px-8 md:flex-row md:items-center lg:py-20">
          <GuiaPersonagem v-revelar:zoom humor="comemorativo" :tamanho="120" imagem="/guias/gato.webp" class="shrink-0" />
          <div v-revelar class="min-w-0 flex-1">
            <h2 id="titulo-comecar" class="titulo-parte">Comece pela matéria da próxima prova.</h2>
            <p class="m-0 mt-3 max-w-[34em] text-[16px] leading-[1.6] text-texto-2">Em poucos minutos você cria a conta, cadastra a matéria e tem o primeiro estudo pronto.</p>
          </div>
          <div v-revelar="2" class="flex shrink-0 flex-wrap gap-3">
            <NuxtLink v-if="logado" to="/inicio" class="botao botao-g no-underline">Voltar ao Início</NuxtLink>
            <template v-else>
              <NuxtLink to="/criar-conta" class="botao botao-g no-underline">Criar conta</NuxtLink>
              <NuxtLink to="/entrar" class="botao-secundario botao-g no-underline">Entrar</NuxtLink>
            </template>
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-borda">
      <div class="mx-auto flex max-w-[1160px] flex-col gap-4 px-4 py-8 text-[14px] text-texto-2 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p class="m-0 flex items-center gap-2.5">
          <span class="text-[22px]"><MarcaPgc so-icone /></span>
          Plataforma de Gerenciamento do Conhecimento
        </p>
        <p class="m-0 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span class="flex items-center gap-1.5"><Lock :size="14" :stroke-width="1.9" aria-hidden="true" />Seus dados são só seus.</span>
          <NuxtLink to="/privacidade" class="text-texto-2">Privacidade</NuxtLink>
          <NuxtLink :to="logado ? '/inicio' : '/entrar'" class="text-texto-2">{{ logado ? 'Início' : 'Entrar' }}</NuxtLink>
          <button type="button" class="link-discreto inline-flex items-center gap-1.5 text-[14px]" @click="voltarAoTopo"><ArrowUp :size="14" :stroke-width="2" aria-hidden="true" />Voltar ao topo</button>
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.pular-para {
  position: absolute;
  left: 12px;
  top: -60px;
  z-index: 50;
  border-radius: 10px;
  background: var(--tinta);
  padding: 10px 14px;
  color: var(--folha);
  font-weight: 600;
  text-decoration: none;
}
.pular-para:focus {
  top: 12px;
}
.cabecalho {
  border-bottom: 1px solid transparent;
  transition: background-color 0.25s, border-color 0.25s;
}
/* Sem desfoque atrás do cabeçalho: o desfoque é refeito a cada quadro ao rolar e deixava a página travada. */
.cabecalho.rolou {
  border-bottom-color: var(--borda);
  background: color-mix(in oklab, var(--mesa) 96%, transparent);
}
.link-topo {
  border-radius: 10px;
  padding: 8px 12px;
  color: var(--texto-2);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.link-topo:hover {
  background: var(--folha);
  color: var(--tinta);
}
.titulo-abertura {
  margin: 0;
  font-family: var(--font-titulo);
  font-size: clamp(44px, 6.6vw, 84px);
  font-weight: 800;
  line-height: 0.98;
  letter-spacing: -0.045em;
}
/* As três linhas do título sobem uma de cada vez ao abrir. */
.linha-titulo {
  display: block;
  animation: entra 0.7s var(--ease-saida) backwards;
  animation-delay: calc(var(--i) * 110ms + 60ms);
}
.titulo-parte {
  margin: 0;
  font-family: var(--font-titulo);
  font-size: clamp(28px, 3.4vw, 40px);
  font-weight: 750;
  line-height: 1.08;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
.mapa-abertura {
  will-change: transform, opacity;
}
/* Faixas de papel liso entre as partes com o fundo pontilhado. */
.faixa {
  border-block: 1px solid var(--borda);
  background: var(--folha);
}
.faixa-fina {
  border-top: 1px solid var(--borda);
}
.botao-g {
  min-height: 50px;
  padding-inline: 22px;
  font-size: 16px;
}
@media (prefers-reduced-motion: reduce) {
  .linha-titulo {
    animation: none;
  }
}
:global(:root.menos-movimento) .linha-titulo {
  animation: none;
}
</style>
