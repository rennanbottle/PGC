<script setup>
// O guia no canto da tela. Toque nele para ver as dicas da tela e fazer o passeio.
// Na primeira visita a uma tela com passeio, ele pergunta uma vez se você quer conhecer a tela.
// Dá para esconder (e trazer de volta pelo menu da sua foto ou pelo perfil).
import { X } from '@lucide/vue'

const guia = useGuia()
const { escolha: guiaAtual } = useGuiaAtual()
const titulo = computed(() => (guiaAtual.value.tipo === 'proprio' && !guiaAtual.value.nomeDado ? 'Oi! Eu sou o seu guia.' : `Oi! Eu sou ${guiaAtual.value.nome}.`))
const { estado, atual } = guia
const route = useRoute()

// Convite: na primeira visita a uma tela com passeio, depois de um instante, e só se alguma parte do passeio já
// estiver na tela (numa tela travada ou ainda carregando, o convite espera; se nada aparecer, não convida).
let relogio = null
function temAlgoParaMostrar() {
  return (atual.value?.passos ?? []).some((p) => {
    const el = document.querySelector(`[data-guia="${p.alvo}"]`)
    const r = el?.getBoundingClientRect()
    return !!r && r.width > 0 && r.height > 0
  })
}
function talvezConvidar(vez = 0) {
  clearTimeout(relogio)
  estado.value.convite = false
  if (estado.value.escondido || !atual.value || estado.value.vistos[atual.value.id] || estado.value.passeio) return
  relogio = setTimeout(() => {
    if (estado.value.balao || estado.value.passeio) return
    if (temAlgoParaMostrar()) estado.value.convite = true
    else if (vez < 4) talvezConvidar(vez + 1)
  }, vez ? 900 : 1600)
}
onMounted(() => {
  guia.carregar()
  talvezConvidar()
})
watch(() => route.path, () => {
  estado.value.balao = false
  talvezConvidar()
})
onBeforeUnmount(() => clearTimeout(relogio))

function teclado(evento) {
  if (evento.key === 'Escape' && estado.value.balao) guia.fecharBalao()
}
</script>

<template>
  <ClientOnly>
    <div
      v-if="!estado.escondido && !estado.passeio"
      class="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-3 z-[60] flex flex-col items-end gap-3 lg:bottom-6 lg:right-6"
      @keydown="teclado"
    >
      <Transition name="lista">
        <section
          v-if="estado.balao"
          class="relative mt-[100px] w-[min(360px,calc(100vw-24px))]"
          aria-labelledby="titulo-guia"
          role="dialog"
        >
          <!-- O guia sai de trás do balão (a borda de cima esconde a base dele). -->
          <GuiaPersonagem humor="feliz" :tamanho="124" sem-fundo class="absolute bottom-[calc(100%-26px)] left-4" />
          <div class="relative z-[1] rounded-[22px] border border-borda bg-folha p-5 pt-4 shadow-[var(--sombra-janela)]">
            <button type="button" class="botao-icone pequeno absolute right-2.5 top-2.5" aria-label="Fechar o balão do guia" @click="guia.fecharBalao()">
              <X :size="17" :stroke-width="2.2" aria-hidden="true" />
            </button>
            <h2 id="titulo-guia" class="titulo-cartao pr-8">{{ titulo }}</h2>
            <p class="m-0 mt-1 text-[13.5px] leading-snug text-texto-2">{{ atual ? `Dicas para ${atual.nome}:` : 'Abra uma tela e eu mostro como ela funciona.' }}</p>
            <ul v-if="atual" class="m-0 mt-3.5 flex list-none flex-col gap-2 p-0">
              <li v-for="d in atual.dicas" :key="d" class="flex gap-2.5 text-[14px] leading-snug">
                <span class="mt-[7px] size-1.5 shrink-0 rounded-full bg-acento" aria-hidden="true" />
                <span>{{ d }}</span>
              </li>
            </ul>
            <div class="mt-4 flex flex-wrap items-center gap-2">
              <button v-if="atual?.passos?.length" type="button" class="botao botao-p" @click="guia.iniciar()">Mostrar a tela</button>
              <button type="button" class="botao-fantasma h-9 px-3 text-[13.5px]" @click="guia.esconder()">Esconder o guia</button>
            </div>
          </div>
        </section>
      </Transition>

      <Transition name="lista">
        <div v-if="estado.convite && !estado.balao" class="relative max-w-[260px] rounded-[18px] border border-borda bg-folha p-3.5 pr-9 text-[14px] leading-snug shadow-[var(--sombra-menu)]" role="status">
          <p class="m-0 font-medium">Quer que eu mostre como {{ atual?.nome === 'Início' ? 'o Início' : `a tela ${atual?.nome}` }} funciona?</p>
          <div class="mt-2.5 flex gap-2">
            <button type="button" class="botao botao-p" @click="guia.iniciar()">Mostrar</button>
            <button type="button" class="botao-fantasma h-9 px-3 text-[13.5px]" @click="guia.dispensarConvite()">Agora não</button>
          </div>
          <button type="button" class="botao-icone absolute right-1.5 top-1.5 size-7 rounded-lg" aria-label="Fechar o convite" @click="guia.dispensarConvite()">
            <X :size="15" :stroke-width="2.2" aria-hidden="true" />
          </button>
        </div>
      </Transition>

      <button
        type="button"
        class="grid size-[72px] cursor-pointer place-items-end overflow-hidden rounded-[24px] border border-borda bg-acento-suave shadow-[var(--sombra-menu)] transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1 active:scale-95"
        :aria-label="estado.balao ? 'Fechar a ajuda do guia' : 'Ajuda do guia'"
        :aria-expanded="estado.balao"
        @click="estado.balao ? guia.fecharBalao() : guia.abrirBalao()"
      >
        <GuiaPersonagem :humor="estado.balao ? 'explicativo' : estado.convite ? 'feliz' : 'neutro'" :tamanho="72" sem-fundo />
      </button>
    </div>
    <GuiaHolofote v-if="estado.passeio" />
  </ClientOnly>
</template>
