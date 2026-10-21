<script setup>
// Proficiência do assunto depois de cada estudo ou prova, na escala de 300 a 800. A linha tracejada é a proficiência
// que o domínio pede no ritmo da pessoa. Passar o mouse (ou focar) num ponto mostra a data e o valor; a prova de
// domínio ou simulado aparece com o ponto vazado. A linha se desenha uma vez ao aparecer.
// Uso: <AssuntoLinhaProficiencia :pontos="[{ data, valor, prova }]" :meta="650" />
const props = defineProps({
  pontos: { type: Array, required: true },
  meta: { type: Number, default: null },
})
const caixa = ref(null)
const L = useLargura(caixa, 640)
const A = 190
const M = { esq: 40, dir: 16, cima: 14, baixo: 26 }
const MIN = 300
const MAX = 800
const x = (i) => (props.pontos.length < 2 ? (M.esq + L.value - M.dir) / 2 : M.esq + (i * (L.value - M.esq - M.dir)) / (props.pontos.length - 1))
const y = (v) => M.cima + (1 - (Math.min(MAX, Math.max(MIN, v)) - MIN) / (MAX - MIN)) * (A - M.cima - M.baixo)
const caminho = computed(() => props.pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' '))
const GRADE = [300, 400, 500, 600, 700, 800]
const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const dia = (d) => (d ? fmt.format(new Date(d)) : '')
// Com muitos pontos, só alguns rótulos de data cabem embaixo (um a cada 64 px, mais ou menos).
const passoRotulo = computed(() => Math.max(1, Math.ceil(props.pontos.length / Math.max(2, Math.floor((L.value - M.esq) / 64)))))
const focado = ref(-1)
const resumo = computed(() => {
  const p = props.pontos
  if (!p.length) return 'Sem estudos deste assunto ainda.'
  return `Proficiência de ${p[0].valor} em ${dia(p[0].data)} para ${p.at(-1).valor} em ${dia(p.at(-1).data)}, em ${p.length} ${p.length === 1 ? 'estudo' : 'estudos'}.${props.meta ? ` O domínio pede ${props.meta}.` : ''}`
})
</script>

<template>
  <figure class="m-0">
    <figcaption class="so-leitor">{{ resumo }}</figcaption>
    <div ref="caixa" class="relative" aria-hidden="true">
      <svg :viewBox="`0 0 ${L} ${A}`" class="block w-full overflow-visible">
        <g v-for="g in GRADE" :key="g">
          <line :x1="M.esq" :x2="L - M.dir" :y1="y(g)" :y2="y(g)" stroke="var(--borda)" stroke-width="1" />
          <text :x="M.esq - 8" :y="y(g) + 4" text-anchor="end" font-size="11.5" fill="var(--texto-3)">{{ g }}</text>
        </g>
        <template v-if="meta">
          <line :x1="M.esq" :x2="L - M.dir" :y1="y(meta)" :y2="y(meta)" stroke="var(--ok-vivo)" stroke-width="1.5" stroke-dasharray="6 5" />
          <text :x="M.esq + 6" :y="y(meta) - 6" font-size="12" font-weight="600" fill="var(--ok)">domínio {{ meta }}</text>
        </template>
        <path v-if="pontos.length > 1" :d="caminho" pathLength="1" fill="none" stroke="var(--acento)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" class="desenha-linha" />
        <g v-for="(p, i) in pontos" :key="p.id ?? i" class="ponto" :style="{ '--i': i }" @pointerenter="focado = i" @pointerleave="focado = -1">
          <circle :cx="x(i)" :cy="y(p.valor)" r="14" fill="transparent" />
          <circle :cx="x(i)" :cy="y(p.valor)" :r="focado === i ? 6 : 4.5" :fill="p.prova ? 'var(--folha)' : 'var(--acento)'" stroke="var(--acento)" :stroke-width="p.prova ? 2.5 : 2" class="marca" />
          <text v-if="(i % passoRotulo === 0 && pontos.length - 1 - i >= passoRotulo) || i === pontos.length - 1" :x="x(i)" :y="A - 6" :text-anchor="pontos.length > 1 && i === pontos.length - 1 ? 'end' : pontos.length > 1 && i === 0 ? 'start' : 'middle'" font-size="11.5" fill="var(--texto-3)">{{ dia(p.data) }}</text>
        </g>
      </svg>
      <span
        v-if="focado >= 0"
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-tinta px-2 py-1 text-[12px] font-semibold text-folha shadow-[var(--sombra-menu)] aparece"
        :style="{ left: `${(x(focado) / L) * 100}%`, top: `calc(${(y(pontos[focado].valor) / A) * 100}% - 10px)` }"
      >{{ dia(pontos[focado].data) }}: {{ pontos[focado].valor }}{{ pontos[focado].prova ? ', prova' : '' }}</span>
    </div>
  </figure>
</template>

<style scoped>
.desenha-linha {
  stroke-dasharray: 1;
  animation: desenha-linha 1.1s var(--ease-saida) 0.15s backwards;
}
@keyframes desenha-linha {
  from {
    stroke-dashoffset: 1;
  }
}
.ponto .marca {
  transition: r 0.15s;
  animation: pop 0.35s var(--ease-mola) backwards;
  animation-delay: calc(var(--i) * 90ms + 300ms);
  transform-box: fill-box;
  transform-origin: center;
}
@media (prefers-reduced-motion: reduce) {
  .desenha-linha,
  .ponto .marca {
    animation: none;
  }
}
</style>
