<script setup>
// Painel do dia escolhido: os itens (marcar feito, editar, apagar), as questões que voltam para revisão nele, por
// matéria, com "Estudar estas" (só hoje: antes disso elas ainda não venceram) e os estudos já feitos no dia.
import { CircleCheck, RotateCcw } from '@lucide/vue'
import { contagem, diaPorExtenso } from '#shared/regras/agenda.js'

const props = defineProps({
  dia: { type: String, required: true },
  hoje: { type: String, required: true },
  eventos: { type: Array, default: () => [] },
  revisao: { type: Object, default: null },
  estudos: { type: Array, default: () => [] },
  materias: { type: Object, default: () => ({}) },
})
defineEmits(['novo', 'editar', 'concluir', 'excluir'])
const ehHoje = computed(() => props.dia === props.hoje)
const passado = computed(() => props.dia < props.hoje)
const linhas = computed(() => (props.revisao?.materias ?? []).map((r) => ({ ...r, materia: props.materias[r.materia_id] ?? null })))
const questoesFeitas = computed(() => props.estudos.reduce((s, e) => s + (e.total ?? 0), 0))
</script>

<template>
  <section class="cartao" data-guia="agenda-lado" aria-labelledby="ag-dia-titulo">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="ag-dia-titulo" class="titulo-secao m-0">{{ diaPorExtenso(dia) }}</h2>
        <p class="m-0 mt-1">
          <span v-if="ehHoje" class="selo" data-tipo="acento">Hoje</span>
          <span v-else class="text-[14px] text-texto-2">{{ contagem(dia, hoje).replace(/^./, (l) => l.toUpperCase()) }}</span>
        </p>
      </div>
      <BotaoAdicionar redondo :rotulo="`Adicionar em ${diaPorExtenso(dia)}`" @click="$emit('novo', dia)" />
    </div>

    <TransitionGroup name="lista" tag="ul" class="m-0 mt-3 flex list-none flex-col gap-1 p-0" aria-label="Itens do dia">
      <li v-for="e in eventos" :key="e.id">
        <AgendaItem :evento="e" :materia="materias[e.materia_id] ?? null" :hoje="hoje" @concluir="(ev, sim) => $emit('concluir', ev, sim)" @editar="$emit('editar', $event)" @excluir="$emit('excluir', $event)" />
      </li>
    </TransitionGroup>
    <p v-if="!eventos.length" class="m-0 mt-2 text-[14.5px] text-texto-2">
      Nada marcado neste dia.
      <button type="button" class="link text-[14.5px]" @click="$emit('novo', dia)">Adicionar</button>
    </p>

    <div v-if="revisao?.total" class="mt-5 border-t border-borda pt-4">
      <p class="m-0 flex items-center gap-2 text-[15px] font-semibold">
        <RotateCcw :size="17" :stroke-width="2" aria-hidden="true" class="text-acento" />
        <span><NumeroAnimado :valor="revisao.total" /> {{ revisao.total === 1 ? 'questão volta' : 'questões voltam' }} para revisão</span>
      </p>
      <p v-if="!ehHoje" class="m-0 mt-1 text-[13.5px] text-texto-2">Elas ficam prontas para estudar neste dia.</p>
      <ul class="m-0 mt-2 flex list-none flex-col p-0">
        <li v-for="l in linhas" :key="l.materia_id ?? 'sem'" class="flex min-h-10 items-center gap-2.5 text-[14.5px]">
          <span class="size-2.5 shrink-0 rounded-full" :style="{ background: l.materia ? `${corMateria(l.materia.cor)}` : 'var(--color-texto-3)' }" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ l.materia?.nome ?? 'Sem matéria' }}</span>
          <span class="tabular-nums text-texto-2">{{ l.n }}</span>
          <NuxtLink v-if="ehHoje && l.materia_id" :to="`/revisar/nova?materia=${l.materia_id}`" class="link shrink-0 text-[14px] font-semibold" :aria-label="`Estudar as ${l.n} questões de ${l.materia?.nome ?? 'sem matéria'}`">Estudar estas</NuxtLink>
        </li>
      </ul>
    </div>

    <div v-if="estudos.length && (passado || ehHoje)" class="mt-5 flex items-start gap-2 border-t border-borda pt-4 text-[14.5px]">
      <CircleCheck :size="18" :stroke-width="2" aria-hidden="true" class="mt-0.5 shrink-0 text-ok" />
      <p class="m-0">
        <b>{{ estudos.length === 1 ? 'Um estudo feito' : `${estudos.length} estudos feitos` }}</b>
        <span class="text-texto-2">, {{ questoesFeitas }} {{ questoesFeitas === 1 ? 'questão' : 'questões' }}.</span>
        <NuxtLink :to="estudos.at(-1).tipo === 'prova' ? `/prova/${estudos.at(-1).id}/resultado` : `/revisar/${estudos.at(-1).id}/resultado`" class="link ml-1">Ver o último</NuxtLink>
      </p>
    </div>
  </section>
</template>
