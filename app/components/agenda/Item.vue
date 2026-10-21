<script setup>
// Um item da agenda numa lista: o círculo marca como feito (o visto salta), o título abre a edição e a lixeira apaga
// (a tela oferece "Desfazer"). Embaixo do título: tipo, hora, duração, matéria (cor e nome) e se repete ou é do plano.
import { Check, Repeat, Route } from '@lucide/vue'
import { NOME_TIPO, contagem, formatarDuracao, formatarHora } from '#shared/regras/agenda.js'

const props = defineProps({
  evento: { type: Object, required: true },
  materia: { type: Object, default: null },
  hoje: { type: String, required: true },
  mostrarContagem: { type: Boolean, default: false },
})
defineEmits(['concluir', 'editar', 'excluir'])
const feito = computed(() => !!props.evento.concluido_em)
const quando = computed(() => [formatarHora(props.evento.hora), formatarDuracao(props.evento.duracao_min)].filter(Boolean).join(', '))
</script>

<template>
  <div class="ag-item" :class="[feito && 'ag-feito', evento.tipo === 'prova' && 'ag-prova']" :style="materia ? { '--ag-cor': `${corMateria(materia.cor)}` } : undefined">
    <button type="button" class="ag-marca" :aria-pressed="feito" :aria-label="`${feito ? 'Desmarcar' : 'Marcar como feito'}: ${evento.titulo}`" @click="$emit('concluir', evento, !feito)">
      <span><Check :size="13" :stroke-width="3.2" aria-hidden="true" /></span>
    </button>
    <button type="button" class="ag-corpo" :aria-label="`Editar ${evento.titulo}`" @click="$emit('editar', evento)">
      <span class="ag-titulo">{{ evento.titulo }}</span>
      <span class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-texto-2">
        <span class="inline-flex items-center gap-1" :class="evento.tipo === 'prova' && 'font-semibold text-tinta'">
          <AgendaIconeTipo :tipo="evento.tipo" :tamanho="13" :class="evento.tipo === 'prova' && materia && 'ag-icone-cor'" />{{ NOME_TIPO[evento.tipo] }}
        </span>
        <span v-if="quando">{{ quando }}</span>
        <span v-if="materia" class="inline-flex items-center gap-1.5">
          <span class="size-2 rounded-full" :style="{ background: `${corMateria(materia.cor)}` }" aria-hidden="true" />{{ materia.nome }}
        </span>
        <span v-if="evento.origem === 'plano'" class="inline-flex items-center gap-1"><Route :size="13" :stroke-width="2" aria-hidden="true" />Plano da prova</span>
        <span v-else-if="evento.serie" class="inline-flex items-center gap-1"><Repeat :size="13" :stroke-width="2" aria-hidden="true" />Toda semana</span>
        <span v-if="mostrarContagem && !feito" class="font-semibold text-tinta">{{ contagem(evento.data, hoje) }}</span>
        <span v-if="feito" class="font-semibold text-ok">Feito</span>
      </span>
    </button>
    <BotaoLixeira class="ag-lixeira" :rotulo="`Apagar ${evento.titulo}`" @click="$emit('excluir', evento)" />
  </div>
</template>

<style>
.ag-item { position: relative; display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 4px; padding: 2px 4px 2px 0; border-radius: 14px; transition: background-color 0.15s ease; }
.ag-item:hover { background: var(--color-folha-2); }
.ag-item.ag-prova { background: color-mix(in oklab, var(--ag-cor, var(--color-acento)) 12%, transparent); }
.ag-item.ag-prova::before { content: ''; position: absolute; left: 0; top: 9px; bottom: 9px; width: 3px; border-radius: 3px; background: var(--ag-cor, var(--color-acento)); }
.ag-icone-cor { color: var(--ag-cor); }
.ag-marca { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 50%; background: transparent; cursor: pointer; }
.ag-marca > span { display: grid; place-items: center; width: 22px; height: 22px; border: 2px solid var(--color-borda-forte); border-radius: 50%; color: transparent; transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease; }
.ag-marca:hover > span { border-color: var(--color-ok); color: var(--color-ok); }
.ag-feito .ag-marca > span { border-color: var(--color-ok); background: var(--color-ok); color: var(--color-folha); animation: ag-salta 0.4s cubic-bezier(0.3, 1.7, 0.5, 1); }
.ag-feito .ag-titulo { color: var(--color-texto-2); text-decoration: line-through; }
.ag-corpo { display: flex; min-width: 0; flex-direction: column; gap: 3px; padding: 7px 2px; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ag-titulo { display: -webkit-box; overflow: hidden; font-size: 15px; font-weight: 600; line-height: 1.3; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.ag-marca:focus-visible, .ag-corpo:focus-visible { outline: 2px solid var(--color-acento); outline-offset: 1px; }
@media (hover: hover) {
  .ag-item .ag-lixeira { opacity: 0; transition: opacity 0.15s ease; }
  .ag-item:hover .ag-lixeira, .ag-item:focus-within .ag-lixeira { opacity: 1; }
}
@keyframes ag-salta { from { transform: scale(0.5); } to { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .ag-feito .ag-marca > span { animation: none; } }
:root.menos-movimento .ag-feito .ag-marca > span { animation: none; }
</style>
