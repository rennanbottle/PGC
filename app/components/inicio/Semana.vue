<script setup>
// Sua semana: questões por dia nos últimos 14 dias (barras) e a comparação dos últimos 7 com os 7 anteriores.
import { ArrowDown, ArrowUp, ChartColumn } from '@lucide/vue'
import { somarDias, variacao } from '#shared/regras/inicio.js'

const props = defineProps({
  porDia: { type: Array, default: () => [] },
  semana: { type: Number, default: 0 },
  semanaAnterior: { type: Number, default: 0 },
  hojeIso: { type: String, required: true },
})
const LETRA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const dados = computed(() => {
  const n = props.porDia.length
  return props.porDia.map((valor, i) => {
    const data = new Date(`${somarDias(props.hojeIso, i - (n - 1))}T12:00:00Z`)
    const quando = i === n - 1 ? 'Hoje' : `${SEMANA[data.getUTCDay()]} ${data.getUTCDate()}/${data.getUTCMonth() + 1}`
    return {
      rotulo: LETRA[data.getUTCDay()],
      valor,
      destaque: i === n - 1,
      // Curta de propósito: a dica aparece em cima da barra e precisa caber na tela do celular.
      dica: `${quando}: ${valor} ${valor === 1 ? 'questão' : 'questões'}`,
    }
  })
})
const vazio = computed(() => !props.porDia.some((v) => v > 0))
const mudou = computed(() => variacao(props.semana, props.semanaAnterior))
const descricao = computed(() => `Questões por dia nos últimos 14 dias. Últimos 7 dias: ${props.semana}. Os 7 dias antes: ${props.semanaAnterior}.`)
</script>

<template>
  <section class="cartao" data-guia="inicio-semana" aria-labelledby="titulo-semana">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="titulo-semana" class="titulo-cartao m-0 flex items-center gap-2">
          <ChartColumn :size="18" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
          <span>Sua semana</span>
        </h2>
        <p class="m-0 mt-2 flex items-baseline gap-2">
          <span class="numero-medio leading-none"><NumeroAnimado :valor="semana" /></span>
          <span class="text-[14px] text-texto-2">questões nos últimos 7 dias</span>
        </p>
      </div>
      <span class="selo" :data-tipo="mudou.sentido > 0 ? 'ok' : undefined">
        <ArrowUp v-if="mudou.sentido > 0" :size="13" :stroke-width="2.4" aria-hidden="true" />
        <ArrowDown v-else-if="mudou.sentido < 0" :size="13" :stroke-width="2.4" aria-hidden="true" />
        {{ mudou.texto }}
      </span>
    </div>
    <div class="mt-5">
      <p v-if="vazio" class="m-0 mb-3 text-[14px] text-texto-2">Cada dia de estudo vira uma barra aqui.</p>
      <div class="relative overflow-x-clip" :class="vazio && 'opacity-60'">
        <GraficoBarras :dados="dados" :altura="vazio ? 64 : 112" :descricao="descricao" />
      </div>
      <div class="mt-2 grid grid-cols-2 border-t border-borda pt-1.5 text-[12px] text-texto-3" aria-hidden="true">
        <span>7 dias antes</span>
        <span class="pl-1">Últimos 7 dias</span>
      </div>
    </div>
  </section>
</template>
