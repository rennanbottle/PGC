<script setup>
// Estudar. Uma ação domina a tela: "Estudar agora" (as questões que venceram hoje, na receita recomendada, com os
// minutos) ou, com um estudo pausado, "Continuar". Ao lado, a semana (respondidas por dia e o acerto dos últimos
// estudos). Embaixo, as receitas numa lista curta, os estudos salvos (conjuntos) e os últimos estudos.
import { Activity, Copy, History, Lock, Pencil, Play, Plus, RotateCcw, Target } from '@lucide/vue'
import { estaLiberado, avaliarDesbloqueios } from '#shared/regras/desbloqueios.js'
import { TIPOS_BLOCO, blocosDaReceita, situacaoDasReceitas, usaIaNoConjunto } from '#shared/regras/conjuntos.js'
import { RITMOS } from '#shared/regras/ritmo.js'
import { assuntosAtivos } from '#shared/regras/materias.js'

useHead({ title: 'Estudar | PGC' })
const supabase = useSupabaseClient()
const estatisticas = useEstatisticas()
const liberada = computed(() => estaLiberado('revisao', estatisticas.value))
const bloqueio = computed(() => avaliarDesbloqueios(estatisticas.value).find((d) => d.id === 'revisao'))
const { data: estudo } = useResumoEstudo()
const { data: perfil } = usePerfil()
const { data: materias } = useMaterias()
const api = useRevisoes()
const conjuntos = useConjuntos()
const { data: salvos } = await conjuntos.lista
const ritmo = computed(() => perfil.value?.ritmo ?? 'normal')
const { avisar } = useAvisos()

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const { data: painel } = await useAsyncData('revisar-painel', async () => {
  const [{ data: vencidos }, { data: profs }, { data: comQuestao }, { data: erros }] = await Promise.all([
    supabase.from('questao_cartoes').select('questao_id').lte('proxima', hoje).limit(2000),
    supabase.from('proficiencias').select('assunto_id, estado, proficiencia, retencao, proxima_revisao'),
    supabase.from('questoes').select('id, assunto_id').eq('em_revisao', true).not('assunto_id', 'is', null).limit(5000),
    supabase.from('revisao_itens').select('assunto_id').eq('resultado', 'incorreta').gte('respondida_em', new Date(Date.now() - 14 * 86400000).toISOString()).limit(2000),
  ])
  const porQuestao = new Map((comQuestao ?? []).map((q) => [q.id, q.assunto_id]))
  const vencidas = {}
  for (const v of vencidos ?? []) {
    const a = porQuestao.get(v.questao_id)
    if (a) vencidas[a] = (vencidas[a] ?? 0) + 1
  }
  const noBanco = {}
  for (const q of comQuestao ?? []) noBanco[q.assunto_id] = (noBanco[q.assunto_id] ?? 0) + 1
  const errosPor = {}
  for (const e of erros ?? []) if (e.assunto_id) errosPor[e.assunto_id] = (errosPor[e.assunto_id] ?? 0) + 1
  return { vencidas, noBanco, profs: profs ?? [], errosPor }
}, { default: () => ({ vencidas: {}, noBanco: {}, profs: [], errosPor: {} }) })

// Execuções: as últimas para a lista, e as concluídas de cada conjunto para o acerto médio.
const { data: execucoes } = await useAsyncData('revisoes-lista', async () => {
  const [{ data: ultimas }, { data: porConjunto }] = await Promise.all([
    supabase.from('revisoes').select('id, titulo, status, total, respondidas, certas, parciais, pontos, criado_em, pausada_em, blocos, bloco_atual').eq('tipo', 'estudo').order('criado_em', { ascending: false }).limit(6),
    supabase.from('revisoes').select('conjunto_id, certas, parciais, respondidas, criado_em').not('conjunto_id', 'is', null).eq('status', 'concluida').order('criado_em', { ascending: true }).limit(1000),
  ])
  return { ultimas: ultimas ?? [], porConjunto: porConjunto ?? [] }
}, { default: () => ({ ultimas: [], porConjunto: [] }) })

const assuntoInfo = computed(() => {
  const m = new Map()
  for (const mat of materias.value ?? []) for (const a of assuntosAtivos(mat)) m.set(a.id, { nome: a.nome, cor: mat.cor, materia: mat.nome, materiaId: mat.id })
  return m
})
const vencidasLista = computed(() => Object.entries(painel.value.vencidas)
  .map(([id, n]) => ({ id, n, ...assuntoInfo.value.get(id), retencao: painel.value.profs.find((p) => p.assunto_id === id)?.retencao ?? null }))
  .filter((a) => a.nome)
  .sort((a, b) => b.n - a.n))
const totalVencidas = computed(() => vencidasLista.value.reduce((s, a) => s + a.n, 0))
const comQuestao = computed(() => Object.keys(painel.value.noBanco).filter((id) => assuntoInfo.value.has(id)))

const ctx = computed(() => {
  const errosPor = Object.entries(painel.value.errosPor).sort((a, b) => b[1] - a[1])
  const meta = (RITMOS[ritmo.value] ?? RITMOS.normal).proficiente.proficiencia
  const perto = painel.value.profs.filter((p) => !['proficiente', 'pronto_para_prova', 'dominado'].includes(p.estado) && p.proficiencia).sort((a, b) => b.proficiencia - a.proficiencia)[0]
  return {
    vencidas: totalVencidas.value,
    erros14: estudo.value.erros_14 ?? 0,
    assuntoMaisErrado: errosPor[0] ? { nome: assuntoInfo.value.get(errosPor[0][0])?.nome ?? 'um assunto', erros: errosPor[0][1] } : null,
    proficientes: estudo.value.proficientes ?? 0,
    pertoDeProficiente: perto ? { nome: assuntoInfo.value.get(perto.assunto_id)?.nome ?? 'Um assunto', proficiencia: perto.proficiencia, meta } : null,
    muitoDificilLiberado: (estudo.value.proficientes ?? 0) >= 1,
    ritmo: ritmo.value,
  }
})
const receitas = computed(() => [...situacaoDasReceitas(ctx.value)].sort((a, b) => Number(b.recomendado) - Number(a.recomendado) || Number(b.disponivel) - Number(a.disponivel)))

const semana = computed(() => estudo.value.semana ?? 0)
const difSemana = computed(() => semana.value - (estudo.value.semana_anterior ?? 0))
const acertos = computed(() => (estudo.value.acerto_ultimas ?? []).map(Number))
const mediaAcerto = computed(() => (acertos.value.length ? Math.round(acertos.value.reduce((s, n) => s + n, 0) / acertos.value.length) : null))
const hora = (d) => (d ? new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(d)) : '')
const dia = (d) => (d ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(d)) : '')

// Estudo em andamento, com a faixa por bloco.
const andamento = computed(() => execucoes.value.ultimas.find((u) => u.status !== 'concluida') ?? null)
const gruposAndamento = computed(() => {
  const a = andamento.value
  if (!a) return []
  const bl = a.blocos?.length ? a.blocos : [{ tipo: 'revisao', quantidade: a.total }]
  let resto = a.respondidas
  return bl.filter((b) => !b.pulado).map((b) => {
    const n = Math.max(1, b.quantidade ?? 0)
    const feitas = Math.min(n, Math.max(0, resto))
    resto -= n
    return { tipo: b.tipo ?? 'revisao', n, feitas }
  })
})
// O bloco em que a pessoa está: o primeiro que ainda tem questão sem resposta.
const grupoAtual = computed(() => {
  const i = gruposAndamento.value.findIndex((g) => g.feitas < g.n)
  return i >= 0 ? i : Math.max(0, gruposAndamento.value.length - 1)
})

// Conjuntos salvos com as execuções de cada um.
const pct = (r) => (r.respondidas ? Math.round((100 * (r.certas + 0.5 * r.parciais)) / r.respondidas) : 0)
const listaConjuntos = computed(() => (salvos.value ?? []).map((c) => {
  const ex = execucoes.value.porConjunto.filter((r) => r.conjunto_id === c.id)
  const serie = ex.slice(-8).map(pct)
  const total = (c.blocos ?? []).reduce((s, b) => s + (b.quantidade ?? 0), 0)
  return {
    ...c,
    total,
    descricao: (c.blocos ?? []).map((b) => `${TIPOS_BLOCO[b.tipo]?.nome ?? 'Revisão'} ${b.quantidade}`).join(', '),
    usaIa: usaIaNoConjunto(c.blocos ?? []),
    execucoes: ex.length,
    ultima: ex.at(-1)?.criado_em ?? null,
    media: serie.length ? Math.round(serie.reduce((s, n) => s + n, 0) / serie.length) : null,
    serie,
  }
}))

// ---------- Ações ----------
const erro = ref('')
const criando = ref('')
async function comecar(corpo, chave) {
  erro.value = ''
  criando.value = chave
  try {
    const r = await api.criar(corpo)
    await navigateTo(`/revisar/${r.id}`)
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
  criando.value = ''
}
// Revisão do dia em um clique: os assuntos com questão, com mais peso onde venceu mais.
function revisaoDoDia() {
  const [bloco] = blocosDaReceita('revisao_do_dia', ritmo.value)
  const ids = totalVencidas.value ? vencidasLista.value.map((a) => a.id) : comQuestao.value
  bloco.assuntos = ids.map((aid) => ({ id: aid, peso: Math.min(10, (painel.value.vencidas[aid] ?? 0) + 1) }))
  return comecar({ receita: 'revisao_do_dia', blocos: [bloco] }, 'dia')
}
const janelaApagar = ref(null)
const paraApagar = ref(null)
async function menuConjunto(c, acao) {
  erro.value = ''
  if (acao === 'editar') return navigateTo(`/revisar/nova?conjunto=${c.id}`)
  if (acao === 'duplicar') {
    try {
      await conjuntos.salvar({ nome: `${c.nome} (cópia)`.slice(0, 80), blocos: c.blocos })
      avisar({ texto: 'Estudo duplicado.', tipo: 'ok' })
    }
    catch (e) {
      avisar({ texto: e.message, tipo: 'erro' })
    }
    return
  }
  if (acao === 'apagar') {
    paraApagar.value = c
    janelaApagar.value?.abrir()
  }
}
async function apagar() {
  try {
    await conjuntos.apagar(paraApagar.value.id)
    janelaApagar.value?.fechar()
    avisar({ texto: 'Estudo apagado.', tipo: 'ok' })
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
    janelaApagar.value?.fechar()
  }
}
const estimativa = computed(() => Math.max(1, Math.round(Math.max(totalVencidas.value, 20) * 0.8)))
const minutosReceita = (r) => Math.max(5, Math.round(blocosDaReceita(r.id, ritmo.value).reduce((s, b) => s + (b.quantidade ?? 0), 0) * 0.8))
const acoesConjunto = [{ id: 'editar', texto: 'Editar', icone: Pencil }, { id: 'duplicar', texto: 'Duplicar', icone: Copy }, { id: 'apagar', texto: 'Apagar', perigo: true, separar: true }]

// Semana: respondidas por dia (14 dias, hoje em destaque) e a comparação com a semana anterior.
const fmtLetra = new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow', timeZone: 'America/Sao_Paulo' })
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })
const barrasDias = computed(() => {
  const d = (estudo.value.por_dia ?? []).map(Number)
  return d.map((valor, i) => {
    const data = new Date(Date.now() - (d.length - 1 - i) * 86400000)
    const nome = i === d.length - 1 ? 'Hoje' : fmtDia.format(data)
    return { rotulo: fmtLetra.format(data).toUpperCase(), valor, destaque: i === d.length - 1, dica: `${nome.charAt(0).toUpperCase()}${nome.slice(1)}: ${valor} ${valor === 1 ? 'respondida' : 'respondidas'}` }
  })
})
const comparacaoSemana = computed(() => (difSemana.value > 0 ? `+${difSemana.value} que a semana passada` : difSemana.value < 0 ? `${difSemana.value} que a semana passada` : 'igual à semana passada'))
</script>

<template>
  <TelaBloqueada v-if="!liberada && bloqueio" nome="Estudar" resumo="Estudos em blocos de Revisão e Prática, montados com os seus assuntos, em modo foco." :requisitos="bloqueio.requisitos" />
  <div v-else>
    <CabecalhoPagina titulo="Estudar" descricao="Responda as questões do seu banco na hora certa de lembrar. Cada acerto vale pontos.">
      <template #acoes>
        <NuxtLink to="/revisar/nova" class="botao-fantasma no-underline"><Plus :size="18" :stroke-width="2" aria-hidden="true" />Montar um estudo</NuxtLink>
      </template>
    </CabecalhoPagina>

    <div class="grid items-stretch gap-4 lg:grid-cols-[1.6fr_1fr]">
      <!-- A ação principal: continuar o que parou ou estudar agora -->
      <section v-if="andamento" class="cartao-destaque entra flex min-w-0 flex-col" style="--i: 1" aria-labelledby="titulo-principal">
        <span class="selo self-start" data-tipo="acento">{{ andamento.status === 'pausada' ? `Pausado ${hora(andamento.pausada_em)}` : 'Em andamento' }}</span>
        <h2 id="titulo-principal" class="titulo-secao mt-3">{{ andamento.titulo.split(',')[0] }}</h2>
        <p class="m-0 mt-1 text-[15px] text-texto-2">
          <b class="text-tinta"><Fracao :valor="andamento.respondidas" :total="andamento.total" /></b> respondidas<template v-if="gruposAndamento.length > 1">, no bloco de {{ TIPOS_BLOCO[gruposAndamento[grupoAtual]?.tipo ?? 'revisao'].nome }}</template>. Nada do que você fez se perde.
        </p>
        <div class="mt-4 flex gap-2" aria-hidden="true">
          <span v-for="(g, i) in gruposAndamento" :key="i" class="flex gap-[2px]" :style="{ flex: g.n }">
            <span v-for="k in g.n" :key="k" class="h-2 flex-1 rounded-full" :class="k <= g.feitas ? 'bg-acento' : 'bg-folha-3'" />
          </span>
        </div>
        <div v-if="gruposAndamento.length > 1" class="mt-1.5 flex gap-2 text-[12px] text-texto-2" aria-hidden="true"><span v-for="(g, i) in gruposAndamento" :key="i" class="min-w-0 truncate" :style="{ flex: g.n }">{{ TIPOS_BLOCO[g.tipo].nome }}</span></div>
        <div class="mt-auto pt-6">
          <NuxtLink :to="`/revisar/${andamento.id}`" data-guia="estudar-comecar" class="botao botao-g no-underline"><Play :size="19" :stroke-width="2.2" aria-hidden="true" />Continuar de onde parei</NuxtLink>
        </div>
      </section>

      <section v-else class="cartao-destaque entra flex min-w-0 flex-col" style="--i: 1" aria-labelledby="titulo-principal">
        <h2 id="titulo-principal" class="titulo-cartao">Para hoje</h2>
        <template v-if="totalVencidas">
          <p class="m-0 mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="numero-grande"><NumeroAnimado :valor="totalVencidas" /></span>
            <span class="text-[16px] font-semibold">{{ totalVencidas === 1 ? 'questão para revisar' : 'questões para revisar' }}</span>
          </p>
          <p class="m-0 mt-1.5 text-[14px] text-texto-2">É a hora certa: você ainda lembra, mas está começando a esquecer.</p>
          <ul class="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
            <li v-for="a in vencidasLista.slice(0, 4)" :key="a.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-[14px] sm:grid-cols-[minmax(0,1fr)_150px_auto]">
              <span class="flex min-w-0 items-center gap-2">
                <span class="size-2 shrink-0 rounded-full" :style="{ background: `${corMateria(a.cor ?? 'cinza')}` }" aria-hidden="true" />
                <span class="truncate"><b>{{ a.nome }}</b> <span class="text-texto-2">{{ a.materia }}</span></span>
              </span>
              <span v-if="a.retencao !== null" class="hidden items-center gap-2 sm:flex" :data-dica="`Você ainda lembra ${a.retencao}%`">
                <span class="h-1.5 flex-1 rounded-full bg-folha-3" aria-hidden="true"><span class="block h-full rounded-full bg-acento" :style="{ width: `${a.retencao}%` }" /></span>
                <span class="w-[34px] text-right text-[12.5px] tabular-nums text-texto-2">{{ a.retencao }}%</span>
              </span>
              <span v-else class="hidden sm:block" />
              <span class="text-right text-[13px] tabular-nums text-texto-2">{{ a.n }} {{ a.n === 1 ? 'questão' : 'questões' }}</span>
            </li>
          </ul>
          <p v-if="vencidasLista.length > 4" class="m-0 mt-2 text-[13px] text-texto-2">E mais {{ vencidasLista.length - 4 }} {{ vencidasLista.length - 4 === 1 ? 'assunto' : 'assuntos' }}.</p>
        </template>
        <div v-else class="mt-3 flex items-center gap-4">
          <GuiaPersonagem humor="feliz" :tamanho="72" />
          <p class="m-0 text-[15px] leading-[1.55]"><b>Nada venceu hoje.</b><br><span class="text-texto-2">Uma revisão rápida das questões mais antigas mantém tudo fresco.</span></p>
        </div>
        <div class="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-6">
          <button type="button" data-guia="estudar-comecar" class="botao botao-g" :aria-busy="criando === 'dia'" :disabled="!!criando || !comQuestao.length" @click="revisaoDoDia">
            <span v-if="criando === 'dia'" class="rodando" aria-hidden="true" />
            <Play v-else :size="19" :stroke-width="2.2" aria-hidden="true" />{{ criando === 'dia' ? 'Montando o estudo' : 'Estudar agora' }}
          </button>
          <span class="text-[13.5px] text-texto-2">Revisão do dia, cerca de {{ estimativa }} min.</span>
        </div>
      </section>

      <!-- A semana -->
      <section class="cartao entra flex min-w-0 flex-col" style="--i: 2" aria-labelledby="titulo-semana">
        <h2 id="titulo-semana" class="titulo-cartao flex items-center gap-2"><Activity :size="18" :stroke-width="2" aria-hidden="true" />Sua semana</h2>
        <p class="m-0 mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
          <span class="numero-medio"><NumeroAnimado :valor="semana" /></span>
          <span class="text-[14px]">{{ semana === 1 ? 'respondida' : 'respondidas' }}</span>
          <span class="selo" :data-tipo="difSemana > 0 ? 'ok' : undefined">{{ comparacaoSemana }}</span>
        </p>
        <div class="mt-3 pr-12"><GraficoBarras :dados="barrasDias" :altura="96" :descricao="`Questões respondidas por dia nos últimos 14 dias: ${semana} nesta semana, ${comparacaoSemana}.`" /></div>
        <div v-if="acertos.length" class="mt-auto flex items-center justify-between gap-3 border-t border-borda pt-3.5">
          <p class="m-0 text-[14px]"><b class="tabular-nums">{{ mediaAcerto }}%</b> <span class="text-texto-2">de acerto nos últimos {{ acertos.length }} estudos</span></p>
          <Minigrafico v-if="acertos.length >= 2" :valores="acertos" :largura="88" :altura="30" />
        </div>
      </section>
    </div>

    <!-- Receitas -->
    <section v-revelar class="entra mt-10" style="--i: 3" aria-labelledby="titulo-receitas">
      <h2 id="titulo-receitas" class="titulo-secao">Outros jeitos de estudar</h2>
      <p class="m-0 mt-1 text-[14px] text-texto-2">Receitas prontas. Dá para mudar tudo antes de começar.</p>
      <ul class="cartao m-0 mt-3 list-none divide-y divide-borda p-0">
        <li v-for="r in receitas" :key="r.id" class="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-3.5 px-4 py-3 sm:px-5" :class="!r.disponivel && 'opacity-60'">
          <Target v-if="r.tipos.includes('pratica')" :size="19" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
          <RotateCcw v-else :size="19" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
          <span class="min-w-0">
            <span class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <b class="text-[15px]">{{ r.nome }}</b>
              <span class="text-[12.5px] tabular-nums text-texto-2">cerca de {{ minutosReceita(r) }} min</span>
              <span v-if="r.recomendado && r.disponivel" class="selo" data-tipo="acento">Recomendada</span>
            </span>
            <span class="mt-0.5 block text-[13.5px] text-texto-2">{{ r.recomendado ? r.motivo : r.descricao }}</span>
          </span>
          <template v-if="r.disponivel">
            <button v-if="r.id === 'revisao_do_dia'" type="button" class="botao-secundario botao-p" :disabled="!!criando || !comQuestao.length" @click="revisaoDoDia">Começar</button>
            <NuxtLink v-else :to="`/revisar/nova?receita=${r.id}`" class="botao-secundario botao-p no-underline">Montar</NuxtLink>
          </template>
          <span v-else class="inline-flex items-center gap-1.5 text-[13px] text-texto-2"><Lock :size="15" :stroke-width="2" aria-hidden="true" />Travada</span>
        </li>
      </ul>
    </section>

    <!-- Estudos salvos -->
    <section v-revelar data-guia="estudar-conjuntos" class="entra mt-10" style="--i: 4" aria-labelledby="titulo-salvos">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-salvos" class="titulo-secao">Seus estudos salvos</h2>
          <p class="m-0 mt-1 text-[14px] text-texto-2">Um estudo salvo repete os mesmos blocos sempre que você quiser.</p>
        </div>
      </div>
      <TransitionGroup v-if="listaConjuntos.length" name="lista" tag="ul" class="cartao m-0 mt-3 list-none divide-y divide-borda p-0">
        <li v-for="c in listaConjuntos" :key="c.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
          <span class="min-w-0">
            <b class="block truncate text-[15.5px]">{{ c.nome }}</b>
            <span class="mt-0.5 block text-[13px] text-texto-2">{{ c.total }} questões em {{ c.blocos.length }} {{ c.blocos.length === 1 ? 'bloco' : 'blocos' }}. {{ c.execucoes ? `Feito ${c.execucoes} ${c.execucoes === 1 ? 'vez' : 'vezes'}, a última ${dia(c.ultima)}.` : 'Ainda não feito.' }}</span>
          </span>
          <span class="hidden items-center gap-3 lg:flex">
            <template v-if="c.media !== null">
              <span><b class="block text-[15px] tabular-nums">{{ c.media }}%</b><span class="text-[12px] text-texto-2">de acerto</span></span>
              <Minigrafico v-if="c.serie.length >= 2" :valores="c.serie" :largura="72" :altura="30" />
            </template>
          </span>
          <span class="flex items-center gap-1">
            <button type="button" class="botao-secundario botao-p" :aria-busy="criando === c.id" :disabled="!!criando" @click="comecar({ conjuntoId: c.id }, c.id)">{{ criando === c.id ? 'Montando' : 'Começar' }}</button>
            <MenuAcoes :rotulo="`Ações de ${c.nome}`" :itens="acoesConjunto" @escolher="menuConjunto(c, $event)" />
          </span>
        </li>
      </TransitionGroup>
      <p v-else class="painel m-0 mt-3 text-[14.5px] text-texto-2">
        Nenhum estudo salvo ainda. Monte um do seu jeito e salve com um nome. <NuxtLink to="/revisar/nova" class="link">Montar um estudo</NuxtLink>
      </p>
    </section>

    <!-- Últimos estudos -->
    <section v-revelar v-if="execucoes.ultimas.length" class="entra mt-10" style="--i: 5" aria-labelledby="titulo-ultimos">
      <h2 id="titulo-ultimos" class="titulo-secao flex items-center gap-2"><History :size="20" :stroke-width="2" aria-hidden="true" />Últimos estudos</h2>
      <ul class="cartao m-0 mt-3 list-none divide-y divide-borda p-0">
        <li v-for="u in execucoes.ultimas.slice(0, 5)" :key="u.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px] sm:grid-cols-[150px_minmax(0,1fr)_auto_auto] sm:px-5">
          <span class="text-[13px] text-texto-2 max-sm:order-2 max-sm:col-span-2">{{ hora(u.criado_em) }}</span>
          <b class="min-w-0 truncate font-semibold">{{ u.titulo.split(',')[0] }}</b>
          <span class="text-right tabular-nums">
            <template v-if="u.status === 'concluida'"><Fracao :valor="u.certas" :total="u.respondidas" sem-animacao /> <span class="text-texto-2">certas</span></template>
            <span v-else class="selo" data-tipo="acento">{{ u.status === 'pausada' ? 'Pausado' : 'Aberto' }}</span>
          </span>
          <NuxtLink :to="u.status === 'concluida' ? `/revisar/${u.id}/resultado` : `/revisar/${u.id}`" class="link text-[14px] max-sm:hidden">{{ u.status === 'concluida' ? 'Ver resultado' : 'Continuar' }}</NuxtLink>
        </li>
      </ul>
    </section>

    <JanelaBase ref="janelaApagar" titulo="Apagar este estudo?" :descricao="`'${paraApagar?.nome ?? ''}' sai da lista. Os resultados de quando você fez continuam no histórico.`">
      <template #rodape>
        <button type="button" class="botao-fantasma" @click="janelaApagar?.fechar()">Manter</button>
        <button type="button" class="botao botao-perigo" @click="apagar">Apagar</button>
      </template>
    </JanelaBase>
  </div>
</template>
