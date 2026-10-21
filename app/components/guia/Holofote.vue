<script setup>
// Passeio do guia: escurece a tela, acende uma parte de cada vez e o guia explica.
// Dois jeitos (escolha no Perfil, Aparência; no celular é sempre o painel):
// - "balao": balão perto da parte acesa, com o guia grande saindo de trás dele e o nome do guia.
// - "painel": painel de conversa preso embaixo da tela, com o guia bem grande saindo por cima.
// Teclado: seta para a direita avança, para a esquerda volta, Esc encerra. Passos sem elemento na tela são pulados.
import { ArrowLeft, X } from '@lucide/vue'
import { PASSEIOS } from '#shared/regras/guia.js'

const guia = useGuia()
const { estado } = guia
const { escolha: guiaAtual } = useGuiaAtual()
const passeio = computed(() => PASSEIOS[estado.value.passeio] ?? null)
const passos = ref([])
const recorte = ref(null)
const balao = ref(null)
const posBalao = ref({ top: 0, left: 0 })
const celular = ref(false)

const passoAtual = computed(() => passos.value[estado.value.passo] ?? null)
const ultimo = computed(() => estado.value.passo === passos.value.length - 1)
const painel = computed(() => celular.value || estado.value.estilo === 'painel')
const humor = computed(() => (ultimo.value && passos.value.length > 1 ? 'orgulhoso' : estado.value.passo === 0 ? 'feliz' : 'explicativo'))
const quem = computed(() => (guiaAtual.value.tipo === 'proprio' && !guiaAtual.value.nomeDado ? 'Seu guia' : `${guiaAtual.value.nome}, seu guia`))

// Tamanho do guia no balão e quanto dele fica acima do balão.
const GUIA_BALAO = 132
const ACIMA = 104

function elementoDo(passo) {
  return document.querySelector(`[data-guia="${passo.alvo}"]`)
}
function visivel(el) {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

// A tela pode ainda estar carregando quando o passeio começa: tenta de novo por até 2 segundos antes de desistir.
// Se nada aparecer, encerra sem marcar a tela como vista (o convite volta numa próxima visita).
let tentativas = 0
function montar() {
  passos.value = (passeio.value?.passos ?? []).filter((p) => visivel(elementoDo(p)))
  if (!passos.value.length) {
    if (tentativas++ < 8) {
      setTimeout(montar, 250)
      return
    }
    guia.encerrar({ marcarVisto: false })
    return
  }
  estado.value.passo = Math.min(estado.value.passo, passos.value.length - 1)
  focar()
}

function medir() {
  const el = passoAtual.value && elementoDo(passoAtual.value)
  if (!el) return
  const r = el.getBoundingClientRect()
  const folga = 8
  recorte.value = { top: r.top - folga, left: r.left - folga, width: r.width + folga * 2, height: r.height + folga * 2 }
  celular.value = window.innerWidth < 640
  if (painel.value) return
  // Balão: embaixo da parte (o guia fica no vão entre as duas), em cima dela ou, se nada couber, no canto de baixo.
  const larguraBalao = 380
  const alturaBalao = balao.value?.offsetHeight ?? 200
  const cabeEmbaixo = r.bottom + folga + 14 + ACIMA + alturaBalao < window.innerHeight - 16
  const cabeEmCima = r.top - folga - 14 - alturaBalao - ACIMA > 16
  const topo = cabeEmbaixo ? r.bottom + folga + 14 + ACIMA : cabeEmCima ? r.top - folga - 14 - alturaBalao : window.innerHeight - alturaBalao - 24
  posBalao.value = {
    top: Math.min(Math.max(16 + ACIMA, topo), window.innerHeight - alturaBalao - 16),
    left: Math.min(Math.max(16, r.left), window.innerWidth - larguraBalao - 16),
  }
}

function focar() {
  const el = passoAtual.value && elementoDo(passoAtual.value)
  if (!el) return
  const alta = el.getBoundingClientRect().height > window.innerHeight * 0.45
  el.scrollIntoView({ block: alta || painel.value ? 'start' : 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  setTimeout(() => {
    medir()
    nextTick(() => balao.value?.focus())
  }, 320)
  nextTick(medir)
}

function ir(passo) {
  if (passo < 0) return
  if (passo >= passos.value.length) {
    guia.encerrar()
    return
  }
  estado.value.passo = passo
  focar()
}
function teclado(evento) {
  if (evento.key === 'Escape') {
    evento.preventDefault()
    guia.encerrar()
  }
  else if (evento.key === 'ArrowRight') ir(estado.value.passo + 1)
  else if (evento.key === 'ArrowLeft') ir(estado.value.passo - 1)
}
// Espaço a mais no fim da página durante o passeio: assim a última parte da tela consegue subir e não fica
// escondida atrás do painel de conversa.
let folgaAntes = ''
onMounted(() => {
  celular.value = window.innerWidth < 640
  folgaAntes = document.body.style.paddingBottom
  document.body.style.paddingBottom = '280px'
  nextTick(montar)
  window.addEventListener('resize', medir)
  window.addEventListener('scroll', medir, true)
  window.addEventListener('keydown', teclado)
})
onBeforeUnmount(() => {
  document.body.style.paddingBottom = folgaAntes
  window.removeEventListener('resize', medir)
  window.removeEventListener('scroll', medir, true)
  window.removeEventListener('keydown', teclado)
})
</script>

<template>
  <div class="fixed inset-0 z-[95]" aria-live="polite">
    <!-- Clique fora do recorte encerra. -->
    <div class="absolute inset-0" @click="guia.encerrar()" />
    <div
      v-if="recorte"
      class="holofote pointer-events-none absolute rounded-[18px]"
      :style="{ top: `${recorte.top}px`, left: `${recorte.left}px`, width: `${recorte.width}px`, height: `${recorte.height}px` }"
      aria-hidden="true"
    />

    <!-- Painel de conversa embaixo -->
    <section
      v-if="passoAtual && painel"
      ref="balao"
      :key="`painel-${passoAtual.alvo}`"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="`Passeio do guia: ${passoAtual.titulo}`"
      class="painel-guia outline-none"
    >
      <GuiaPersonagem :humor="humor" :tamanho="celular ? 116 : 176" sem-fundo class="painel-personagem" />
      <div class="painel-fala">
        <p class="m-0 flex items-center gap-2.5 text-[13px] font-semibold">
          <span class="text-acento">{{ quem }}</span>
          <span class="text-texto-3"><Fracao :valor="estado.passo + 1" :total="passos.length" sem-animacao /></span>
        </p>
        <h2 class="titulo-cartao mt-1 text-[20px]">{{ passoAtual.titulo }}</h2>
        <p class="m-0 mt-1.5 max-w-[46ch] text-[15px] leading-normal text-texto-2">{{ passoAtual.texto }}</p>
      </div>
      <div class="painel-nav">
        <span class="flex gap-1" aria-hidden="true">
          <span v-for="(p, i) in passos" :key="p.alvo" class="h-1.5 rounded-full transition-all duration-300" :class="i === estado.passo ? 'w-5 bg-acento' : 'w-1.5 bg-folha-3'" />
        </span>
        <button v-if="estado.passo > 0" type="button" class="botao-icone pequeno" aria-label="Passo anterior" @click="ir(estado.passo - 1)">
          <ArrowLeft :size="17" :stroke-width="2.2" aria-hidden="true" />
        </button>
        <button type="button" class="botao botao-p" @click="ir(estado.passo + 1)">{{ ultimo ? 'Entendi' : 'Próximo' }}</button>
      </div>
      <button type="button" class="botao-icone pequeno absolute right-2.5 top-2.5" aria-label="Encerrar o passeio" @click="guia.encerrar()">
        <X :size="17" :stroke-width="2.2" aria-hidden="true" />
      </button>
    </section>

    <!-- Balão perto da parte acesa, com o guia saindo de trás dele -->
    <section
      v-else-if="passoAtual"
      ref="balao"
      :key="passoAtual.alvo"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="`Passeio do guia: ${passoAtual.titulo}`"
      class="balao-guia absolute z-[1] w-[380px] outline-none"
      :style="{ top: `${posBalao.top}px`, left: `${posBalao.left}px` }"
    >
      <GuiaPersonagem :humor="humor" :tamanho="GUIA_BALAO" sem-fundo class="balao-personagem" />
      <div class="relative z-[1] rounded-[22px] border border-borda bg-folha p-5 pt-4 shadow-[var(--sombra-janela)]">
        <button type="button" class="botao-icone pequeno absolute right-2.5 top-2.5" aria-label="Encerrar o passeio" @click="guia.encerrar()">
          <X :size="17" :stroke-width="2.2" aria-hidden="true" />
        </button>
        <span class="inline-block rounded-full bg-acento-suave px-2.5 py-[3px] text-[12.5px] font-bold text-acento">{{ quem }}</span>
        <p class="m-0 mt-2 text-[12.5px] font-semibold text-texto-3"><Fracao :valor="estado.passo + 1" :total="passos.length" sem-animacao /></p>
        <h2 class="titulo-cartao mt-0.5">{{ passoAtual.titulo }}</h2>
        <p class="m-0 mt-2 text-[14.5px] leading-normal text-texto-2">{{ passoAtual.texto }}</p>
        <div class="mt-4 flex items-center gap-2">
          <span class="flex flex-1 gap-1" aria-hidden="true">
            <span v-for="(p, i) in passos" :key="p.alvo" class="h-1.5 rounded-full transition-all duration-300" :class="i === estado.passo ? 'w-5 bg-acento' : 'w-1.5 bg-folha-3'" />
          </span>
          <button v-if="estado.passo > 0" type="button" class="botao-icone pequeno" aria-label="Passo anterior" @click="ir(estado.passo - 1)">
            <ArrowLeft :size="17" :stroke-width="2.2" aria-hidden="true" />
          </button>
          <button type="button" class="botao botao-p" @click="ir(estado.passo + 1)">{{ ultimo ? 'Entendi' : 'Próximo' }}</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* O guia sai de trás do balão: vem antes dele na página e a borda de cima do balão esconde a base. */
.balao-personagem {
  position: absolute;
  left: 18px;
  bottom: calc(100% - 28px);
}
.painel-guia {
  position: absolute;
  left: 50%;
  bottom: calc(14px + env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px 22px;
  width: min(880px, calc(100vw - 24px));
  min-height: 150px;
  padding: 20px 24px 18px;
  border: 1px solid var(--borda-forte);
  border-radius: 24px;
  background: var(--folha);
  box-shadow: var(--sombra-janela);
  transform: translateX(-50%);
  animation: painel-sobe 0.35s var(--ease-saida) backwards;
}
.painel-personagem {
  position: absolute;
  left: 22px;
  bottom: 0;
}
.painel-fala {
  grid-column: 2;
  align-self: center;
  padding-right: 28px;
}
.painel-nav {
  grid-column: 3;
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 639px) {
  .painel-guia {
    grid-template-columns: 104px minmax(0, 1fr);
    gap: 12px 14px;
    padding: 16px 16px 14px;
  }
  .painel-personagem {
    left: 10px;
  }
  .painel-fala {
    padding-right: 24px;
  }
  .painel-nav {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
  .painel-nav > span {
    margin-right: auto;
  }
}
@keyframes painel-sobe {
  from {
    opacity: 0;
    transform: translate(-50%, 16px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .painel-guia {
    animation: none;
  }
}
</style>
