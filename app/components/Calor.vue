<script setup>
// Mapa de calor dos dias de estudo (como o do GitHub): uma coluna por semana, uma linha por dia da semana.
// Quanto mais questões no dia, mais forte o azul. O número de cada dia aparece ao passar o mouse.
// Uso: <Calor :dias="[{ data: '2026-10-08', valor: 12 }, ...]" :semanas="16" />
const props = defineProps({
  dias: { type: Array, required: true },
  semanas: { type: Number, default: 16 },
  hoje: { type: String, default: '' },
})
const NOMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const mapa = computed(() => Object.fromEntries(props.dias.map((d) => [d.data, d.valor])))
const fim = computed(() => {
  const d = props.hoje ? new Date(`${props.hoje}T12:00:00`) : new Date()
  d.setHours(12, 0, 0, 0)
  return d
})
const colunas = computed(() => {
  const ultimo = new Date(fim.value)
  const inicio = new Date(ultimo)
  inicio.setDate(inicio.getDate() - (props.semanas * 7 - 1) - ultimo.getDay())
  const saida = []
  for (let s = 0; s < props.semanas; s++) {
    const coluna = []
    for (let d = 0; d < 7; d++) {
      const dia = new Date(inicio)
      dia.setDate(inicio.getDate() + s * 7 + d)
      const chave = dia.toISOString().slice(0, 10)
      coluna.push({ chave, valor: mapa.value[chave] ?? 0, futuro: dia > ultimo, dia })
    }
    saida.push(coluna)
  }
  return saida
})
const maior = computed(() => Math.max(1, ...props.dias.map((d) => d.valor)))
function tom(v) {
  if (!v) return 'var(--folha-3)'
  const p = v / maior.value
  const mistura = p > 0.75 ? 100 : p > 0.5 ? 72 : p > 0.25 ? 48 : 28
  return `color-mix(in oklab, var(--acento) ${mistura}%, var(--folha-3))`
}
const dataLonga = (d) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(d)
const total = computed(() => props.dias.reduce((s, d) => s + d.valor, 0))
const diasComEstudo = computed(() => props.dias.filter((d) => d.valor > 0).length)
</script>

<template>
  <figure class="m-0">
    <figcaption class="so-leitor">Dias de estudo nas últimas {{ semanas }} semanas: {{ diasComEstudo }} dias com estudo, {{ total }} questões.</figcaption>
    <div class="flex gap-2" aria-hidden="true">
      <div class="flex flex-col justify-between py-[1px] text-[10.5px] font-semibold text-texto-3">
        <span v-for="(n, i) in NOMES" :key="n" class="h-[13px] leading-[13px]" :class="i % 2 === 0 && 'invisible'">{{ n }}</span>
      </div>
      <div class="flex gap-[3px] overflow-x-auto">
        <div v-for="(coluna, s) in colunas" :key="s" class="flex flex-col gap-[3px]">
          <span
            v-for="c in coluna"
            :key="c.chave"
            class="block size-[13px] rounded-[3.5px] transition-transform duration-150 hover:scale-125"
            :class="c.futuro && 'opacity-0'"
            :style="{ background: tom(c.valor), animation: `aparece .4s ease ${s * 18}ms both` }"
            :title="c.futuro ? '' : `${dataLonga(c.dia)}: ${c.valor} ${c.valor === 1 ? 'questão' : 'questões'}`"
          />
        </div>
      </div>
    </div>
    <div class="mt-2.5 flex items-center justify-end gap-1.5 text-[11.5px] font-semibold text-texto-3" aria-hidden="true">
      <span>Menos</span>
      <span v-for="m in [0, 28, 48, 72, 100]" :key="m" class="size-[11px] rounded-[3px]" :style="{ background: m ? `color-mix(in oklab, var(--acento) ${m}%, var(--folha-3))` : 'var(--folha-3)' }" />
      <span>Mais</span>
    </div>
  </figure>
</template>
