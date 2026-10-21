<script setup>
// Escolher qualquer cor, em pouco espaço: um botão com a cor atual e o nome dela; ao abrir, um retângulo de tom e
// brilho (como nos editores de imagem), a faixa das cores, as 8 cores prontas e o código #rrggbb.
// Valor: nome de uma cor pronta ('azul') ou '#rrggbb'. Uso: <SeletorCor v-model="cor" rotulo="Cor da matéria" />
// Teclado: no retângulo, as setas mudam tom e brilho (Shift anda mais); a faixa é um controle deslizante comum.
import { Check, ChevronDown } from '@lucide/vue'
import { CORES } from '#shared/regras/materias.js'
import { ehHex, hexParaHsv, hsvParaHex } from '#shared/regras/cores.js'

const props = defineProps({
  modelValue: { type: String, default: 'azul' },
  rotulo: { type: String, default: 'Cor' },
})
const emit = defineEmits(['update:modelValue'])

const aberto = ref(false)
const botao = ref(null)
const painel = ref(null)
const area = ref(null)
const destino = ref('body')
const pos = ref({ top: 0, left: 0 })
const LARGURA = 272
const hsv = ref({ h: 225, s: 0.8, v: 0.95 })
const textoHex = ref('')
const erroHex = ref(false)

const pronta = computed(() => CORES.find((c) => c.id === props.modelValue) ?? null)
const nome = computed(() => pronta.value?.nome ?? (ehHex(props.modelValue) ? 'Cor própria' : 'Azul'))
const amostra = computed(() => (ehHex(props.modelValue) ? props.modelValue : `var(--marca-${pronta.value?.id ?? 'azul'})`))
const hexAtual = computed(() => hsvParaHex(hsv.value))

function escolher(valor) {
  emit('update:modelValue', valor)
}
function sincronizar() {
  if (ehHex(props.modelValue)) hsv.value = hexParaHsv(props.modelValue)
  textoHex.value = ehHex(props.modelValue) ? props.modelValue.toUpperCase() : ''
  erroHex.value = false
}
function mudarHsv(parcial) {
  hsv.value = { ...hsv.value, ...parcial }
  const hex = hsvParaHex(hsv.value)
  textoHex.value = hex.toUpperCase()
  escolher(hex)
}

function posicionar() {
  const r = botao.value?.getBoundingClientRect()
  if (!r) return
  const altura = painel.value?.offsetHeight ?? 330
  const acima = window.innerHeight - r.bottom < altura + 16 && r.top > altura + 16
  pos.value = { top: acima ? r.top - altura - 6 : r.bottom + 6, left: Math.min(Math.max(8, r.left), window.innerWidth - LARGURA - 8) }
}
function abrir() {
  sincronizar()
  destino.value = botao.value?.closest('dialog') ?? 'body'
  aberto.value = true
  nextTick(() => {
    posicionar()
    area.value?.focus()
  })
}
function fechar(devolverFoco = true) {
  aberto.value = false
  if (devolverFoco) botao.value?.focus()
}

// Retângulo: x = saturação, y = brilho (em cima, mais claro).
let arrastando = false
function pelaPosicao(evento) {
  const r = area.value.getBoundingClientRect()
  const s = Math.min(1, Math.max(0, (evento.clientX - r.left) / r.width))
  const v = Math.min(1, Math.max(0, 1 - (evento.clientY - r.top) / r.height))
  mudarHsv({ s, v })
}
function apertar(evento) {
  arrastando = true
  area.value.setPointerCapture?.(evento.pointerId)
  pelaPosicao(evento)
}
function mover(evento) {
  if (arrastando) pelaPosicao(evento)
}
function soltar() {
  arrastando = false
}
function tecladoArea(evento) {
  const passo = evento.shiftKey ? 0.1 : 0.02
  const mapa = { ArrowLeft: ['s', -passo], ArrowRight: ['s', passo], ArrowUp: ['v', passo], ArrowDown: ['v', -passo] }
  const m = mapa[evento.key]
  if (!m) return
  evento.preventDefault()
  mudarHsv({ [m[0]]: Math.min(1, Math.max(0, hsv.value[m[0]] + m[1])) })
}
function digitarHex() {
  let t = textoHex.value.trim()
  if (t && !t.startsWith('#')) t = `#${t}`
  erroHex.value = !!t && !ehHex(t)
  if (ehHex(t)) {
    hsv.value = hexParaHsv(t)
    escolher(t.toLowerCase())
  }
}
function teclado(evento) {
  if (evento.key === 'Escape') {
    evento.preventDefault()
    evento.stopPropagation()
    fechar()
  }
}
function cliqueFora(evento) {
  if (!aberto.value) return
  if (botao.value?.contains(evento.target) || painel.value?.contains(evento.target)) return
  fechar(false)
}
onMounted(() => {
  document.addEventListener('pointerdown', cliqueFora)
  window.addEventListener('resize', posicionar)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', cliqueFora)
  window.removeEventListener('resize', posicionar)
})
</script>

<template>
  <div class="relative">
    <button
      ref="botao"
      type="button"
      class="selecao-botao w-full max-w-[260px]"
      :aria-label="`${rotulo}: ${nome}`"
      aria-haspopup="dialog"
      :aria-expanded="aberto"
      @click="aberto ? fechar() : abrir()"
    >
      <span class="size-5 shrink-0 rounded-full border border-borda-forte" :style="{ background: amostra }" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate text-left">{{ nome }}<span v-if="!pronta && modelValue" class="ml-1.5 font-mono text-[12.5px] text-texto-3">{{ modelValue.toUpperCase() }}</span></span>
      <ChevronDown :size="17" :stroke-width="2" class="shrink-0 text-texto-3 transition-transform duration-200" :class="aberto && 'rotate-180'" aria-hidden="true" />
    </button>

    <Teleport v-if="aberto" :to="destino">
      <div
        ref="painel"
        role="dialog"
        :aria-label="rotulo"
        class="seletor-cor fixed z-[90] flex flex-col gap-3 rounded-[18px] border border-borda bg-folha p-3.5 shadow-[var(--sombra-menu)]"
        :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${LARGURA}px` }"
        @keydown="teclado"
      >
        <div
          ref="area"
          class="area relative h-[150px] cursor-crosshair touch-none rounded-[12px]"
          :style="{ '--matiz': `hsl(${hsv.h} 100% 50%)` }"
          tabindex="0"
          role="slider"
          aria-label="Tom e brilho"
          :aria-valuetext="hexAtual.toUpperCase()"
          @pointerdown="apertar"
          @pointermove="mover"
          @pointerup="soltar"
          @pointercancel="soltar"
          @keydown="tecladoArea"
        >
          <span class="marcador" :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hexAtual }" aria-hidden="true" />
        </div>
        <label class="flex flex-col gap-1">
          <span class="so-leitor">Cor (matiz)</span>
          <input class="faixa-matiz" type="range" min="0" max="359" step="1" :value="Math.round(hsv.h)" @input="mudarHsv({ h: Number($event.target.value) })">
        </label>
        <div class="flex items-center gap-2">
          <span class="size-8 shrink-0 rounded-[9px] border border-borda-forte" :style="{ background: amostra }" aria-hidden="true" />
          <label class="min-w-0 flex-1">
            <span class="so-leitor">Código da cor</span>
            <input v-model="textoHex" class="campo campo-p h-9 font-mono uppercase" :class="erroHex && 'border-erro'" maxlength="7" spellcheck="false" autocomplete="off" :aria-invalid="erroHex" @input="digitarHex">
          </label>
        </div>
        <div>
          <p class="m-0 mb-1.5 text-[12.5px] font-semibold text-texto-3">Prontas</p>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="c in CORES"
              :key="c.id"
              type="button"
              class="pronta"
              :style="{ background: `var(--marca-${c.id})` }"
              :aria-label="c.nome"
              :aria-pressed="modelValue === c.id"
              :data-dica="c.nome"
              data-dica-lado="baixo"
              @click="escolher(c.id); sincronizar()"
            >
              <Check v-if="modelValue === c.id" :size="14" :stroke-width="3" aria-hidden="true" />
            </button>
          </div>
        </div>
        <button type="button" class="botao botao-p self-end" @click="fechar()">Pronto</button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.area {
  background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--matiz));
  outline-offset: 3px;
}
.marcador {
  position: absolute;
  display: block;
  width: 18px;
  height: 18px;
  border: 3px solid #fff;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35), 0 2px 6px rgb(0 0 0 / 0.3);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.faixa-matiz {
  width: 100%;
  height: 14px;
  appearance: none;
  border-radius: 999px;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: pointer;
}
.faixa-matiz::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 3px solid #fff;
  border-radius: 999px;
  background: transparent;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
}
.faixa-matiz::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 3px solid #fff;
  border-radius: 999px;
  background: transparent;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
}
.pronta {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s var(--ease-mola);
}
.pronta:hover {
  transform: scale(1.12);
}
.seletor-cor {
  animation: cor-abre 0.18s var(--ease-saida) backwards;
}
@keyframes cor-abre {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
}
@media (prefers-reduced-motion: reduce) {
  .seletor-cor, .pronta { animation: none; transition: none; }
}
</style>
