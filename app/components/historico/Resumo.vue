<script setup>
// Topo do Histórico: o mês atual contra o mesmo pedaço do mês passado (dia 1 até o dia de hoje), com as respostas
// de cada dia do mês em barras. O número principal é a quantidade de estudos concluídos no mês.
// resumo: saída de resumoDoMes(); porDia: saída de respostasPorDia() (shared/regras/historico.js).
import { Minus, TrendingDown, TrendingUp, Zap } from '@lucide/vue'

const props = defineProps({
  resumo: { type: Object, required: true },
  porDia: { type: Array, default: () => [] },
})

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR')
const trecho = computed(() => `de 1 a ${props.resumo.diaDeHoje} de ${props.resumo.mesAnterior}`)
function variacao(atual, antes) {
  const dif = atual - antes
  if (dif > 0) return { icone: TrendingUp, tipo: 'ok', texto: `+${fmt(dif)}` }
  if (dif < 0) return { icone: TrendingDown, tipo: 'aviso', texto: fmt(dif) }
  return { icone: Minus, tipo: undefined, texto: 'Igual' }
}
const varEstudos = computed(() => variacao(props.resumo.atual.estudos, props.resumo.mesmoPeriodo.estudos))
const varRespostas = computed(() => variacao(props.resumo.atual.respostas, props.resumo.mesmoPeriodo.respostas))

const barras = computed(() => props.porDia.map((d, i, l) => {
  const dia = Number(d.dia.slice(8))
  return {
    rotulo: i === 0 || i === l.length - 1 || dia % 5 === 0 ? String(dia) : '',
    valor: d.valor,
    dica: i === l.length - 1 ? `${d.valor}` : `Dia ${dia}: ${d.valor} ${d.valor === 1 ? 'resposta' : 'respostas'}`,
    destaque: i === l.length - 1,
  }
}))
const descricao = computed(() => `Respostas em cada dia de ${props.resumo.mes}: ${props.porDia.map((d) => d.valor).join(', ')}.`)
</script>

<template>
  <section class="cartao grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10" aria-labelledby="t-mes">
    <div class="min-w-0">
      <h2 id="t-mes" class="titulo-cartao m-0 first-letter:uppercase">{{ resumo.mes }} até agora</h2>
      <div class="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
        <p class="m-0 flex items-baseline gap-2.5">
          <span class="numero-grande leading-none"><NumeroAnimado :valor="resumo.atual.estudos" /></span>
          <span class="text-[15px] text-texto-2">{{ resumo.atual.estudos === 1 ? 'estudo concluído' : 'estudos concluídos' }}</span>
        </p>
      </div>
      <p class="m-0 mt-2.5 flex flex-wrap items-center gap-2 text-[13.5px] text-texto-2">
        <span class="selo" :data-tipo="varEstudos.tipo">
          <component :is="varEstudos.icone" :size="14" :stroke-width="2.2" aria-hidden="true" />
          {{ varEstudos.texto }}
        </span>
        que {{ trecho }}
      </p>

      <dl class="m-0 mt-5 grid grid-cols-3 gap-3 border-t border-borda pt-4">
        <div class="min-w-0">
          <dt class="text-[12.5px] text-texto-3">Respostas</dt>
          <dd class="m-0 mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
            <span class="font-titulo text-[22px] font-bold tabular-nums"><NumeroAnimado :valor="resumo.atual.respostas" /></span>
            <span class="text-[12.5px] font-semibold" :class="varRespostas.tipo === 'ok' ? 'text-ok' : 'text-texto-3'">{{ varRespostas.texto }}</span>
          </dd>
        </div>
        <div class="min-w-0 border-l border-borda pl-3">
          <dt class="text-[12.5px] text-texto-3">Pontos</dt>
          <dd class="m-0 mt-0.5 flex items-center gap-1.5 font-titulo text-[22px] font-bold text-energia-texto tabular-nums">
            <Zap :size="16" :stroke-width="2.1" class="text-energia" aria-hidden="true" />
            <NumeroAnimado :valor="resumo.atual.pontos" />
          </dd>
        </div>
        <div class="min-w-0 border-l border-borda pl-3">
          <dt class="text-[12.5px] text-texto-3">Estudou em</dt>
          <dd class="m-0 mt-0.5 font-titulo text-[22px] font-bold tabular-nums">
            {{ resumo.atual.dias }} <span class="font-sans text-[13px] font-medium text-texto-3">{{ resumo.atual.dias === 1 ? 'dia' : 'dias' }}</span>
          </dd>
        </div>
      </dl>
    </div>

    <figure class="m-0 flex min-w-0 flex-col justify-end">
      <figcaption class="mb-3 text-[13px] text-texto-3">Respostas em cada dia de {{ resumo.mes }}</figcaption>
      <GraficoBarras :dados="barras" :altura="120" :descricao="descricao" />
    </figure>
  </section>
</template>
