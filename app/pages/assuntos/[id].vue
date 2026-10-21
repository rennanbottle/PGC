<script setup>
// Página do assunto (prévia A, escolhida em 14/10): à esquerda, a proficiência com a linha dos estudos, o acerto por
// nível de pensamento e por tipo, a curva de lembrança e os erros recentes; à direita, presos ao rolar, a prova de
// domínio (pode fazer, o que falta ou o resultado), os critérios de domínio com o que fazer em cada um e os conceitos
// do material. Embaixo, à esquerda, os assuntos relacionados (aceitos e sugeridos, com o motivo).
// Tudo vem de /api/assuntos/:id, calculado na hora.
import { BookOpen, Check, CircleCheck, Link2, X, CircleDashed, CircleX, Clock, Play, RotateCcw, Sparkles, Target, Timer, TriangleAlert, Trophy } from '@lucide/vue'
import { ESTADOS } from '#shared/regras/dominio.js'
import { TIPO_SELO_ESTADO } from '#shared/regras/materias.js'
import { RITMOS } from '#shared/regras/ritmo.js'
import { DICAS_CRITERIO } from '#shared/regras/assunto.js'
import { minutosDaProvaDominio, textoDoNivelMinimo } from '#shared/regras/provaDominio.js'
import { trechoParaLista } from '#shared/regras/questoes.js'

const route = useRoute()
const id = String(route.params.id)
const { data, error, refresh } = await useFetch(`/api/assuntos/${id}`, { key: `assunto-${id}` })
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage ?? 'Não deu para abrir o assunto.', fatal: true })
useHead({ title: () => `${data.value?.assunto?.nome ?? 'Assunto'} | PGC` })

const a = computed(() => data.value?.assunto ?? {})
const av = computed(() => data.value?.avaliacao ?? {})
const prova = computed(() => data.value?.prova ?? {})
const regra = computed(() => prova.value.regra)
const ritmo = computed(() => RITMOS[data.value?.ritmo] ?? RITMOS.normal)
const materia = computed(() => a.value.materia)
const semEstudo = computed(() => !av.value.checklist?.length)
const metaDominio = computed(() => ritmo.value.dominado.proficiencia)

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const dia = (d) => (d ? fmt.format(new Date(d)) : '')
const diaIso = (d) => (d ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)) : '')

const descricao = computed(() => {
  const q = data.value?.questoes ?? { total: 0, elegiveis: 0 }
  const partes = [materia.value?.nome ?? 'Sem matéria']
  partes.push(`${q.total} ${q.total === 1 ? 'questão' : 'questões'} no banco${regra.value ? `, ${q.elegiveis} de nível ${textoDoNivelMinimo(regra.value.nivelMinimo)}` : ''}.`)
  return partes.join('. ')
})
const estudar = computed(() => (materia.value ? `/revisar/nova?materia=${materia.value.id}&assuntos=${id}` : '/revisar/nova'))
const gerar = computed(() => (materia.value ? `/questoes/gerar?materia=${materia.value.id}&assunto=${id}` : '/questoes/gerar'))

// Proficiência: quanto mudou desde o primeiro estudo.
const linha = computed(() => data.value?.linha ?? [])
const variacao = computed(() => {
  const l = linha.value
  if (l.length < 2) return ''
  const d = l.at(-1).valor - l[0].valor
  return `${d >= 0 ? '+' : ''}${d} desde o primeiro estudo, em ${dia(l[0].data)}`
})

// Critérios: cumpridos primeiro? Não: na ordem do motor, com os que faltam marcados e o que fazer.
const criterios = computed(() => av.value.checklist ?? [])
const cumpridos = computed(() => criterios.value.filter((c) => c.ok).length)
const valorDo = (c) => (typeof c.meta === 'number' ? `${c.valor}/${c.meta}` : `${c.valor} (${c.meta})`)
const nomeCriterio = (c) => c.texto.replace(' (%)', '')

// Assuntos relacionados: aceitar, recusar ou tirar. Estudar juntos abre um estudo com os dois assuntos.
const relacionados = computed(() => data.value?.relacionados ?? { aceitos: [], sugeridos: [] })
const { avisar } = useAvisos()
const mexendo = ref('')
async function relacionar(outro, status) {
  mexendo.value = outro.id
  try {
    await $fetch(`/api/assuntos/${id}/relacao`, { method: 'POST', body: { outro: outro.id, status } })
    await refresh()
    if (status === 'recusado') avisar({ texto: `${outro.nome} não aparece mais como sugestão.`, acao: { texto: 'Desfazer', fazer: () => relacionar(outro, null) } })
    else if (status === 'aceito') avisar({ texto: `${outro.nome} agora é um assunto relacionado.`, tipo: 'ok' })
  }
  catch (e) {
    avisar({ texto: e?.data?.statusMessage ?? 'Não deu para salvar agora. Tente de novo.', tipo: 'erro' })
  }
  mexendo.value = ''
}
const estudarJuntos = (outro) => (materia.value ? `/revisar/nova?materia=${materia.value.id}&assuntos=${id},${outro.id}` : '/revisar/nova')

// Prova de domínio: o cartão muda com a situação.
const api = useProvas()
const comecando = ref(false)
const erroProva = ref('')
async function comecarProva() {
  comecando.value = true
  erroProva.value = ''
  try {
    const r = await api.dominio(id)
    await navigateTo(`/prova/${r.id}`)
  }
  catch (e) {
    erroProva.value = e.message
    comecando.value = false
    refresh()
  }
}
const bonus = computed(() => ritmo.value.bonusDominado)
const cartaoProva = computed(() => {
  const p = prova.value
  const r = regra.value
  switch (p.motivo) {
    case null:
    case undefined:
      return { titulo: 'Todos os critérios cumpridos', texto: `Aprovado, o assunto fica Dominado e vale +${bonus.value} pontos.`, humor: 'empolgado' }
    case 'dominado':
      return { titulo: 'Assunto dominado', texto: `${p.aprovadaEm ? `Prova aprovada em ${dia(p.aprovadaEm)}. ` : ''}O PGC continua trazendo as revisões para você não esquecer.`, humor: 'orgulhoso' }
    case 'sem_prova':
      return { titulo: 'Sem prova neste ritmo', texto: 'No ritmo Tranquilo, o domínio não pede prova: cumprindo os critérios, o assunto fica Dominado.' }
    case 'andamento':
      return { titulo: p.emAndamento?.doAssunto ? 'Prova de domínio em andamento' : 'Outra prova em andamento', texto: p.emAndamento?.doAssunto ? 'O relógio continua correndo.' : 'Entregue a prova aberta antes de começar a de domínio.' }
    case 'amanha':
      return { titulo: 'Nova tentativa amanhã', texto: p.ultima ? `Hoje: ${p.ultima.certas}/${p.ultima.total} certas. Precisava de ${r?.minimoCertas}. Reveja os erros e tente de novo amanhã.` : 'A próxima tentativa abre amanhã.' }
    case 'questoes':
      return { titulo: `Faltam ${p.faltam} ${p.faltam === 1 ? 'questão' : 'questões'}`, texto: `A prova precisa de ${r?.questoes} questões de nível ${textoDoNivelMinimo(r?.nivelMinimo)} deste assunto, dos tipos que o PGC corrige sozinho.` }
    default: {
      const faltam = criterios.value.filter((c) => !c.ok && c.id !== 'prova').length
      return { titulo: semEstudo.value ? 'Ainda sem estudos' : `Faltam ${faltam} ${faltam === 1 ? 'critério' : 'critérios'}`, texto: 'Quando todos os critérios estiverem cumpridos, a prova abre aqui.' }
    }
  }
})

// Gráficos.
const porBloom = computed(() => (data.value?.porBloom ?? []).map((g) => ({ ...g, nome: g.rotulo })))
const porTipo = computed(() => (data.value?.porTipo ?? []).map((g) => ({ ...g, nome: g.rotulo })))
const resumoLinhas = (l) => l.map((g) => `${g.rotulo}: ${g.certas} de ${g.total} certas`).join('. ')
const lembranca = computed(() => data.value?.lembranca ?? { curva: [] })
</script>

<template>
  <div v-if="data" class="pb-12">
    <CabecalhoPagina :titulo="a.nome" :descricao="descricao" :voltar="materia ? { para: `/materias/${materia.id}`, texto: materia.nome } : { para: '/materias', texto: 'Matérias' }">
      <template #acoes>
        <NuxtLink :to="estudar" class="botao-secundario gap-2 no-underline"><Play :size="16" :stroke-width="2.2" aria-hidden="true" />Estudar este assunto</NuxtLink>
        <NuxtLink :to="gerar" class="botao-fantasma gap-2 no-underline"><Sparkles :size="16" :stroke-width="2" aria-hidden="true" />Gerar questões</NuxtLink>
      </template>
    </CabecalhoPagina>

    <div class="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <!-- Esquerda -->
      <div class="grid min-w-0 gap-4">
        <section class="cartao entra" style="--i: 0" aria-labelledby="titulo-agora" data-guia="assunto-proficiencia">
          <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div>
              <h2 id="titulo-agora" class="m-0 text-[13.5px] font-semibold text-texto-2">Proficiência</h2>
              <p class="m-0 mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span class="numero-grande"><NumeroAnimado v-if="av.proficiencia !== null && av.proficiencia !== undefined" :valor="av.proficiencia" /><span v-else class="text-[22px] font-semibold text-texto-2">Sem estudos ainda</span></span>
                <span class="selo" :data-tipo="TIPO_SELO_ESTADO[av.estado] || undefined"><CircleCheck v-if="TIPO_SELO_ESTADO[av.estado] === 'ok'" :size="13" :stroke-width="2.4" aria-hidden="true" />{{ ESTADOS[av.estado] ?? av.estado }}</span>
              </p>
              <p v-if="variacao" class="m-0 mt-1 text-[13.5px] text-texto-2">{{ variacao }}</p>
            </div>
            <dl class="m-0 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-[14px]">
              <dt class="text-texto-2">Lembrança hoje</dt><dd class="m-0 font-semibold tabular-nums">{{ av.retencao !== null && av.retencao !== undefined ? `${av.retencao}%` : 'sem dado' }}</dd>
              <dt class="text-texto-2">Próxima revisão</dt><dd class="m-0 font-semibold">{{ lembranca.proximaRevisao ? diaIso(lembranca.proximaRevisao) : 'sem data' }}</dd>
              <dt class="text-texto-2">Respostas em 60 dias</dt><dd class="m-0 font-semibold tabular-nums">{{ av.respostas ?? 0 }}</dd>
            </dl>
          </div>
          <AssuntoLinhaProficiencia v-if="linha.length" class="mt-4" :pontos="linha" :meta="metaDominio" />
          <p v-if="linha.length" class="m-0 mt-1 text-[12.5px] text-texto-2">Cada ponto é um estudo (o vazado é uma prova). A linha tracejada é o que o domínio pede no ritmo {{ ritmo.nome }}.</p>
          <div v-else class="painel mt-4 flex flex-wrap items-center justify-between gap-3">
            <p class="m-0 text-[14.5px] text-texto-2">A linha da proficiência aparece depois do primeiro estudo deste assunto.</p>
            <NuxtLink :to="estudar" class="botao botao-p no-underline">Estudar agora</NuxtLink>
          </div>
        </section>

        <div v-if="porBloom.length || porTipo.length" class="grid gap-4 sm:grid-cols-2">
          <section v-revelar class="cartao" aria-labelledby="titulo-bloom">
            <h2 id="titulo-bloom" class="titulo-cartao m-0">Acerto por nível de pensamento</h2>
            <p class="m-0 mt-1 text-[12.5px] text-texto-2">Últimos 60 dias</p>
            <GraficoAcerto v-if="porBloom.length" class="mt-3" :linhas="porBloom" :descricao="resumoLinhas(porBloom)" largura-rotulo="5.5rem" />
            <p v-else class="m-0 mt-3 text-[14px] text-texto-2">Sem respostas nos últimos 60 dias.</p>
          </section>
          <section v-revelar="1" class="cartao" aria-labelledby="titulo-tipos">
            <h2 id="titulo-tipos" class="titulo-cartao m-0">Acerto por tipo</h2>
            <p class="m-0 mt-1 text-[12.5px] text-texto-2">Últimos 60 dias</p>
            <GraficoAcerto v-if="porTipo.length" class="mt-3" :linhas="porTipo" :descricao="resumoLinhas(porTipo)" :legenda="false" largura-rotulo="8.5rem" />
            <p v-else class="m-0 mt-3 text-[14px] text-texto-2">Sem respostas nos últimos 60 dias.</p>
          </section>
        </div>

        <section v-if="lembranca.curva.length" v-revelar class="cartao" aria-labelledby="titulo-lembranca">
          <h2 id="titulo-lembranca" class="titulo-cartao m-0">Quanto você lembra nos próximos 30 dias</h2>
          <p class="m-0 mt-1 text-[13.5px] text-texto-2">Sem revisar, a lembrança cai. A revisão é marcada para quando ela chega a 90%, e cada revisão faz a curva cair mais devagar.</p>
          <AssuntoCurvaLembranca class="mt-4" :curva="lembranca.curva" :revisao-em-dias="lembranca.revisaoEmDias" :proxima-revisao="lembranca.proximaRevisao ?? ''" />
        </section>

        <section v-revelar class="cartao" aria-labelledby="titulo-erros">
          <h2 id="titulo-erros" class="titulo-cartao m-0">Erros dos últimos 14 dias</h2>
          <ul v-if="data.erros.length" class="m-0 mt-2 list-none p-0">
            <li v-for="e in data.erros" :key="e.id" class="flex items-start gap-3 border-t border-borda py-3 first:border-0">
              <TriangleAlert :size="16" :stroke-width="2.2" class="mt-1 shrink-0 text-erro" aria-hidden="true" />
              <TextoRico :texto="trechoParaLista(e.enunciado, 180)" tag="span" class="min-w-0 flex-1 text-[15px]" />
              <NuxtLink v-if="e.questaoId" :to="`/questoes/${e.questaoId}`" class="link shrink-0 text-[13.5px]">Abrir</NuxtLink>
            </li>
          </ul>
          <p v-else class="m-0 mt-2 text-[14px] text-texto-2">Nenhum erro neste assunto nos últimos 14 dias.</p>
          <div v-if="data.erros.length" class="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-borda pt-3 text-[14px]">
            <NuxtLink :to="`/revisar/nova?receita=reforco_erros&materia=${materia?.id ?? ''}&assuntos=${id}`" class="link inline-flex items-center gap-1.5"><RotateCcw :size="14" :stroke-width="2.2" aria-hidden="true" />Estudar as erradas</NuxtLink>
          </div>
        </section>
        <section v-if="relacionados.aceitos.length || relacionados.sugeridos.length" v-revelar class="cartao" aria-labelledby="titulo-relacionados">
          <h2 id="titulo-relacionados" class="titulo-cartao m-0 flex items-center gap-2"><Link2 :size="18" :stroke-width="2" aria-hidden="true" class="text-texto-2" />Assuntos relacionados</h2>
          <p class="m-0 mt-1 text-[13.5px] text-texto-2">Estudar assuntos ligados no mesmo dia ajuda a lembrar dos dois.</p>
          <ul v-if="relacionados.aceitos.length" class="m-0 mt-3 list-none p-0" aria-label="Relacionados que você aceitou">
            <li v-for="r in relacionados.aceitos" :key="r.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-borda py-3 first:border-0">
              <div class="min-w-0 flex-1">
                <NuxtLink :to="`/assuntos/${r.id}`" class="font-semibold text-tinta no-underline hover:underline">{{ r.nome }}</NuxtLink>
                <span v-if="r.materia" class="text-[13px] text-texto-2">, {{ r.materia }}</span>
              </div>
              <NuxtLink :to="estudarJuntos(r)" class="link text-[14px]">Estudar juntos</NuxtLink>
              <button type="button" class="botao-icone" :aria-label="`Tirar ${r.nome} dos relacionados`" :data-dica="'Tirar dos relacionados'" :disabled="mexendo === r.id" @click="relacionar(r, null)"><X :size="16" :stroke-width="2" aria-hidden="true" /></button>
            </li>
          </ul>
          <template v-if="relacionados.sugeridos.length">
            <h3 class="m-0 mt-4 text-[14px] font-semibold text-texto-2">Sugestões do PGC</h3>
            <ul class="m-0 mt-1 list-none p-0">
              <li v-for="r in relacionados.sugeridos" :key="r.id" class="flex flex-col gap-2 border-t border-borda py-3 first:border-0 sm:flex-row sm:items-center">
                <div class="min-w-0 flex-1">
                  <p class="m-0"><NuxtLink :to="`/assuntos/${r.id}`" class="font-semibold text-tinta no-underline hover:underline">{{ r.nome }}</NuxtLink><span v-if="r.materia" class="text-[13px] text-texto-2">, {{ r.materia }}</span></p>
                  <p class="m-0 mt-0.5 text-[13px] text-texto-2">{{ r.motivo }}<template v-if="r.fonte"> Texto: <NuxtLink :to="`/materiais/${r.fonte.id}`" class="link">{{ r.fonte.titulo }}</NuxtLink>.</template></p>
                </div>
                <div class="flex shrink-0 gap-2">
                  <button type="button" class="botao-secundario botao-p" :disabled="mexendo === r.id" :aria-busy="mexendo === r.id" @click="relacionar(r, 'aceito')"><Check :size="15" :stroke-width="2.4" aria-hidden="true" />Aceitar</button>
                  <button type="button" class="botao-fantasma botao-p" :disabled="mexendo === r.id" @click="relacionar(r, 'recusado')">Recusar</button>
                </div>
              </li>
            </ul>
          </template>
        </section>
      </div>

      <!-- Direita -->
      <aside class="grid min-w-0 gap-4 lg:sticky lg:top-6">
        <section class="cartao-destaque entra" style="--i: 1" aria-labelledby="titulo-prova-dominio" data-guia="assunto-prova">
          <p class="m-0 flex items-center gap-2 text-[13.5px] font-semibold text-acento"><Target :size="16" :stroke-width="2.2" aria-hidden="true" />Prova de domínio</p>
          <h2 id="titulo-prova-dominio" class="m-0 mt-1.5 text-[19px] font-bold">{{ cartaoProva.titulo }}</h2>
          <ul v-if="regra && prova.motivo !== 'dominado'" class="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[14px]">
            <li class="flex items-center gap-2"><BookOpen :size="15" :stroke-width="2" class="shrink-0" aria-hidden="true" />{{ regra.questoes }} questões de nível {{ textoDoNivelMinimo(regra.nivelMinimo) }}</li>
            <li class="flex items-center gap-2"><CircleCheck :size="15" :stroke-width="2" class="shrink-0" aria-hidden="true" />Passa com {{ regra.minimoCertas }} certas, sem dica</li>
            <li class="flex items-center gap-2"><Timer :size="15" :stroke-width="2" class="shrink-0" aria-hidden="true" />{{ minutosDaProvaDominio(regra) }} minutos, correção no fim</li>
          </ul>
          <p class="m-0 mt-3 text-[14px] text-texto-2">{{ cartaoProva.texto }}</p>
          <p v-if="erroProva" class="erro-campo treme mt-2" role="alert"><TriangleAlert :size="16" :stroke-width="2.2" aria-hidden="true" />{{ erroProva }}</p>
          <button v-if="prova.pode" type="button" class="botao mt-4 w-full gap-2" :aria-busy="comecando" :disabled="comecando" @click="comecarProva">
            <span v-if="comecando" class="rodando" aria-hidden="true" /><Play v-else :size="16" :stroke-width="2.2" aria-hidden="true" />Fazer a prova de domínio
          </button>
          <NuxtLink v-else-if="prova.motivo === 'andamento' && prova.emAndamento" :to="`/prova/${prova.emAndamento.id}`" class="botao mt-4 w-full gap-2 no-underline"><Play :size="16" :stroke-width="2.2" aria-hidden="true" />Continuar a prova</NuxtLink>
          <NuxtLink v-else-if="prova.motivo === 'questoes'" :to="gerar" class="botao mt-4 w-full gap-2 no-underline"><Sparkles :size="16" :stroke-width="2.2" aria-hidden="true" />Gerar questões difíceis</NuxtLink>
          <NuxtLink v-else-if="prova.motivo === 'amanha' && prova.ultima" :to="`/prova/${prova.ultima.id}/resultado`" class="botao-secundario mt-4 w-full no-underline">Ver os erros da prova</NuxtLink>
          <p v-else-if="prova.motivo === 'dominado'" class="m-0 mt-3 flex items-center gap-2 text-[14px] font-semibold text-ok"><Trophy :size="16" :stroke-width="2.2" aria-hidden="true" />Dominado</p>
          <p v-if="prova.ultima && prova.motivo !== 'amanha'" class="m-0 mt-3 border-t border-borda pt-3 text-[13px] text-texto-2">
            Última tentativa em {{ dia(prova.ultima.data) }}: {{ prova.ultima.certas }}/{{ prova.ultima.total }} certas{{ prova.ultima.aprovada ? ', aprovada' : '' }}. <NuxtLink :to="`/prova/${prova.ultima.id}/resultado`" class="link">Ver o resultado</NuxtLink>
          </p>
        </section>

        <section class="cartao entra" style="--i: 2" aria-labelledby="titulo-criterios" data-guia="assunto-criterios">
          <h2 id="titulo-criterios" class="titulo-cartao m-0">Critérios de domínio <span v-if="criterios.length" class="font-sans text-[14px] font-semibold text-texto-2">{{ cumpridos }}/{{ criterios.length }}</span></h2>
          <p class="m-0 mt-1 text-[12.5px] text-texto-2">Ritmo {{ ritmo.nome }}. Muda no Perfil.</p>
          <ul v-if="criterios.length" class="m-0 mt-2 list-none p-0">
            <li v-for="c in criterios" :key="c.id" class="border-t border-borda py-2 text-[13.5px] first:border-0">
              <p class="m-0 flex items-center gap-2.5">
                <CircleCheck v-if="c.ok" :size="15" :stroke-width="2.3" class="shrink-0 text-ok" aria-hidden="true" />
                <CircleDashed v-else-if="c.id === 'prova'" :size="15" :stroke-width="2.3" class="shrink-0 text-texto-3" aria-hidden="true" />
                <CircleX v-else :size="15" :stroke-width="2.3" class="shrink-0 text-erro" aria-hidden="true" />
                <span class="min-w-0 flex-1">{{ nomeCriterio(c) }}<span class="so-leitor">{{ c.ok ? ', cumprido' : ', falta' }}</span></span>
                <span class="shrink-0 tabular-nums" :class="!c.ok && 'font-semibold'">{{ valorDo(c) }}</span>
              </p>
              <p v-if="!c.ok && DICAS_CRITERIO[c.id]" class="m-0 ml-[25px] mt-0.5 text-[12.5px] text-texto-2">{{ DICAS_CRITERIO[c.id] }}</p>
            </li>
          </ul>
          <p v-else class="m-0 mt-2 text-[14px] text-texto-2">Os critérios aparecem depois do primeiro estudo deste assunto.</p>
        </section>

        <section v-if="data.conceitos.termos.length || data.conceitos.formulas.length" v-revelar class="cartao" aria-labelledby="titulo-conceitos">
          <h2 id="titulo-conceitos" class="titulo-cartao m-0">Conceitos do material</h2>
          <ul v-if="data.conceitos.termos.length" class="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
            <li v-for="t in data.conceitos.termos" :key="t" class="rounded-full border border-borda px-3 py-1 text-[13.5px]">{{ t }}</li>
          </ul>
          <ul v-if="data.conceitos.formulas.length" class="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            <li v-for="f in data.conceitos.formulas" :key="f"><TextoRico :texto="`$${f}$`" tag="span" class="text-[16px]" /></li>
          </ul>
          <p class="m-0 mt-3 flex items-center gap-1.5 text-[12.5px] text-texto-2"><Clock :size="13" :stroke-width="2" aria-hidden="true" />Dos textos conferidos na Biblioteca</p>
        </section>
      </aside>
    </div>
  </div>
</template>
