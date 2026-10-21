<script setup>
// Semana do dia escolhido, de domingo a sábado: uma coluna por dia (no celular, uma linha por dia), com as revisões
// que vencem, os itens na ordem do dia e um botão para adicionar naquele dia.
import { Plus, RotateCcw } from '@lucide/vue'
import { NOMES_SEMANA, NOME_TIPO, rotuloCurto, diaPorExtenso, diasDaSemana, formatarHora } from '#shared/regras/agenda.js'

const props = defineProps({
  hoje: { type: String, required: true },
  selecionado: { type: String, required: true },
  eventos: { type: Object, default: () => ({}) },
  revisoes: { type: Object, default: () => ({}) },
  materias: { type: Object, default: () => ({}) },
})
defineEmits(['escolher', 'editar', 'novo'])
const dias = computed(() => diasDaSemana(props.selecionado))
const cor = (e) => (props.materias[e?.materia_id] ? `${corMateria(props.materias[e.materia_id].cor)}` : 'var(--color-texto-3)')
</script>

<template>
  <div class="grid gap-2 md:grid-cols-7">
    <section v-for="(d, i) in dias" :key="d" class="ag-coluna" :class="[d === selecionado && 'ag-escolhida', d < hoje && 'ag-passada']" :aria-label="diaPorExtenso(d)">
      <button type="button" class="ag-cabeca" :aria-pressed="d === selecionado" @click="$emit('escolher', d)">
        <span class="text-[12.5px] font-semibold text-texto-2">{{ NOMES_SEMANA[i] }}</span>
        <span class="ag-numero" :class="d === hoje && 'ag-hoje'">{{ Number(d.slice(8)) }}</span>
        <span v-if="revisoes[d]?.total" class="ag-rev md:ml-0" :aria-label="`${revisoes[d].total} questões para revisar`"><RotateCcw :size="11" :stroke-width="2.4" aria-hidden="true" />{{ revisoes[d].total }}</span>
      </button>
      <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
        <li v-for="e in eventos[d] ?? []" :key="e.id">
          <button type="button" class="ag-mini" :class="[e.tipo === 'prova' && 'ag-mini-prova', e.concluido_em && 'ag-mini-feito']" :style="{ '--ag-cor': cor(e) }" :aria-label="`Editar ${e.titulo}`" @click="$emit('editar', e)">
            <span class="flex items-center gap-1 text-[11.5px] font-semibold text-texto-2">
              <AgendaIconeTipo :tipo="e.tipo" :tamanho="12" class="ag-mini-icone" />{{ e.hora ? formatarHora(e.hora) : NOME_TIPO[e.tipo] }}
            </span>
            <span class="ag-mini-titulo">{{ e.tipo === 'prova' && materias[e.materia_id] ? `${materias[e.materia_id].nome}: ${e.titulo}` : rotuloCurto(e) }}</span>
          </button>
        </li>
      </ul>
      <button type="button" class="ag-mais" :aria-label="`Adicionar em ${diaPorExtenso(d)}`" data-dica="Adicionar neste dia" @click="$emit('novo', d)">
        <Plus :size="15" :stroke-width="2.2" aria-hidden="true" />
      </button>
    </section>
  </div>
</template>

<style>
.ag-coluna { display: flex; min-width: 0; flex-direction: column; gap: 8px; padding: 8px; border-radius: 16px; background: var(--color-folha-2); }
.ag-coluna.ag-escolhida { background: var(--color-acento-suave); box-shadow: inset 0 0 0 2px var(--color-acento); }
.ag-cabeca { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 2px 4px; border: 0; border-radius: 10px; background: transparent; color: var(--color-tinta); font: inherit; cursor: pointer; }
.ag-cabeca:focus-visible, .ag-mini:focus-visible, .ag-mais:focus-visible { outline: 2px solid var(--color-acento); outline-offset: 1px; }
.ag-mini { display: flex; width: 100%; flex-direction: column; gap: 2px; padding: 7px 8px; border: 1px solid var(--color-borda); border-radius: 12px; background: var(--color-folha); color: var(--color-tinta); font: inherit; text-align: left; cursor: pointer; transition: border-color 0.15s ease; }
.ag-mini:hover { border-color: var(--color-borda-forte); }
.ag-mini-titulo { display: -webkit-box; overflow: hidden; overflow-wrap: anywhere; hyphens: auto; font-size: 13.5px; font-weight: 600; line-height: 1.3; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.ag-mini-prova { border-color: transparent; background: color-mix(in oklab, var(--ag-cor) 16%, var(--color-folha)); box-shadow: inset 3px 0 0 var(--ag-cor); }
.ag-mini-prova .ag-mini-icone { color: var(--ag-cor); }
.ag-mini-feito .ag-mini-titulo { color: var(--color-texto-3); text-decoration: line-through; }
.ag-mais { display: grid; width: 100%; height: 34px; margin-top: auto; place-items: center; border: 0; border-radius: 10px; background: transparent; color: var(--color-texto-3); cursor: pointer; transition: background-color 0.15s ease, color 0.15s ease; }
.ag-mais:hover { background: var(--color-folha); color: var(--color-acento); }
@media (min-width: 768px) { .ag-coluna { min-height: 360px; } .ag-cabeca { flex-direction: column; align-items: flex-start; } }
</style>
