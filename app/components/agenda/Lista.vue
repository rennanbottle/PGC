<script setup>
// Lista dos próximos dias (padrão no celular): no topo, a tira da semana para escolher o dia; embaixo, a partir do
// dia escolhido, cada dia com itens ou revisões, com a contagem ("hoje", "amanhã", "faltam 3 dias").
import { RotateCcw } from '@lucide/vue'
import { NOMES_SEMANA, contagem, diaPorExtenso, diasDaSemana } from '#shared/regras/agenda.js'

const props = defineProps({
  dias: { type: Array, default: () => [] },
  hoje: { type: String, required: true },
  selecionado: { type: String, required: true },
  eventos: { type: Object, default: () => ({}) },
  revisoes: { type: Object, default: () => ({}) },
  materias: { type: Object, default: () => ({}) },
})
defineEmits(['escolher', 'editar', 'concluir', 'excluir', 'novo'])
const semana = computed(() => diasDaSemana(props.selecionado))
const cor = (e) => (props.materias[e?.materia_id] ? `${corMateria(props.materias[e.materia_id].cor)}` : 'var(--color-texto-3)')
function estudar(d) {
  const lista = props.revisoes[d]?.materias ?? []
  return lista.length === 1 && lista[0].materia_id ? `/revisar/nova?materia=${lista[0].materia_id}` : '/revisar/nova'
}
function rotulo(d) {
  const n = props.eventos[d]?.length ?? 0
  const r = props.revisoes[d]?.total ?? 0
  return [diaPorExtenso(d), d === props.hoje && 'hoje', n && `${n} ${n === 1 ? 'item' : 'itens'}`, r && `${r} para revisar`].filter(Boolean).join(', ')
}
</script>

<template>
  <div>
    <div class="ag-tira" role="group" aria-label="Dias da semana">
      <button v-for="(d, i) in semana" :key="d" type="button" class="ag-tira-dia" :class="d === selecionado && 'ag-tira-escolhido'" :aria-pressed="d === selecionado" :aria-label="rotulo(d)" @click="$emit('escolher', d)">
        <span class="text-[11.5px] font-semibold text-texto-3">{{ NOMES_SEMANA[i] }}</span>
        <span class="ag-numero" :class="d === hoje && 'ag-hoje'">{{ Number(d.slice(8)) }}</span>
        <span class="flex h-1.5 gap-[3px]" aria-hidden="true">
          <i v-for="e in (eventos[d] ?? []).slice(0, 3)" :key="e.id" class="size-1.5 rounded-full" :style="{ background: cor(e) }" />
        </span>
      </button>
    </div>

    <div class="mt-2 flex flex-col">
      <section v-for="d in dias" :key="d" class="ag-grupo" :aria-labelledby="`ag-grupo-${d}`">
        <h3 :id="`ag-grupo-${d}`" class="ag-grupo-cabeca">
          <span>{{ diaPorExtenso(d) }}</span>
          <span class="selo" :data-tipo="d === hoje ? 'acento' : undefined">{{ contagem(d, hoje) }}</span>
        </h3>
        <TransitionGroup name="lista" tag="ul" class="m-0 flex list-none flex-col gap-1 p-0">
          <li v-for="e in eventos[d] ?? []" :key="e.id">
            <AgendaItem :evento="e" :materia="materias[e.materia_id] ?? null" :hoje="hoje" @concluir="(ev, sim) => $emit('concluir', ev, sim)" @editar="$emit('editar', $event)" @excluir="$emit('excluir', $event)" />
          </li>
        </TransitionGroup>
        <p v-if="revisoes[d]?.total" class="m-0 flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 pl-2.5 text-[14px] text-texto-2">
          <RotateCcw :size="15" :stroke-width="2" aria-hidden="true" class="text-acento" />
          <span><b class="font-semibold text-tinta">{{ revisoes[d].total }}</b> {{ revisoes[d].total === 1 ? 'questão volta' : 'questões voltam' }} para revisão</span>
          <NuxtLink v-if="d === hoje" :to="estudar(d)" class="link font-semibold">Estudar estas</NuxtLink>
        </p>
        <p v-if="!eventos[d]?.length && !revisoes[d]?.total" class="m-0 pl-2.5 text-[14px] text-texto-2">
          Nada marcado. <button type="button" class="link text-[14px]" @click="$emit('novo', d)">Adicionar</button>
        </p>
      </section>
    </div>
  </div>
</template>

<style>
.ag-tira { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.ag-tira-dia { display: flex; min-height: 64px; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 6px 0; border: 0; border-radius: 14px; background: transparent; color: var(--color-tinta); font: inherit; cursor: pointer; transition: background-color 0.15s ease; }
.ag-tira-dia:hover { background: var(--color-folha-2); }
.ag-tira-dia:focus-visible { outline: 2px solid var(--color-acento); outline-offset: 1px; }
.ag-tira-escolhido { background: var(--color-acento-suave); box-shadow: inset 0 0 0 2px var(--color-acento); }
.ag-grupo { padding: 12px 0 10px; }
.ag-grupo + .ag-grupo { border-top: 1px solid var(--color-borda); }
.ag-grupo-cabeca { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 6px; padding-left: 10px; font-family: var(--font-titulo); font-size: 16px; font-weight: 600; }
</style>
