<script setup>
// A próxima prova: quantos dias faltam (o número grande da tela), a matéria e o plano de estudo até ela.
// Sem plano, convida a montar um; com plano, mostra o progresso e o próximo estudo.
import { Route } from '@lucide/vue'
import { contagem, diaPorExtenso, diferencaDias, formatarHora } from '#shared/regras/agenda.js'

const props = defineProps({
  prova: { type: Object, required: true },
  hoje: { type: String, required: true },
  materia: { type: Object, default: null },
  progresso: { type: Object, default: () => ({ total: 0, feitas: 0, proximo: null }) },
})
defineEmits(['plano', 'abrir'])
const dias = computed(() => diferencaDias(props.hoje, props.prova.data))
const porcento = computed(() => (props.progresso.total ? Math.round((props.progresso.feitas / props.progresso.total) * 100) : 0))
</script>

<template>
  <section class="cartao ag-prova-cartao" :style="{ '--ag-cor': materia ? `${corMateria(materia.cor)}` : 'var(--color-acento)' }" aria-labelledby="ag-prova-titulo">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p v-if="materia" class="m-0 flex items-center gap-1.5 text-[13.5px] font-semibold">
          <span class="size-2.5 rounded-full" :style="{ background: 'var(--ag-cor)' }" aria-hidden="true" />{{ materia.nome }}
        </p>
        <h2 id="ag-prova-titulo" class="titulo-cartao m-0 mt-1">
          <button type="button" class="ag-prova-link" @click="$emit('abrir', prova)">{{ prova.titulo }}</button>
        </h2>
        <p class="m-0 mt-0.5 text-[14px] text-texto-2">{{ diaPorExtenso(prova.data) }}<template v-if="prova.hora">, {{ formatarHora(prova.hora) }}</template></p>
      </div>
      <p class="m-0 shrink-0 text-right" :aria-label="dias === 0 ? 'A prova é hoje' : `Faltam ${dias} dias`">
        <template v-if="dias > 0">
          <span class="numero-grande block leading-none"><NumeroAnimado :valor="dias" /></span>
          <span class="text-[13px] text-texto-2">{{ dias === 1 ? 'dia' : 'dias' }}</span>
        </template>
        <span v-else class="selo" data-tipo="energia">É hoje</span>
      </p>
    </div>

    <div v-if="progresso.total" class="mt-4">
      <div class="flex items-baseline justify-between gap-2 text-[14px]">
        <span class="font-semibold">Plano de estudo</span>
        <span class="text-texto-2"><Fracao :valor="progresso.feitas" :total="progresso.total" /> feitos</span>
      </div>
      <div class="barra mt-2" role="progressbar" :aria-valuenow="porcento" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso do plano"><i :style="{ width: `${porcento}%` }" /></div>
      <p v-if="progresso.proximo" class="m-0 mt-2 text-[13.5px] text-texto-2">Próximo: <b class="font-semibold text-tinta">{{ progresso.proximo.titulo }}</b>, {{ contagem(progresso.proximo.data, hoje) }}.</p>
      <button type="button" class="link mt-1 text-[14px]" @click="$emit('plano', prova)">Ver ou refazer o plano</button>
    </div>
    <div v-else-if="dias > 0" class="mt-4">
      <p class="m-0 text-[14px] text-texto-2">O PGC espalha os assuntos até a véspera e deixa os últimos dias para revisar tudo.</p>
      <button type="button" class="botao botao-p mt-3" @click="$emit('plano', prova)"><Route :size="16" :stroke-width="2" aria-hidden="true" />Montar plano até a prova</button>
    </div>
  </section>
</template>

<style>
.ag-prova-cartao { position: relative; overflow: hidden; }
.ag-prova-cartao::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--ag-cor); }
.ag-prova-link { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ag-prova-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.ag-prova-link:focus-visible { outline: 2px solid var(--color-acento); outline-offset: 2px; border-radius: 4px; }
</style>
