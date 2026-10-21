<script setup>
// Uma linha da linha do tempo do Histórico: o ícone do tipo no trilho, o que aconteceu, a hora e os números.
// Estudo leva ao resultado; texto ao texto; matéria à matéria; questões ao banco. Marco de pontos não tem link.
// evento: saída de montarLinhaDoTempo() (shared/regras/historico.js). materias: { [id]: { nome, cor } }.
import { BookOpen, Brain, CalendarCheck, ChevronRight, ClipboardCheck, Crown, FileText, FileUp, Flame, Library, PenLine, Sparkles, TrendingUp } from '@lucide/vue'

const props = defineProps({
  evento: { type: Object, required: true },
  materias: { type: Object, default: () => ({}) },
})
const NuxtLink = resolveComponent('NuxtLink')

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const ICONES = { estudo: Brain, texto: Library, materia: BookOpen }
const ICONES_QUESTAO = { gerada: Sparkles, material: FileText, importada: FileUp, minha: PenLine }
const ICONES_MARCO = { dias_seguidos: Flame, proficiente: TrendingUp, recuperou: TrendingUp, dominado: Crown, revisao_no_dia: CalendarCheck }

const e = computed(() => props.evento)
const icone = computed(() => {
  if (e.value.tipo === 'questoes') return ICONES_QUESTAO[e.value.origem] ?? FileText
  if (e.value.tipo === 'marco') return ICONES_MARCO[e.value.motivo] ?? TrendingUp
  if (e.value.prova) return ClipboardCheck
  return ICONES[e.value.tipo] ?? FileText
})
const link = computed(() => ({
  estudo: e.value.prova ? `/prova/${e.value.ref}/resultado` : `/revisar/${e.value.ref}/resultado`,
  texto: `/materiais/${e.value.ref}`,
  materia: `/materias/${e.value.ref}`,
  questoes: '/questoes',
})[e.value.tipo] ?? null)

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR')
const detalhe = computed(() => {
  const hora = HORA.format(new Date(e.value.quando))
  if (e.value.tipo === 'estudo') {
    const q = `${e.value.respondidas} ${e.value.respondidas === 1 ? 'questão' : 'questões'}`
    if (e.value.prova) return `${hora}, prova, ${q} de ${e.value.total}, ${e.value.minutos} min`
    return `${hora}, ${q}, ${e.value.minutos} min${e.value.encerradaAntes ? ', encerrado antes do fim' : ''}`
  }
  if (e.value.tipo === 'texto') return `${hora}, texto novo na Biblioteca${e.value.arquivado ? ' (arquivado depois)' : ''}`
  if (e.value.tipo === 'materia') return `${hora}${e.value.arquivada ? ', arquivada depois' : ''}`
  if (e.value.tipo === 'marco') return `${hora}, ganho num estudo`
  return hora
})
// Matérias citadas na linha (texto: a dele; questões: até 2, as que mais tiveram questões).
const marcas = computed(() => {
  const ids = e.value.tipo === 'texto' ? [e.value.materiaId] : e.value.tipo === 'questoes' ? e.value.materias ?? [] : []
  const lista = ids.map((id) => props.materias[id]).filter(Boolean)
  return { mostradas: lista.slice(0, 2), mais: Math.max(0, lista.length - 2) }
})
</script>

<template>
  <li class="evento relative flex items-start gap-3" :data-tipo="evento.tipo">
    <span class="no relative z-[1] mt-1.5 grid size-9 shrink-0 place-items-center rounded-full border" aria-hidden="true">
      <component :is="icone" :size="17" :stroke-width="2" />
    </span>
    <component
      :is="link ? NuxtLink : 'div'"
      :to="link || undefined"
      class="corpo flex min-h-[48px] min-w-0 flex-1 items-center gap-3 rounded-[12px] px-2.5 py-2"
      :class="link && 'com-link'"
    >
      <div class="min-w-0 flex-1">
        <p class="m-0 text-[14.5px] font-semibold leading-snug">
          <template v-if="evento.tipo === 'materia'">
            Matéria criada:
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full" :style="{ background: `${corMateria(evento.cor)}` }" aria-hidden="true" />{{ evento.titulo }}
            </span>
          </template>
          <template v-else>{{ evento.titulo }}</template>
        </p>
        <p class="m-0 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-texto-3">
          <span>{{ detalhe }}</span>
          <span v-for="m in marcas.mostradas" :key="m.id" class="inline-flex items-center gap-1.5 text-texto-2">
            <span class="size-2 rounded-full" :style="{ background: `${corMateria(m.cor || 'cinza')}` }" aria-hidden="true" />{{ m.nome }}
          </span>
          <span v-if="marcas.mais">e mais {{ marcas.mais }}</span>
        </p>
      </div>

      <div v-if="evento.tipo === 'estudo'" class="shrink-0 text-right">
        <p class="m-0 font-titulo text-[18px] font-bold leading-none tabular-nums">{{ evento.acerto }}%</p>
        <p class="m-0 mt-1 text-[12.5px] font-semibold text-energia-texto tabular-nums">+{{ fmt(evento.pontos) }} pontos</p>
      </div>
      <p v-else-if="evento.tipo === 'marco'" class="m-0 shrink-0 text-[13px] font-semibold text-energia-texto tabular-nums">+{{ fmt(evento.pontos) }} pontos</p>
      <ChevronRight v-if="link" :size="16" :stroke-width="2" class="seta shrink-0 text-texto-3" aria-hidden="true" />
    </component>
  </li>
</template>

<style scoped>
.no {
  border-color: var(--borda);
  background: var(--folha);
  color: var(--texto-2);
}
.evento[data-tipo='estudo'] .no {
  border-color: color-mix(in oklab, var(--acento) 45%, var(--borda));
  background: var(--acento-suave);
  color: var(--acento);
}
.evento[data-tipo='marco'] .no {
  border-color: color-mix(in oklab, var(--energia) 40%, var(--borda));
  color: var(--energia);
}
.corpo {
  transition: background-color 0.15s;
}
.com-link:hover {
  background: var(--folha-2);
}
.com-link:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 1px;
}
.seta {
  transition: transform 0.2s var(--ease-mola), color 0.15s;
}
.com-link:hover .seta {
  transform: translateX(3px);
  color: var(--acento);
}
@media (prefers-reduced-motion: reduce) {
  .seta {
    transition: none;
  }
}
:global(:root.menos-movimento) .seta {
  transition: none;
}
</style>
