<script setup>
// Resumo do conjunto (ao lado no computador; numa folha que sobe no celular): total de questões de verdade,
// tempo, a faixa dos blocos com o nome de cada um e de onde as questões saem.
import { TIPOS_BLOCO, usaIaNoConjunto } from '#shared/regras/conjuntos.js'

const props = defineProps({
  blocos: { type: Array, required: true },
  previa: { type: Object, default: null },
  carregando: { type: Boolean, default: false },
  cota: { type: Object, default: () => ({ usadas: 0, limite: 30 }) },
  numeroGrande: { type: Boolean, default: true },
})
const total = computed(() => props.previa?.total ?? 0)
const pedidas = computed(() => props.blocos.reduce((s, b) => s + (b.quantidade ?? 0), 0))
const faixa = computed(() => props.blocos.map((b, i) => ({ tipo: b.tipo, n: props.previa?.blocos?.[i]?.total ?? b.quantidade, nome: TIPOS_BLOCO[b.tipo].nome })))
const nAssuntos = computed(() => new Set(props.blocos.flatMap((b) => (b.origem === 'erros_conjunto' ? [] : b.assuntos.map((a) => a.id)))).size)
const repeticao = computed(() => {
  const ks = props.blocos.map((b, i) => (b.repetir ? i + 1 : null)).filter(Boolean)
  if (!ks.length) return 'nenhuma'
  const de = props.blocos.some((b) => b.origem === 'erros_conjunto') ? ', de propósito' : ''
  return ks.length === 1 ? `só no bloco ${ks[0]}${de}` : `nos blocos ${ks.slice(0, -1).join(', ')} e ${ks.at(-1)}`
})
const usaIa = computed(() => usaIaNoConjunto(props.blocos))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <p class="m-0 font-semibold leading-none tabular-nums" :class="numeroGrande ? 'text-[40px]' : 'text-[32px]'">{{ total }} <span class="font-medium text-texto-2" :class="numeroGrande ? 'text-[20px]' : 'text-[17px]'">{{ total === 1 ? 'questão' : 'questões' }}</span></p>
      <p class="m-0 mt-2 text-[14px] text-texto-2">
        <template v-if="previa">cerca de {{ previa.minutos }} min, em {{ blocos.length }} {{ blocos.length === 1 ? 'bloco' : 'blocos' }}<template v-if="total < pedidas">. Pedidas: {{ pedidas }}</template></template>
        <template v-else-if="carregando">fazendo a conta</template>
        <template v-else>marque assuntos e formatos</template>
      </p>
    </div>
    <div>
      <div class="flex gap-[3px]" aria-hidden="true">
        <span v-for="(f, i) in faixa" :key="i" class="h-2.5 rounded-[3px]" :style="{ flex: Math.max(1, f.n), background: f.tipo === 'pratica' ? 'var(--tinta)' : 'var(--borda-campo)' }" />
      </div>
      <div class="mt-1.5 flex gap-[3px] text-[12px] text-texto-2">
        <span v-for="(f, i) in faixa" :key="i" class="min-w-0 truncate" :style="{ flex: Math.max(1, f.n) }">{{ i + 1 }}. {{ f.nome }} {{ f.n }}</span>
      </div>
    </div>
    <ul class="m-0 list-none p-0 text-[13.5px]">
      <li class="flex justify-between gap-3 border-t border-borda py-2"><span class="text-texto-2">Assuntos</span><b class="text-right">{{ nAssuntos }}</b></li>
      <li v-if="previa" class="flex justify-between gap-3 border-t border-borda py-2"><span class="text-texto-2">Do banco</span><b class="text-right tabular-nums">{{ previa.doBanco }}, sendo {{ previa.vencidas }} {{ previa.vencidas === 1 ? 'vencida' : 'vencidas' }}</b></li>
      <li v-if="previa?.faltam" class="flex justify-between gap-3 border-t border-borda py-2"><span class="text-texto-2">Faltam</span><b class="text-right tabular-nums">{{ previa.faltam }}{{ previa.blocos.some((b) => b.podeCompletar) ? ', o PGC tenta completar' : '' }}</b></li>
      <li class="flex justify-between gap-3 border-t border-borda py-2"><span class="text-texto-2">Usa IA</span><b class="text-right">{{ usaIa ? 'se faltar, 1 operação' : 'não' }}. Hoje: <Fracao :valor="cota.usadas" :total="cota.limite" sem-animacao /></b></li>
      <li class="flex justify-between gap-3 border-t border-borda py-2"><span class="text-texto-2">Repetição</span><b class="text-right">{{ repeticao }}</b></li>
      <li class="flex justify-between gap-3 border-t border-borda py-2"><span class="shrink-0 text-texto-2">Comentário no fim</span><b class="text-right">pela IA, {{ usaIa ? 'na mesma operação' : '1 operação' }}</b></li>
    </ul>
  </div>
</template>
