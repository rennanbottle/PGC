<script setup>
// Quanto a pessoa ainda lembra do assunto, de hoje até daqui a 30 dias (modelo FSRS). A linha pontilhada é 90%: a
// revisão é marcada para quando a curva chega nela. Passar o mouse mostra o dia e a porcentagem.
// Uso: <AssuntoCurvaLembranca :curva="[{ dia: 0, r: 0.97 }, ...]" :revisao-em-dias="8" proxima-revisao="2026-10-22" />
const props = defineProps({
  curva: { type: Array, required: true },
  revisaoEmDias: { type: Number, default: null },
  proximaRevisao: { type: String, default: '' },
})
const caixa = ref(null)
const L = useLargura(caixa, 640)
const A = 170
const M = { esq: 40, dir: 16, cima: 12, baixo: 24 }
const BAIXO = 0.5
const dias = computed(() => Math.max(1, props.curva.at(-1)?.dia ?? 30))
const x = (d) => M.esq + (d / dias.value) * (L.value - M.esq - M.dir)
const y = (r) => M.cima + ((1 - Math.max(BAIXO, Math.min(1, r))) / (1 - BAIXO)) * (A - M.cima - M.baixo)
const caminho = computed(() => props.curva.map((p, i) => `${i ? 'L' : 'M'}${x(p.dia).toFixed(1)} ${y(p.r).toFixed(1)}`).join(' '))
const area = computed(() => (props.curva.length ? `${caminho.value} L${x(dias.value)} ${A - M.baixo} L${x(0)} ${A - M.baixo} Z` : ''))
const GRADE = [1, 0.9, 0.8, 0.7, 0.6, 0.5]
const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const dataRevisao = computed(() => (props.proximaRevisao ? fmt.format(new Date(`${props.proximaRevisao}T12:00:00Z`)) : ''))
const pct = (r) => `${Math.round(r * 100)}%`
const focado = ref(null)
function mover(e) {
  const r = caixa.value?.getBoundingClientRect()
  if (!r || !props.curva.length) return
  const px = ((e.clientX - r.left) / r.width) * L.value
  const d = Math.round(((px - M.esq) / (L.value - M.esq - M.dir)) * dias.value)
  focado.value = props.curva[Math.max(0, Math.min(props.curva.length - 1, d))]
}
const resumo = computed(() => {
  if (!props.curva.length) return 'Sem estudos deste assunto ainda.'
  const fim = props.curva.at(-1)
  return `Hoje você lembra cerca de ${pct(props.curva[0].r)}. Sem revisar, em ${fim.dia} dias seriam ${pct(fim.r)}.${dataRevisao.value ? ` A revisão está marcada para ${dataRevisao.value}.` : ''}`
})
</script>

<template>
  <figure class="m-0">
    <figcaption class="so-leitor">{{ resumo }}</figcaption>
    <div ref="caixa" class="relative" aria-hidden="true" @pointermove="mover" @pointerleave="focado = null">
      <svg :viewBox="`0 0 ${L} ${A}`" class="block w-full overflow-visible">
        <g v-for="g in GRADE" :key="g">
          <line :x1="M.esq" :x2="L - M.dir" :y1="y(g)" :y2="y(g)" :stroke="g === 0.9 ? 'var(--borda-forte)' : 'var(--borda)'" stroke-width="1" :stroke-dasharray="g === 0.9 ? '4 4' : undefined" />
          <text :x="M.esq - 8" :y="y(g) + 4" text-anchor="end" font-size="11.5" :font-weight="g === 0.9 ? 700 : 400" fill="var(--texto-3)">{{ pct(g) }}</text>
        </g>
        <path v-if="area" :d="area" fill="var(--acento)" opacity="0.07" />
        <path v-if="curva.length" :d="caminho" pathLength="1" fill="none" stroke="var(--acento)" stroke-width="2.5" stroke-linecap="round" class="desenha-curva" />
        <template v-if="revisaoEmDias !== null && revisaoEmDias <= dias">
          <line :x1="x(revisaoEmDias)" :x2="x(revisaoEmDias)" :y1="M.cima" :y2="A - M.baixo" stroke="var(--energia)" stroke-width="1.5" stroke-dasharray="4 4" />
          <circle :cx="x(revisaoEmDias)" :cy="y(curva[revisaoEmDias]?.r ?? 0.9)" r="5" fill="var(--energia)" stroke="var(--folha)" stroke-width="2" />
          <text :x="x(revisaoEmDias) > L - 150 ? x(revisaoEmDias) - 8 : x(revisaoEmDias) + 8" :text-anchor="x(revisaoEmDias) > L - 150 ? 'end' : 'start'" :y="M.cima + 12" font-size="12" font-weight="600" fill="var(--energia-texto)">revisão {{ revisaoEmDias === 0 ? 'hoje' : `em ${dataRevisao}` }}</text>
        </template>
        <text :x="x(0)" :y="A - 6" font-size="11.5" fill="var(--texto-3)">hoje</text>
        <text :x="x(dias)" :y="A - 6" text-anchor="end" font-size="11.5" fill="var(--texto-3)">daqui a {{ dias }} dias</text>
        <line v-if="focado" :x1="x(focado.dia)" :x2="x(focado.dia)" :y1="M.cima" :y2="A - M.baixo" stroke="var(--tinta)" stroke-width="1" opacity="0.35" />
        <circle v-if="focado" :cx="x(focado.dia)" :cy="y(focado.r)" r="4.5" fill="var(--acento)" stroke="var(--folha)" stroke-width="2" />
      </svg>
      <span
        v-if="focado"
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-tinta px-2 py-1 text-[12px] font-semibold text-folha shadow-[var(--sombra-menu)]"
        :style="{ left: `${(x(focado.dia) / L) * 100}%`, top: `calc(${(y(focado.r) / A) * 100}% - 10px)` }"
      >{{ focado.dia === 0 ? 'Hoje' : `Daqui a ${focado.dia} ${focado.dia === 1 ? 'dia' : 'dias'}` }}: {{ pct(focado.r) }}</span>
    </div>
  </figure>
</template>

<style scoped>
.desenha-curva {
  stroke-dasharray: 1;
  animation: desenha-curva 1.2s var(--ease-saida) 0.2s backwards;
}
@keyframes desenha-curva {
  from {
    stroke-dashoffset: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .desenha-curva {
    animation: none;
  }
}
</style>
