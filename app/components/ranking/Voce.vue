<script setup>
// Parte "Você" do Ranking (a antiga tela Desempenho): só os números da própria pessoa.
// O número principal é o acerto das últimas 4 semanas contra as 4 anteriores, com o minigráfico de 8 semanas.
// Depois: nível, dias de estudo (mapa de calor), pontos por semana, onde a pessoa acerta mais (matéria, tipo e
// nível, com a matéria mais fraca e o atalho para estudá-la), situação dos assuntos, últimos estudos e conquistas.
import { Award, CalendarDays, ChevronRight, Flame, History, Layers, Minus, Target, TrendingDown, TrendingUp, Zap } from '@lucide/vue'
import { comparacaoAcerto, comparacaoPontos, diaMes, diasComEstudo, progressoNivel, segmentosProficiencia, serieAcerto } from '#shared/regras/ranking.js'
import { nomeDoNivel, nomeDoTipo } from '#shared/regras/questoes.js'
import { diaDe, quandoFoi } from '#shared/regras/historico.js'

const props = defineProps({
  desempenho: { type: Object, required: true },
  estudo: { type: Object, required: true },
  conquistas: { type: Array, default: () => [] },
})

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR')
const semanas = computed(() => props.desempenho.semanas ?? [])
const totais = computed(() => props.desempenho.totais ?? {})
const hoje = computed(() => props.desempenho.hoje || diaDe(new Date()))

// Variação: subiu (ok, com seta), caiu (aviso, com seta) ou ficou igual. Nunca só pela cor.
function variacao(dif, sufixo = '') {
  if (dif > 0) return { icone: TrendingUp, tipo: 'ok', texto: `+${fmt(dif)}${sufixo}` }
  if (dif < 0) return { icone: TrendingDown, tipo: 'aviso', texto: `${fmt(dif)}${sufixo}` }
  return { icone: Minus, tipo: undefined, texto: 'Igual' }
}

const acerto = computed(() => comparacaoAcerto(semanas.value))
const varAcerto = computed(() => (acerto.value.diferenca == null ? null : variacao(acerto.value.diferenca, '%')))
const serie = computed(() => serieAcerto(semanas.value))
const periodoAcerto = computed(() => {
  const s = semanas.value.slice(-4)
  return s.length ? `${diaMes(s[0].inicio)} a ${diaMes(s.at(-1).fim)}` : ''
})

const nivel = computed(() => progressoNivel(props.estudo.pontos || totais.value.pontos || 0))

const calor = computed(() => (props.desempenho.por_dia ?? []).map((d) => ({ data: d.data, valor: Number(d.n ?? 0) })))
const diasCalor = computed(() => diasComEstudo(props.desempenho.por_dia))

const pontos = computed(() => comparacaoPontos(semanas.value))
const varPontos = computed(() => (pontos.value.diferenca == null ? null : variacao(pontos.value.diferenca)))
const barrasPontos = computed(() => semanas.value.map((s, i, l) => {
  const atual = i === l.length - 1
  return {
    rotulo: atual ? 'Esta' : diaMes(s.inicio),
    valor: Number(s.pontos ?? 0),
    dica: atual ? `${fmt(s.pontos)} pontos` : `${diaMes(s.inicio)} a ${diaMes(s.fim)}: ${fmt(s.pontos)} pontos`,
    destaque: atual,
  }
}))
const descricaoPontos = computed(() => `Pontos por semana, da mais antiga para a atual: ${semanas.value.map((s) => fmt(s.pontos)).join(', ')}.`)

const materias = computed(() => (props.desempenho.por_materia ?? []).map((m) => ({
  id: m.materia_id,
  rotulo: m.nome,
  valor: Number(m.acerto ?? 0),
  cor: `${corMateria(m.cor || 'cinza')}`,
  detalhe: `${fmt(m.total)} respostas`,
})))
// A matéria com menor acerto (com pelo menos 10 respostas), quando há com o que comparar.
const maisFraca = computed(() => {
  const l = (props.desempenho.por_materia ?? []).filter((m) => Number(m.total) >= 10)
  return l.length < 2 ? null : l.reduce((a, b) => (Number(b.acerto) < Number(a.acerto) ? b : a))
})
const tipos = computed(() => (props.desempenho.por_tipo ?? []).slice(0, 5).map((t) => ({
  id: t.tipo, rotulo: nomeDoTipo(t.tipo), valor: Number(t.acerto ?? 0),
})))
const niveis = computed(() => (props.desempenho.por_nivel ?? []).map((n) => ({
  id: n.nivel, rotulo: nomeDoNivel(n.nivel), valor: Number(n.acerto ?? 0),
})))

const CORES_ESTADO = {
  dominado: 'var(--ok-vivo)',
  pronto_para_prova: 'color-mix(in oklab, var(--ok-vivo) 55%, var(--folha))',
  proficiente: 'var(--acento)',
  em_desenvolvimento: 'color-mix(in oklab, var(--acento) 40%, var(--folha))',
  relembrar: 'var(--aviso-vivo)',
  com_dificuldade: 'var(--erro-vivo)',
  iniciando: 'var(--borda-forte)',
  nao_iniciado: 'var(--folha-3)',
}
const assuntos = computed(() => segmentosProficiencia(props.desempenho.proficiencias))
const resumoAssuntos = computed(() => `${assuntos.value.total} assuntos: ${assuntos.value.segmentos.map((s) => `${s.nome}, ${s.n}`).join('; ')}.`)

const sessoes = computed(() => [...(props.desempenho.sessoes ?? [])]
  .sort((a, b) => new Date(b.concluida_em) - new Date(a.concluida_em))
  .slice(0, 5))
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <!-- O número principal da tela: acerto recente, com a comparação e a linha de 8 semanas. -->
      <section class="cartao entra" style="--i: 1" aria-labelledby="t-acerto">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="t-acerto" class="titulo-cartao m-0 flex items-center gap-2">
            <Target :size="18" :stroke-width="2.1" class="text-acento" aria-hidden="true" />
            Acerto nas últimas 4 semanas
          </h2>
          <span v-if="periodoAcerto" class="text-[13px] text-texto-3">{{ periodoAcerto }}</span>
        </div>

        <div class="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div v-if="acerto.atual != null">
            <p class="numero-grande m-0 leading-none"><NumeroAnimado :valor="acerto.atual" sufixo="%" /></p>
            <p class="m-0 mt-3 flex flex-wrap items-center gap-2 text-[14px] text-texto-2">
              <template v-if="varAcerto">
                <span class="selo" :data-tipo="varAcerto.tipo">
                  <component :is="varAcerto.icone" :size="14" :stroke-width="2.2" aria-hidden="true" />
                  {{ varAcerto.texto }}
                </span>
                <span>contra {{ acerto.anterior }}% nas 4 semanas antes</span>
              </template>
              <span v-else>Ainda não dá para comparar: são as suas primeiras semanas.</span>
            </p>
          </div>
          <div v-else>
            <p class="numero-grande m-0 leading-none">{{ totais.acerto ?? 0 }}%</p>
            <p class="m-0 mt-3 text-[14px] text-texto-2">Acerto de sempre. Nas últimas 4 semanas você não respondeu questões.</p>
          </div>

          <figure v-if="serie.length >= 2" class="m-0 flex flex-col items-start gap-1.5 sm:items-end">
            <Minigrafico :valores="serie" :largura="232" :altura="60" />
            <figcaption class="text-[12.5px] text-texto-3">
              Acerto por semana, {{ serie.length }} semanas
              <span class="so-leitor">: {{ serie.join('%, ') }}%</span>
            </figcaption>
          </figure>
        </div>

        <hr class="divisoria my-5">
        <dl class="m-0 grid grid-cols-3 gap-3">
          <div class="min-w-0">
            <dt class="text-[12.5px] text-texto-3">Respostas</dt>
            <dd class="m-0 mt-0.5 font-titulo text-[22px] font-bold tabular-nums"><NumeroAnimado :valor="totais.respondidas ?? 0" /></dd>
          </div>
          <div class="min-w-0 border-l border-borda pl-3">
            <dt class="text-[12.5px] text-texto-3">Minutos</dt>
            <dd class="m-0 mt-0.5 font-titulo text-[22px] font-bold tabular-nums"><NumeroAnimado :valor="totais.minutos ?? 0" /></dd>
          </div>
          <div class="min-w-0 border-l border-borda pl-3">
            <dt class="text-[12.5px] text-texto-3">Estudos</dt>
            <dd class="m-0 mt-0.5 font-titulo text-[22px] font-bold tabular-nums"><NumeroAnimado :valor="totais.sessoes ?? 0" /></dd>
          </div>
        </dl>
      </section>

      <!-- Nível: anel com o caminho até o próximo nível. -->
      <section class="cartao entra flex flex-col" style="--i: 2" aria-labelledby="t-nivel">
        <h2 id="t-nivel" class="titulo-cartao m-0 flex items-center gap-2">
          <Award :size="18" :stroke-width="2.1" class="text-acento" aria-hidden="true" />
          Seu nível
        </h2>
        <div class="mt-4 flex items-center gap-5">
          <div class="relative shrink-0">
            <AppAnelMeta :feitas="nivel.feito" :meta="nivel.total" :tamanho="104" :espessura="9" />
            <span class="absolute inset-0 grid place-items-center font-titulo text-[38px] font-bold leading-none" aria-hidden="true">{{ nivel.nivel }}</span>
          </div>
          <div class="min-w-0">
            <p class="m-0 font-titulo text-[20px] font-bold">Nível {{ nivel.nivel }}</p>
            <p class="m-0 mt-1 text-[14px] text-texto-2">
              Faltam <strong class="text-tinta">{{ fmt(nivel.falta) }} pontos</strong> para o nível {{ nivel.nivel + 1 }}.
            </p>
            <p class="m-0 mt-1.5 text-[13px] text-texto-3"><Fracao :valor="nivel.feito" :total="nivel.total" /> pontos neste nível</p>
          </div>
        </div>
        <hr class="divisoria my-5">
        <div class="mt-auto flex flex-wrap items-center justify-between gap-3">
          <p class="m-0 flex items-center gap-2 text-[14px]">
            <Zap :size="17" :stroke-width="2.1" class="text-energia" aria-hidden="true" />
            <strong class="font-titulo text-[20px] text-energia-texto"><NumeroAnimado :valor="estudo.pontos || totais.pontos || 0" /></strong>
            <span class="text-texto-2">pontos no total</span>
          </p>
          <span v-if="estudo.pontos_hoje" class="selo" data-tipo="energia">+{{ fmt(estudo.pontos_hoje) }} hoje</span>
        </div>
      </section>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <!-- Dias de estudo: mapa de calor de 16 semanas e as sequências. -->
      <section v-revelar class="cartao entra" style="--i: 3" aria-labelledby="t-dias">
        <div class="flex items-baseline justify-between gap-3">
          <h2 id="t-dias" class="titulo-cartao m-0 flex items-center gap-2">
            <CalendarDays :size="18" :stroke-width="2.1" class="text-acento" aria-hidden="true" />
            Dias de estudo
          </h2>
          <span class="text-[13px] text-texto-3">16 semanas</span>
        </div>
        <div class="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 overflow-x-auto">
            <Calor :dias="calor" :semanas="16" :hoje="hoje" />
          </div>
          <dl class="m-0 grid shrink-0 grid-cols-3 gap-3 sm:grid-cols-1 sm:gap-3.5">
            <div>
              <dt class="text-[12.5px] text-texto-3">Seguidos agora</dt>
              <dd class="m-0 flex items-center gap-1.5 font-titulo text-[22px] font-bold tabular-nums">
                <Flame :size="18" :stroke-width="2.1" class="text-energia" aria-hidden="true" />
                {{ estudo.dias_seguidos ?? 0 }}
                <span class="font-sans text-[13px] font-medium text-texto-3">{{ estudo.dias_seguidos === 1 ? 'dia' : 'dias' }}</span>
              </dd>
            </div>
            <div>
              <dt class="text-[12.5px] text-texto-3">Recorde</dt>
              <dd class="m-0 font-titulo text-[22px] font-bold tabular-nums">
                {{ totais.melhor_sequencia ?? 0 }}
                <span class="font-sans text-[13px] font-medium text-texto-3">dias</span>
              </dd>
            </div>
            <div>
              <dt class="text-[12.5px] text-texto-3">Estudou em</dt>
              <dd class="m-0 font-titulo text-[22px] font-bold tabular-nums">
                {{ diasCalor }}
                <span class="font-sans text-[13px] font-medium text-texto-3">dias</span>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- Pontos por semana. -->
      <section v-revelar class="cartao entra flex flex-col" style="--i: 4" aria-labelledby="t-pontos">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
          <h2 id="t-pontos" class="titulo-cartao m-0 flex items-center gap-2">
            <Zap :size="18" :stroke-width="2.1" class="text-energia" aria-hidden="true" />
            Pontos por semana
          </h2>
          <p v-if="varPontos" class="m-0 flex items-center gap-2 text-[13px] text-texto-2">
            <span class="selo" :data-tipo="varPontos.tipo">
              <component :is="varPontos.icone" :size="14" :stroke-width="2.2" aria-hidden="true" />
              {{ varPontos.texto }}
            </span>
            que a semana passada
          </p>
        </div>
        <p class="m-0 mt-3 text-[14px] text-texto-2">
          <strong class="font-titulo text-[26px] text-tinta tabular-nums"><NumeroAnimado :valor="pontos.atual" /></strong>
          pontos nesta semana
        </p>
        <div class="mt-auto pt-4">
          <GraficoBarras :dados="barrasPontos" :altura="132" :descricao="descricaoPontos" />
        </div>
      </section>
    </div>

    <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <!-- Onde você acerta mais: matéria (principal), tipo e nível. -->
      <section v-revelar class="cartao entra" style="--i: 5" aria-labelledby="t-onde">
        <h2 id="t-onde" class="titulo-cartao m-0 flex items-center gap-2">
          <Layers :size="18" :stroke-width="2.1" class="text-acento" aria-hidden="true" />
          Onde você acerta mais
        </h2>
        <h3 class="m-0 mt-4 text-[13px] font-semibold text-texto-3">Por matéria</h3>
        <RankingBarrasHorizontais v-if="materias.length" class="mt-3" :itens="materias" />
        <p v-else class="m-0 mt-2 text-[14px] text-texto-2">Responda questões para ver o acerto de cada matéria.</p>

        <div v-if="maisFraca" class="painel mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="m-0 flex items-center gap-2 text-[14px] text-texto-2">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: `${corMateria(maisFraca.cor || 'cinza')}` }" aria-hidden="true" />
            <span><strong class="text-tinta">{{ maisFraca.nome }}</strong> é onde você mais erra ({{ maisFraca.acerto }}%).</span>
          </p>
          <NuxtLink :to="`/revisar/nova?materia=${maisFraca.materia_id}`" class="botao-secundario botao-p shrink-0">
            <Target :size="16" :stroke-width="2.1" aria-hidden="true" />
            Estudar {{ maisFraca.nome }}
          </NuxtLink>
        </div>

        <div v-if="tipos.length || niveis.length" class="mt-5 grid grid-cols-1 gap-5 border-t border-borda pt-5 sm:grid-cols-2 sm:gap-6">
          <div v-if="tipos.length" class="min-w-0">
            <h3 class="m-0 text-[13px] font-semibold text-texto-3">Por tipo de questão</h3>
            <RankingBarrasHorizontais class="mt-3" :itens="tipos" />
          </div>
          <div v-if="niveis.length" class="min-w-0 sm:border-l sm:border-borda sm:pl-6">
            <h3 class="m-0 text-[13px] font-semibold text-texto-3">Por nível</h3>
            <RankingBarrasHorizontais class="mt-3" :itens="niveis" />
          </div>
        </div>
      </section>

      <div class="flex flex-col gap-5">
        <!-- Situação dos assuntos: uma barra empilhada com legenda escrita. -->
        <section v-revelar class="cartao entra" style="--i: 6" aria-labelledby="t-assuntos">
          <div class="flex items-baseline justify-between gap-3">
            <h2 id="t-assuntos" class="titulo-cartao m-0">Seus assuntos</h2>
            <span class="text-[13px] text-texto-3">{{ assuntos.total }} {{ assuntos.total === 1 ? 'assunto' : 'assuntos' }}</span>
          </div>
          <template v-if="assuntos.total">
            <p class="so-leitor">{{ resumoAssuntos }}</p>
            <div class="empilhada mt-4 flex h-3.5 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
              <span
                v-for="s in assuntos.segmentos"
                :key="s.estado"
                class="h-full first:rounded-l-full last:rounded-r-full"
                :style="{ flexGrow: s.n, flexBasis: 0, background: CORES_ESTADO[s.estado] }"
              />
            </div>
            <ul class="m-0 mt-4 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0" aria-hidden="true">
              <li v-for="s in assuntos.segmentos" :key="s.estado" class="flex min-w-0 items-center gap-2 text-[13.5px]">
                <span class="size-2.5 shrink-0 rounded-full" :style="{ background: CORES_ESTADO[s.estado] }" />
                <span class="leading-tight text-texto-2">{{ s.nome }}</span>
                <span class="ml-auto font-semibold tabular-nums">{{ s.n }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="m-0 mt-2 text-[14px] text-texto-2">Cada assunto ganha uma situação depois que você responde questões dele.</p>
        </section>

        <!-- Últimos estudos: levam ao resultado. -->
        <section v-revelar class="cartao entra !pb-3" style="--i: 7" aria-labelledby="t-estudos">
          <div class="flex items-baseline justify-between gap-3">
            <h2 id="t-estudos" class="titulo-cartao m-0">Últimos estudos</h2>
            <NuxtLink to="/historico" class="flex items-center gap-1.5 text-[13.5px] font-semibold text-acento hover:underline">
              <History :size="15" :stroke-width="2.1" aria-hidden="true" />
              Ver histórico
            </NuxtLink>
          </div>
          <ul class="m-0 mt-2 list-none p-0">
            <li v-for="s in sessoes" :key="s.id">
              <NuxtLink :to="`/revisar/${s.id}/resultado`" class="linha-estudo -mx-2.5 flex min-h-[48px] items-center gap-3 rounded-[12px] px-2.5 py-2">
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[14.5px] font-semibold">{{ s.titulo }}</span>
                  <span class="block text-[12.5px] text-texto-3">{{ quandoFoi(s.concluida_em, hoje) }}, {{ s.respondidas }} questões</span>
                </span>
                <span class="shrink-0 text-right">
                  <span class="block text-[14px] font-semibold tabular-nums">{{ s.acerto }}%</span>
                  <span class="block text-[12.5px] font-semibold text-energia-texto tabular-nums">+{{ fmt(s.pontos) }}</span>
                </span>
                <ChevronRight :size="16" :stroke-width="2" class="seta shrink-0 text-texto-3" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <RankingConquistas class="entra" style="--i: 8" :lista="conquistas" />
  </div>
</template>

<style scoped>
.linha-estudo {
  transition: background-color 0.15s;
}
.linha-estudo:hover {
  background: var(--folha-2);
}
.linha-estudo:hover .seta {
  transform: translateX(3px);
  color: var(--acento);
}
.seta {
  transition: transform 0.2s var(--ease-mola), color 0.15s;
}
.linha-estudo:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 1px;
}
.empilhada > span {
  transform-origin: left center;
  animation: cresce-x 0.8s var(--ease-saida) backwards;
}
.empilhada > span:nth-child(2) { animation-delay: 0.06s; }
.empilhada > span:nth-child(3) { animation-delay: 0.12s; }
.empilhada > span:nth-child(4) { animation-delay: 0.18s; }
.empilhada > span:nth-child(n + 5) { animation-delay: 0.24s; }
@media (prefers-reduced-motion: reduce) {
  .empilhada > span,
  .seta {
    animation: none;
    transition: none;
  }
}
:global(:root.menos-movimento) .empilhada > span,
:global(:root.menos-movimento) .seta {
  animation: none;
  transition: none;
}
</style>
