<script setup>
// Próximos 14 dias da agenda: a próxima prova em destaque (com contagem e a cor da matéria) e os outros eventos.
import { Bell, Brain, CalendarDays, CalendarPlus, ClipboardCheck, FileText, ListTodo, User } from '@lucide/vue'
import { contagem, diasEntre } from '#shared/regras/inicio.js'

const props = defineProps({
  eventos: { type: Array, default: () => [] },
  materias: { type: Array, default: () => [] },
  hojeIso: { type: String, required: true },
  carregando: { type: Boolean, default: false },
})
const ICONES = { prova: ClipboardCheck, trabalho: FileText, tarefa: ListTodo, estudo: Brain, lembrete: Bell, pessoal: User }
const TIPOS = { prova: 'Prova', trabalho: 'Trabalho', tarefa: 'Tarefa', estudo: 'Estudo', lembrete: 'Lembrete', pessoal: 'Pessoal' }
const porId = computed(() => Object.fromEntries(props.materias.map((m) => [m.id, m])))
const materiaDe = (e) => (e.materia_id ? porId.value[e.materia_id] ?? null : null)
const prova = computed(() => props.eventos.find((e) => e.tipo === 'prova') ?? null)
const outros = computed(() => props.eventos.filter((e) => e !== prova.value).slice(0, 4))
const diasProva = computed(() => (prova.value ? diasEntre(props.hojeIso, prova.value.data) : 0))
const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
const dataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const dia = (iso) => new Date(`${iso}T12:00:00Z`)
const curto = (iso) => (iso === props.hojeIso ? 'Hoje' : semana.format(dia(iso)).replace('.', ''))
const hora = (h) => (h ? String(h).slice(0, 5) : '')
</script>

<template>
  <section class="cartao" aria-labelledby="titulo-agenda">
    <div class="flex items-center justify-between gap-3">
      <h2 id="titulo-agenda" class="titulo-cartao m-0 flex items-center gap-2">
        <CalendarDays :size="18" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
        <span>Próximos 14 dias</span>
      </h2>
      <NuxtLink to="/agenda" class="link text-[14px]">Abrir a agenda</NuxtLink>
    </div>

    <div v-if="carregando" class="mt-4 flex flex-col gap-2.5" aria-hidden="true">
      <div class="esqueleto h-[76px] rounded-[14px]" />
      <div class="esqueleto h-10 rounded-[10px]" />
    </div>

    <template v-else-if="eventos.length">
      <NuxtLink
        v-if="prova"
        :to="`/agenda?dia=${prova.data}`"
        class="prova-proxima mt-4 flex items-stretch gap-3.5 rounded-[14px] border border-borda p-3.5 no-underline transition-colors hover:bg-folha-2"
      >
        <span class="w-1.5 shrink-0 rounded-full" :style="{ background: materiaDe(prova) ? `${corMateria(materiaDe(prova).cor)}` : 'var(--borda-forte)' }" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 text-[13px] font-semibold text-texto-2">
            <ClipboardCheck :size="15" :stroke-width="2" aria-hidden="true" />
            Próxima prova
          </span>
          <span class="mt-1 block truncate text-[15.5px] font-semibold text-tinta">{{ prova.titulo }}</span>
          <span class="mt-0.5 block text-[13px] text-texto-2">
            <template v-if="materiaDe(prova)">{{ materiaDe(prova).nome }}, </template>{{ dataLonga.format(dia(prova.data)) }}{{ prova.hora ? `, ${hora(prova.hora)}` : '' }}
          </span>
        </span>
        <span class="flex shrink-0 flex-col items-end justify-center text-right">
          <template v-if="diasProva > 1">
            <span class="numero-medio leading-none">{{ diasProva }}</span>
            <span class="mt-1 text-[12px] text-texto-3">dias</span>
          </template>
          <span v-else class="selo" data-tipo="aviso">{{ contagem(prova.data, hojeIso) }}</span>
        </span>
      </NuxtLink>

      <ul v-if="outros.length" class="m-0 mt-3 flex list-none flex-col p-0">
        <li v-for="e in outros" :key="e.id">
          <NuxtLink :to="`/agenda?dia=${e.data}`" class="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-2 no-underline transition-colors hover:bg-folha-2">
            <span class="flex w-9 shrink-0 flex-col items-center leading-none">
              <span class="text-[11.5px] font-semibold capitalize text-texto-3">{{ curto(e.data) }}</span>
              <span class="mt-0.5 font-titulo text-[17px] font-semibold text-tinta">{{ Number(e.data.slice(8, 10)) }}</span>
            </span>
            <component :is="ICONES[e.tipo] ?? CalendarDays" :size="16" :stroke-width="2" class="shrink-0 text-texto-2" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[14.5px] font-medium text-tinta">{{ e.titulo }}</span>
              <span class="flex items-center gap-1.5 text-[12.5px] text-texto-3">
                <span class="so-leitor">{{ TIPOS[e.tipo] }}, </span>
                <span v-if="materiaDe(e)" class="size-2 shrink-0 rounded-full" :style="{ background: `${corMateria(materiaDe(e).cor)}` }" aria-hidden="true" />
                <span class="truncate">{{ materiaDe(e)?.nome ?? TIPOS[e.tipo] }}{{ e.hora ? `, ${hora(e.hora)}` : '' }}</span>
              </span>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </template>

    <div v-else class="mt-4 rounded-[14px] bg-folha-2 px-4 py-3.5">
      <p class="m-0 text-[14.5px] font-semibold">Nada marcado por enquanto.</p>
      <p class="m-0 mt-0.5 text-[13.5px] text-texto-2">Marque as provas: o PGC monta um plano de revisão até o dia.</p>
      <NuxtLink to="/agenda?novo=prova" class="botao-secundario botao-p mt-3">
        <CalendarPlus :size="16" :stroke-width="2" aria-hidden="true" />
        <span>Marcar uma prova</span>
      </NuxtLink>
    </div>
  </section>
</template>
