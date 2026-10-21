<script setup>
// Uma questão de verdade na página de apresentação: a pessoa responde e vê o que o PGC faz com a resposta.
// Acertou, a questão volta em 3 dias; errou, volta amanhã (intervalos do FSRS com os parâmetros padrão).
// Teclado: as setas trocam a alternativa, Enter confirma. Avisa a página ("respondeu": true, false ou null ao
// recomeçar) para a linha do tempo ao lado mostrar quando a questão volta.
import { CalendarClock, CircleCheck, CircleX, RotateCcw } from '@lucide/vue'

const ALTERNATIVAS = [
  { texto: '8', erro: 'Dividiu por 2 e esqueceu do $a$: o certo é dividir por $2a$, que dá 4.' },
  { texto: '4' },
  { texto: '−4', erro: 'Errou o sinal: com $b = -16$, o $-b$ vale $+16$.' },
  { texto: '16', erro: 'Esqueceu de dividir por $2a$.' },
]
const CERTA = 1
const LETRAS = ['A', 'B', 'C', 'D']

const emit = defineEmits(['respondeu'])
const escolhida = ref(null)
const confirmada = ref(false)
const botoes = ref([])
const acertou = computed(() => confirmada.value && escolhida.value === CERTA)
const humor = computed(() => (!confirmada.value ? 'curioso' : acertou.value ? 'comemorativo' : 'encorajador'))
const fala = computed(() => {
  if (!confirmada.value) return 'Responda. Depois eu mostro quando ela volta.'
  return acertou.value ? 'Boa. Ela volta em 3 dias.' : 'Ela volta amanhã, para você fixar.'
})

function escolher(i) {
  if (!confirmada.value) escolhida.value = i
}
function teclado(evento, i) {
  const passo = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[evento.key]
  if (passo) {
    evento.preventDefault()
    const proxima = (i + passo + ALTERNATIVAS.length) % ALTERNATIVAS.length
    escolher(proxima)
    botoes.value[proxima]?.focus()
  }
  else if (evento.key === 'Enter' && escolhida.value !== null) {
    evento.preventDefault()
    confirmar()
  }
}
function confirmar() {
  if (escolhida.value === null) return
  confirmada.value = true
  emit('respondeu', escolhida.value === CERTA)
}
function deNovo() {
  escolhida.value = null
  confirmada.value = false
  emit('respondeu', null)
  nextTick(() => botoes.value[0]?.focus())
}
const estado = (i) => {
  if (!confirmada.value) return escolhida.value === i ? 'marcada' : ''
  if (i === CERTA) return 'certa'
  return escolhida.value === i ? 'errada' : 'apagada'
}
</script>

<template>
  <div class="demo relative">
    <div class="mb-3 flex items-end justify-end gap-2.5 pr-1" aria-hidden="true">
      <p class="balao m-0">{{ fala }}</p>
      <GuiaPersonagem :humor="humor" :tamanho="64" class="shrink-0" />
    </div>

    <section class="cartao relative sem-levantar" aria-labelledby="demo-enunciado">
      <p class="m-0 mb-2 text-[12.5px] font-semibold text-texto-3">Questão de exemplo</p>
      <p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
        <span class="size-2.5 shrink-0 rounded-full" :style="{ background: corMateria('azul') }" aria-hidden="true" />
        <b class="font-semibold">Matemática</b>
        <span class="text-texto-2">Funções do 2º grau</span>
        <span class="selo ml-auto">Normal</span>
      </p>
      <h2 id="demo-enunciado" class="m-0 mt-3 font-titulo text-[21px] font-semibold leading-[1.3] tracking-[-0.01em]">
        <TextoRico tag="span" texto="Qual é o $x_v$ do vértice de $f(x) = 2x^2 - 16x + 7$?" />
      </h2>

      <div role="radiogroup" aria-labelledby="demo-enunciado" class="mt-4 grid grid-cols-2 gap-2">
        <button
          v-for="(a, i) in ALTERNATIVAS"
          :key="i"
          :ref="(el) => (botoes[i] = el)"
          type="button"
          role="radio"
          class="opcao"
          :data-estado="estado(i)"
          :aria-checked="escolhida === i"
          :aria-disabled="confirmada"
          :tabindex="(escolhida ?? 0) === i ? 0 : -1"
          @click="escolher(i)"
          @keydown="teclado($event, i)"
        >
          <span class="letra" aria-hidden="true">{{ LETRAS[i] }}</span>
          <span class="font-titulo text-[19px] font-semibold tabular-nums">{{ a.texto }}</span>
          <span v-if="confirmada && i === CERTA" class="ml-auto text-[12.5px] font-semibold text-ok">Certa</span>
          <span v-else-if="confirmada && escolhida === i" class="ml-auto text-[12.5px] font-semibold text-erro">Sua</span>
        </button>
      </div>

      <div v-if="!confirmada" class="mt-4 flex items-center gap-3">
        <button type="button" class="botao" :disabled="escolhida === null" @click="confirmar">Confirmar</button>
        <span class="text-[13px] text-texto-3">{{ escolhida === null ? 'Escolha uma alternativa.' : 'Ou aperte Enter.' }}</span>
      </div>

      <div v-else class="correcao mt-4" :class="acertou ? 'bg-ok-suave' : 'bg-erro-suave'" aria-live="polite">
        <p class="m-0 flex items-center gap-2 font-titulo text-[18px] font-bold" :class="acertou ? 'text-ok' : 'text-erro'">
          <component :is="acertou ? CircleCheck : CircleX" :size="20" :stroke-width="2.3" aria-hidden="true" />
          {{ acertou ? 'Certa' : `Você marcou ${ALTERNATIVAS[escolhida].texto}. A certa é 4.` }}
        </p>
        <p v-if="!acertou" class="m-0 mt-2 text-[14.5px] leading-[1.5]"><b class="font-semibold">Por que a sua parece certa:</b> <TextoRico tag="span" :texto="ALTERNATIVAS[escolhida].erro" /></p>
        <TextoRico tag="p" class="m-0 mt-2 text-[14.5px] leading-[1.5]" texto="$x_v = -b/(2a) = 16/4 = 4$." />
        <p class="m-0 mt-3 flex items-center gap-2 text-[14.5px] font-semibold text-tinta">
          <CalendarClock :size="17" :stroke-width="2.1" aria-hidden="true" />
          {{ acertou ? 'Esta questão volta em 3 dias.' : 'Esta questão volta amanhã.' }}
        </p>
        <button type="button" class="link-discreto mt-2 inline-flex items-center gap-1.5 text-[13.5px]" @click="deNovo">
          <RotateCcw :size="14" :stroke-width="2.2" aria-hidden="true" />Responder de novo
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.balao {
  position: relative;
  max-width: 250px;
  padding: 8px 12px;
  border: 1px solid var(--borda);
  border-radius: 14px 14px 4px 14px;
  background: var(--folha);
  font-size: 13.5px;
  line-height: 1.4;
  color: var(--texto-2);
}
.opcao {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 12px;
  border: 1.5px solid var(--borda);
  border-radius: 14px;
  background: var(--folha);
  color: var(--tinta);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.opcao:hover:not([aria-disabled='true']) {
  border-color: var(--borda-forte);
}
.opcao[data-estado='marcada'] {
  border-color: var(--acento);
  background: var(--acento-suave);
}
.opcao[data-estado='certa'] {
  border-color: var(--ok);
  background: var(--ok-suave);
}
.opcao[data-estado='errada'] {
  border-color: var(--erro);
  background: var(--erro-suave);
}
.opcao[data-estado='apagada'] {
  opacity: 0.55;
}
.opcao[aria-disabled='true'] {
  cursor: default;
}
.letra {
  display: grid;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  place-items: center;
  border: 1.5px solid var(--borda-forte);
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--texto-2);
}
.opcao[data-estado='marcada'] .letra {
  border-color: var(--acento);
  background: var(--acento);
  color: var(--sobre-acento);
}
.correcao {
  padding: 14px 16px;
  border-radius: 14px;
  animation: aparece 0.25s ease backwards;
}
@media (prefers-reduced-motion: reduce) {
  .correcao {
    animation: none;
  }
}
</style>
