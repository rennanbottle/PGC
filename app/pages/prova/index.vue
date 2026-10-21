<script setup>
// Prova: simulados com tempo, do jeito do dia da prova. Em cima, a prova em andamento (se houver). Depois, a
// última nota com a comparação e o minigráfico das últimas, as provas marcadas na Agenda (para montar um
// simulado antes) e a lista das provas feitas. Travada até cumprir os requisitos de desbloqueios.js.
import { ArrowDown, ArrowUp, CalendarDays, Clock, FileText, Play, Plus } from '@lucide/vue'
import { avaliarDesbloqueios, estaLiberado } from '#shared/regras/desbloqueios.js'
import { duracao, formatoDe } from '#shared/regras/provas.js'

useHead({ title: 'Prova | PGC' })
const estatisticas = useEstatisticas()
const liberada = computed(() => estaLiberado('prova', estatisticas.value))
const bloqueio = computed(() => avaliarDesbloqueios(estatisticas.value).find((d) => d.id === 'prova'))
const { data } = await useListaProvas()

const provas = computed(() => data.value?.provas ?? [])
const andamento = computed(() => provas.value.find((p) => p.status === 'em_andamento') ?? null)
const feitas = computed(() => provas.value.filter((p) => p.status === 'entregue'))
const ultima = computed(() => feitas.value[0] ?? null)
// Provas feitas em páginas de 10.
const paginaFeitas = ref(1)
const feitasNaPagina = computed(() => feitas.value.slice((paginaFeitas.value - 1) * 10, paginaFeitas.value * 10))
// Compara com a anterior do mesmo formato (ENEM com ENEM): formatos diferentes têm notas diferentes.
const anterior = computed(() => (ultima.value ? feitas.value.slice(1).find((p) => p.formato === ultima.value.formato) ?? null : null))
const diferenca = computed(() => (ultima.value && anterior.value ? ultima.value.porcentagem - anterior.value.porcentagem : null))
const serie = computed(() => feitas.value.slice(0, 8).map((p) => p.porcentagem).reverse())
const agendadas = computed(() => data.value?.agendadas ?? [])

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' })
const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' })
// Data sem hora (2026-10-16, da Agenda) vale o dia todo em Brasília, não a meia-noite de Londres.
const paraData = (d) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${d}T12:00:00-03:00` : d)
const dia = (d) => (d ? fmtDia.format(paraData(d)) : '')
const curto = (d) => (d ? fmtCurto.format(paraData(d)) : '')
function emDias(d) {
  const ms = new Date(`${String(d).slice(0, 10)}T12:00:00-03:00`) - new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())}T12:00:00-03:00`)
  const n = Math.round(ms / 86400000)
  return n <= 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`
}
</script>

<template>
  <TelaBloqueada v-if="!liberada && bloqueio" nome="Prova" resumo="Simulados com cronômetro, montados do seu jeito, para treinar antes da prova de verdade." :requisitos="bloqueio.requisitos" />
  <div v-else class="pb-12">
    <CabecalhoPagina titulo="Prova" descricao="Simulados com tempo, do jeito do dia da prova. A nota só aparece quando você entrega.">
      <template #acoes>
        <NuxtLink to="/prova/nova" class="botao gap-2 no-underline" data-guia="prova-montar"><Plus :size="17" :stroke-width="2.2" aria-hidden="true" />Montar prova</NuxtLink>
      </template>
    </CabecalhoPagina>

    <!-- Em andamento -->
    <section v-if="andamento" class="cartao-destaque entra mt-6 flex flex-wrap items-center justify-between gap-4" style="--i: 0" aria-labelledby="titulo-andamento">
      <div class="min-w-0">
        <h2 id="titulo-andamento" class="m-0 text-[16px] font-semibold">Prova em andamento: {{ andamento.titulo }}</h2>
        <p class="m-0 mt-1 flex flex-wrap items-center gap-x-2 text-[14px] text-texto-2">
          <span><Fracao :valor="andamento.respondidas" :total="andamento.total" sem-animacao /> respondidas.</span>
          <span v-if="andamento.restante > 0" class="flex items-center gap-1"><Clock :size="14" :stroke-width="2" aria-hidden="true" />Faltam {{ duracao(andamento.restante) }} no relógio, que continua correndo.</span>
          <span v-else class="flex items-center gap-1"><Clock :size="14" :stroke-width="2" aria-hidden="true" />O tempo acabou. Ela é entregue com o que estava marcado.</span>
        </p>
      </div>
      <NuxtLink :to="`/prova/${andamento.id}`" class="botao gap-2 no-underline"><Play :size="16" :stroke-width="2.2" aria-hidden="true" />{{ andamento.restante > 0 ? 'Continuar a prova' : 'Ver a nota' }}</NuxtLink>
    </section>

    <template v-if="feitas.length || agendadas.length">
      <div class="mt-4 grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]" :class="!andamento && 'mt-6'">
        <!-- Última nota -->
        <section v-if="ultima" class="cartao entra" style="--i: 1" aria-labelledby="titulo-ultima" data-guia="prova-notas">
          <h2 id="titulo-ultima" class="m-0 text-[13.5px] font-semibold text-texto-2">Última nota</h2>
          <p class="m-0 mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="numero-grande"><NumeroAnimado :valor="ultima.porcentagem" sufixo="%" /></span>
            <span class="text-[15px] text-texto-2"><Fracao :valor="ultima.certas" :total="ultima.total" /> certas</span>
          </p>
          <p v-if="diferenca !== null" class="m-0 mt-2 flex flex-wrap items-center gap-2 text-[13.5px] text-texto-2">
            <span class="selo" :data-tipo="diferenca > 0 ? 'ok' : diferenca < 0 ? 'erro' : undefined">
              <ArrowUp v-if="diferenca > 0" :size="13" :stroke-width="2.6" aria-hidden="true" /><ArrowDown v-else-if="diferenca < 0" :size="13" :stroke-width="2.6" aria-hidden="true" />{{ diferenca > 0 ? `+${diferenca}` : diferenca < 0 ? diferenca : 'Igual' }}
            </span>
            que a prova {{ formatoDe(ultima.formato).nome }} anterior ({{ anterior.porcentagem }}%, {{ curto(anterior.entregueEm) }})
          </p>
          <p v-else class="m-0 mt-2 text-[13.5px] text-texto-2">A comparação aparece na segunda prova do mesmo formato.</p>
          <div class="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-borda pt-4">
            <p class="m-0 min-w-0 text-[14px]">
              <b class="block truncate">{{ ultima.titulo }}</b>
              <span class="text-texto-2">{{ dia(ultima.entregueEm) }}, em {{ duracao(ultima.segundos) }} de {{ duracao(ultima.minutos * 60) }}.</span>
              <NuxtLink :to="`/prova/${ultima.id}/resultado`" class="link ml-1">Ver resultado</NuxtLink>
            </p>
            <div v-if="serie.length > 1" class="ml-auto flex items-end gap-3">
              <span class="text-right text-[12.5px] leading-tight text-texto-2">Suas últimas {{ serie.length }} provas<br><span class="text-texto-3">a última é o ponto marcado</span></span>
              <Minigrafico :valores="serie" :largura="150" :altura="40" />
            </div>
          </div>
        </section>

        <!-- Na agenda -->
        <section class="cartao entra" :class="!ultima && 'lg:col-span-2'" style="--i: 2" aria-labelledby="titulo-agenda">
          <h2 id="titulo-agenda" class="titulo-cartao m-0 flex items-center gap-2"><CalendarDays :size="17" :stroke-width="2" class="text-texto-2" aria-hidden="true" />Na sua agenda</h2>
          <ul v-if="agendadas.length" class="m-0 mt-3 list-none p-0">
            <li v-for="e in agendadas" :key="e.id" class="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-borda py-3">
              <span class="min-w-0 flex-1">
                <b class="block truncate text-[14.5px]">{{ e.titulo }}</b>
                <span class="text-[13px] text-texto-2">{{ dia(e.data) }}, {{ emDias(e.data) }}</span>
              </span>
              <NuxtLink :to="`/prova/nova?evento=${e.id}`" class="botao-secundario botao-p no-underline">Montar simulado</NuxtLink>
            </li>
          </ul>
          <p v-else class="m-0 mt-2 text-[14px] text-texto-2">Nenhuma prova marcada. Marque a data na <NuxtLink to="/agenda" class="link">Agenda</NuxtLink> e o PGC lembra de fazer um simulado antes.</p>
        </section>
      </div>

      <!-- Provas feitas -->
      <section v-if="feitas.length" class="mt-8" aria-labelledby="titulo-feitas">
        <h2 id="titulo-feitas" class="titulo-secao m-0 flex items-center gap-2"><FileText :size="18" :stroke-width="2" class="text-texto-2" aria-hidden="true" />Provas feitas</h2>
        <ul class="cartao m-0 mt-3 list-none p-0">
          <li v-for="p in feitasNaPagina" :key="p.id" class="grid items-center gap-x-4 gap-y-1 border-b border-borda px-4 py-3 text-[14px] last:border-b-0 sm:grid-cols-[110px_minmax(0,1fr)_90px_150px_auto] sm:px-5">
            <span class="text-[13px] text-texto-2">{{ dia(p.entregueEm) }}</span>
            <span class="min-w-0">
              <b class="block truncate">{{ p.titulo }}</b>
              <span class="text-[12.5px] text-texto-2">{{ formatoDe(p.formato).nome }}, {{ p.total }} questões</span>
            </span>
            <span class="tabular-nums"><b class="text-[15px]">{{ p.porcentagem }}%</b> <span class="text-[12.5px] text-texto-2"><Fracao :valor="p.certas" :total="p.total" sem-animacao /></span></span>
            <span class="text-[13px] text-texto-2">{{ duracao(p.segundos) }} de {{ duracao(p.minutos * 60) }}</span>
            <span class="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
              <NuxtLink :to="`/prova/${p.id}/resultado`" class="link">Ver resultado</NuxtLink>
              <NuxtLink v-if="p.formato === 'dominio' && p.assuntoId" :to="`/assuntos/${p.assuntoId}`" class="link-discreto">Ver o assunto</NuxtLink>
              <NuxtLink v-else :to="`/prova/nova?repetir=${p.id}`" class="link-discreto" :aria-label="`Fazer de novo: ${p.titulo}`">Fazer de novo</NuxtLink>
            </span>
          </li>
        </ul>
        <Paginacao v-if="feitas.length > 10" v-model="paginaFeitas" class="mt-3" :total="feitas.length" :por-pagina="10" rotulo="Páginas das provas feitas" />
      </section>
    </template>

    <Vazio
      v-else-if="!andamento"
      class="mt-8"
      titulo="Nenhuma prova feita ainda"
      texto="Monte um simulado com as questões do seu banco: você escolhe as matérias, o formato (ENEM, vestibular, certo ou errado, escola) e o tempo."
      humor="encorajador"
    >
      <template #acoes>
        <NuxtLink to="/prova/nova" class="botao gap-2 no-underline"><Plus :size="17" :stroke-width="2.2" aria-hidden="true" />Montar prova</NuxtLink>
      </template>
    </Vazio>
  </div>
</template>
