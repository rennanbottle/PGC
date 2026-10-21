<script setup>
// Gráfico de uma função (até duas, uma por linha) para explicações: eixos, grade, a curva, as raízes, o vértice e
// onde corta o eixo y, com as coordenadas escritas. Embaixo, a mesma informação em frase. Passar o mouse mostra x e
// f(x). Aparece no TextoRico com um bloco ```grafico e nas correções ("Ver o gráfico").
// Uso: <GraficoFuncao texto="f(x) = x^2 - 6x + 5" />
import { analisarFuncao, descreverFuncao, lerFuncao, numeroDoGrafico as num } from '#shared/regras/grafico.js'

const props = defineProps({ texto: { type: String, required: true } })
const caixa = ref(null)
const L = useLargura(caixa, 560)
const A = 260
const M = { esq: 12, dir: 12, cima: 12, baixo: 12 }

const funcoes = computed(() => String(props.texto).split(/\n|;/).map(lerFuncao).filter(Boolean).slice(0, 2))
const analises = computed(() => funcoes.value.map((f) => analisarFuncao(f.calcular)))
// Janela comum às funções.
const janela = computed(() => {
  const js = analises.value.map((a) => a.janela)
  if (!js.length) return { xmin: -5, xmax: 5, ymin: -5, ymax: 5 }
  return { xmin: Math.min(...js.map((j) => j.xmin)), xmax: Math.max(...js.map((j) => j.xmax)), ymin: Math.min(...js.map((j) => j.ymin)), ymax: Math.max(...js.map((j) => j.ymax)) }
})
const x = (v) => M.esq + ((v - janela.value.xmin) / (janela.value.xmax - janela.value.xmin)) * (L.value - M.esq - M.dir)
const y = (v) => M.cima + (1 - (v - janela.value.ymin) / (janela.value.ymax - janela.value.ymin)) * (A - M.cima - M.baixo)
const dentroY = (v) => v >= janela.value.ymin && v <= janela.value.ymax

// Grade de 1 em 1 (ou de 2, 5, 10... quando a janela é grande).
function passo(amplitude, alvo) {
  const bruto = amplitude / alvo
  return [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((p) => p >= bruto) ?? 1000
}
const gradeX = computed(() => {
  const p = passo(janela.value.xmax - janela.value.xmin, Math.max(4, Math.floor(L.value / 48)))
  const l = []
  for (let v = Math.ceil(janela.value.xmin / p) * p; v <= janela.value.xmax; v += p) l.push(v)
  return l
})
const gradeY = computed(() => {
  const p = passo(janela.value.ymax - janela.value.ymin, 6)
  const l = []
  for (let v = Math.ceil(janela.value.ymin / p) * p; v <= janela.value.ymax; v += p) l.push(v)
  return l
})

// Curva cortada onde sai da janela (cada pedaço vira um "M ... L ...").
function caminho(amostras) {
  let d = ''
  let dentro = false
  for (const p of amostras) {
    if (!dentroY(p.y)) {
      dentro = false
      continue
    }
    d += `${dentro ? 'L' : 'M'}${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)} `
    dentro = true
  }
  return d.trim()
}
const CORES = ['var(--acento)', 'var(--energia)']
const frase = computed(() => funcoes.value.map((f, i) => descreverFuncao(f.nome, analises.value[i])).join(' '))
const pontos = computed(() => analises.value.flatMap((a, i) => a.pontos.filter((p) => dentroY(p.y)).map((p) => ({ ...p, i }))))
// Rótulo do ponto: acima, ou abaixo quando o ponto está perto do topo; à esquerda perto da borda direita.
const rotulo = (p) => ({
  x: x(p.x) > L.value - 90 ? x(p.x) - 8 : x(p.x) + 8,
  y: y(p.y) < 30 ? y(p.y) + 18 : y(p.y) - 9,
  ancora: x(p.x) > L.value - 90 ? 'end' : 'start',
})

const focado = ref(null)
function mover(e) {
  const r = caixa.value?.getBoundingClientRect()
  if (!r || !funcoes.value.length) return
  const px = ((e.clientX - r.left) / r.width) * L.value
  const vx = janela.value.xmin + ((px - M.esq) / (L.value - M.esq - M.dir)) * (janela.value.xmax - janela.value.xmin)
  const arred = Math.round(vx * 10) / 10
  const vy = funcoes.value[0].calcular(arred)
  focado.value = Number.isFinite(vy) ? { x: arred, y: vy } : null
}
</script>

<template>
  <figure v-if="funcoes.length" class="grafico-funcao m-0">
    <div ref="caixa" class="relative rounded-[12px] border border-borda bg-folha" aria-hidden="true" @pointermove="mover" @pointerleave="focado = null">
      <svg :viewBox="`0 0 ${L} ${A}`" class="block w-full">
        <line v-for="g in gradeX" :key="`x${g}`" :x1="x(g)" :x2="x(g)" :y1="M.cima" :y2="A - M.baixo" stroke="var(--borda)" stroke-width="1" />
        <line v-for="g in gradeY" :key="`y${g}`" :x1="M.esq" :x2="L - M.dir" :y1="y(g)" :y2="y(g)" stroke="var(--borda)" stroke-width="1" />
        <line v-if="dentroY(0)" :x1="M.esq" :x2="L - M.dir" :y1="y(0)" :y2="y(0)" stroke="var(--texto-2)" stroke-width="1.5" />
        <line v-if="janela.xmin <= 0 && janela.xmax >= 0" :x1="x(0)" :x2="x(0)" :y1="M.cima" :y2="A - M.baixo" stroke="var(--texto-2)" stroke-width="1.5" />
        <template v-for="g in gradeX" :key="`tx${g}`">
          <text v-if="g !== 0 && dentroY(0) && !pontos.some((p) => Math.abs(p.x - g) < 0.01 && Math.abs(p.y) < 0.01)" :x="x(g)" :y="Math.min(y(0) + 15, A - M.baixo - 2)" text-anchor="middle" font-size="11" fill="var(--texto-3)">{{ num(g) }}</text>
        </template>
        <template v-for="g in gradeY" :key="`ty${g}`">
          <text v-if="g !== 0 && janela.xmin <= 0 && janela.xmax >= 0 && !pontos.some((p) => Math.abs(p.x) < 0.01 && Math.abs(p.y - g) < 0.01)" :x="x(0) - 6" :y="y(g) + 4" text-anchor="end" font-size="11" fill="var(--texto-3)">{{ num(g) }}</text>
        </template>
        <text :x="L - M.dir - 2" :y="(dentroY(0) ? y(0) : A - M.baixo) - 6" text-anchor="end" font-size="12" font-style="italic" fill="var(--texto-2)">x</text>
        <text v-if="janela.xmin <= 0 && janela.xmax >= 0" :x="x(0) - 6" :y="M.cima + 10" text-anchor="end" font-size="12" font-style="italic" fill="var(--texto-2)">y</text>

        <path v-for="(a, i) in analises" :key="`c${i}`" :d="caminho(a.amostras)" fill="none" :stroke="CORES[i]" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :stroke-dasharray="i ? '7 5' : undefined" :pathLength="i ? undefined : 1" :class="!i && 'gf-curva'" />

        <g v-for="(p, k) in pontos" :key="`p${k}`">
          <circle :cx="x(p.x)" :cy="y(p.y)" r="5" :fill="p.rotulo.startsWith('vértice') ? 'var(--folha)' : CORES[p.i]" :stroke="CORES[p.i]" stroke-width="2.5" />
          <text :x="rotulo(p).x" :y="rotulo(p).y" :text-anchor="rotulo(p).ancora" font-size="12" font-weight="600" fill="var(--tinta)" paint-order="stroke" stroke="var(--folha)" stroke-width="3">({{ num(p.x) }}; {{ num(p.y) }})</text>
        </g>

        <template v-if="focado && dentroY(focado.y)">
          <line :x1="x(focado.x)" :x2="x(focado.x)" :y1="M.cima" :y2="A - M.baixo" stroke="var(--tinta)" stroke-width="1" opacity="0.3" />
          <circle :cx="x(focado.x)" :cy="y(focado.y)" r="4" fill="var(--acento)" stroke="var(--folha)" stroke-width="2" />
        </template>
      </svg>
      <span
        v-if="focado && dentroY(focado.y)"
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-tinta px-2 py-1 text-[12px] font-semibold text-folha"
        :style="{ left: `${(x(focado.x) / L) * 100}%`, top: `calc(${(y(focado.y) / A) * 100}% - 10px)` }"
      >x = {{ num(focado.x) }}, {{ funcoes[0].nome }} = {{ num(focado.y) }}</span>
    </div>
    <figcaption class="mt-2 text-[13.5px] leading-snug text-texto-2">
      <span v-if="funcoes.length > 1" class="mb-1 flex flex-wrap gap-x-4">
        <span v-for="(f, i) in funcoes" :key="f.nome + i" class="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true"><line x1="1" x2="21" y1="4" y2="4" :stroke="CORES[i]" stroke-width="2.5" :stroke-dasharray="i ? '5 3' : undefined" /></svg>
          <span>{{ f.nome }} = {{ f.expressao }}</span>
        </span>
      </span>
      {{ frase }}
    </figcaption>
  </figure>
</template>

<style scoped>
.gf-curva {
  stroke-dasharray: 1;
  animation: gf-desenha 0.9s var(--ease-saida) backwards;
}
@keyframes gf-desenha {
  from { stroke-dashoffset: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .gf-curva { animation: none; }
}
</style>
