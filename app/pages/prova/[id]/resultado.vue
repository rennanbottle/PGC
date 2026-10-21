<script setup>
// Resultado da prova: a nota (com a comparação com a anterior do mesmo formato), os pontos, o próximo passo, o
// acerto por matéria, por tipo e por nível, o tempo de cada questão, o cartão-resposta conferido e as correções.
// A nota é calculada com as mesmas regras do servidor (shared/regras/provas.js).
import { ArrowDown, ArrowUp, CircleCheck, CircleMinus, CircleX, Clock, Copy, House, RotateCcw, Target, Trophy, TriangleAlert } from '@lucide/vue'
import { duracao, formatoDe, notaDaProva, notaPorMateria } from '#shared/regras/provas.js'
import { nomeDoNivel, nomeDoTipo } from '#shared/regras/questoes.js'

const route = useRoute()
const id = String(route.params.id)
const { data, error } = await useFetch(`/api/provas/${id}/resultado`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage ?? 'Não deu para abrir o resultado.', fatal: true })
useHead({ title: () => `Resultado, ${data.value?.prova?.titulo ?? 'prova'} | PGC` })

const prova = computed(() => data.value?.prova ?? {})
const itens = computed(() => data.value?.itens ?? [])
const assuntos = computed(() => data.value?.assuntos ?? {})
const nota = computed(() => notaDaProva(itens.value, prova.value.formato))
const materias = computed(() => notaPorMateria(itens.value, assuntos.value))
const anterior = computed(() => data.value?.anterior ?? null)
const diferenca = computed(() => (anterior.value ? nota.value.porcentagem - anterior.value.porcentagem : null))
const serie = computed(() => data.value?.serie ?? [])
// Prova de domínio: passou ou não, e o que muda no assunto.
const dominio = computed(() => data.value?.dominio ?? null)
const nomeDoAssunto = computed(() => (dominio.value?.assuntoId ? assuntos.value[dominio.value.assuntoId]?.nome ?? 'O assunto' : 'O assunto'))
const avisoDominio = computed(() => {
  const d = dominio.value
  if (!d) return null
  const total = itens.value.length
  if (d.aprovada && d.estadoDepois === 'dominado') return { ok: true, titulo: `${nomeDoAssunto.value} agora está Dominado.`, texto: `${d.certas}/${total} certas, sem dica. O PGC continua trazendo as revisões para você não esquecer.` }
  if (d.aprovada) return { ok: true, titulo: 'Prova de domínio aprovada.', texto: `${d.certas}/${total} certas. O assunto fica Dominado quando os outros critérios voltarem a ser cumpridos; a página do assunto mostra quais.` }
  return { ok: false, titulo: `Faltaram ${Math.max(1, d.minimo - d.certas)} ${d.minimo - d.certas === 1 ? 'acerto' : 'acertos'} para o domínio.`, texto: `Precisava de ${d.minimo}/${total} certas. A próxima tentativa abre amanhã: reveja as erradas abaixo antes.` }
})
const humor = computed(() => (nota.value.porcentagem >= 70 ? 'orgulhoso' : nota.value.porcentagem >= 50 ? 'feliz' : 'encorajador'))
const frase = computed(() => {
  const p = nota.value.porcentagem
  if (p >= 85) return 'Prova muito bem feita. Mantenha o ritmo das revisões.'
  if (p >= 70) return 'Boa nota. Treinar as erradas agora ajuda a fixar.'
  if (p >= 50) return 'Na média. As erradas mostram o que estudar primeiro.'
  return 'Abaixo da metade. Comece pelas matérias com menor acerto.'
})

const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' })
const descricao = computed(() => `${prova.value.titulo}. Entregue em ${prova.value.entregueEm ? fmt.format(new Date(prova.value.entregueEm)) : ''}, em ${duracao(prova.value.segundos)} de ${duracao((prova.value.minutos ?? 0) * 60)}.`)

const partes = computed(() => [
  { chave: 'certas', nome: nota.value.certas === 1 ? 'certa' : 'certas', n: nota.value.certas, cor: 'bg-ok', icone: CircleCheck, texto: 'text-ok' },
  { chave: 'parciais', nome: nota.value.parciais === 1 ? 'meio certa' : 'meio certas', n: nota.value.parciais, cor: 'bg-aviso', icone: CircleMinus, texto: 'text-aviso' },
  { chave: 'erradas', nome: nota.value.erradas === 1 ? 'errada' : 'erradas', n: nota.value.erradas, cor: 'bg-erro', icone: CircleX, texto: 'text-erro' },
  { chave: 'branco', nome: 'em branco', n: nota.value.emBranco, cor: 'bg-folha-3', icone: CircleMinus, texto: 'text-texto-3' },
].filter((p) => p.n > 0))
const nErros = computed(() => nota.value.erradas + nota.value.parciais + nota.value.emBranco)

// ---------- Por matéria, tipo e nível ----------
const fraseMaterias = computed(() => {
  const l = materias.value
  if (l.length < 2) return ''
  const melhor = [...l].sort((a, b) => b.porcentagem - a.porcentagem)[0]
  const abaixo = l.filter((m) => m.porcentagem < 60)
  return `${melhor.materia} foi a melhor (${melhor.porcentagem}%).${abaixo.length ? ` ${abaixo.map((m) => m.materia).join(' e ')} ${abaixo.length === 1 ? 'ficou' : 'ficaram'} abaixo de 60%.` : ' Nenhuma ficou abaixo de 60%.'}`
})
const correcoes = computed(() => data.value?.correcoes ?? [])
// Agrupa as correções e conta certas, meio certas, erradas e em branco de cada grupo.
function agrupar(chaveDe, nomeDe) {
  const g = new Map()
  for (const c of correcoes.value) {
    const k = chaveDe(c)
    const l = g.get(k) ?? { rotulo: nomeDe(k), nome: nomeDe(k), certas: 0, parciais: 0, erradas: 0, branco: 0, total: 0 }
    l.total++
    if (c.resultado === 'correta') l.certas++
    else if (c.resultado === 'parcial') l.parciais++
    else if (c.resultado === 'errada') l.erradas++
    else l.branco++
    g.set(k, l)
  }
  return [...g.entries()]
}
const linhasMaterias = computed(() => agrupar((c) => assuntos.value[c.assuntoId]?.materia ?? 'Sem matéria', (k) => k).map(([, l]) => l).sort((a, b) => b.total - a.total))
const linhasTipos = computed(() => agrupar((c) => c.tipo, (k) => nomeDoTipo(k)).map(([, l]) => l).sort((a, b) => b.total - a.total))
const linhasNiveis = computed(() => agrupar((c) => c.nivel ?? 0, (k) => (k ? nomeDoNivel(k) : 'Sem nível')).sort((a, b) => a[0] - b[0]).map(([, l]) => l))
const acertoDe = (l) => (l.total ? Math.round((100 * (l.certas + 0.5 * l.parciais)) / l.total) : 0)
const resumoLinhas = (linhas) => linhas.map((l) => `${l.nome}: ${acertoDe(l)}%, ${l.certas} de ${l.total} certas`).join('. ')

// ---------- Tempo ----------
const COR = { correta: 'var(--ok-vivo)', parcial: 'var(--aviso-vivo)', errada: 'var(--erro-vivo)' }
const PALAVRA = { correta: 'certa', parcial: 'meio certa', errada: 'errada' }
const minutosDe = (seg) => {
  const s = Math.round(seg ?? 0)
  return s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}` : `${s} s`
}
const dadosTempo = computed(() => itens.value.map((it, k) => ({ rotulo: String(k + 1), valor: Math.round((it.segundos ?? 0) / 6) / 10, cor: COR[it.correcao?.resultado] ?? 'var(--folha-3)', dica: `Questão ${k + 1}: ${minutosDe(it.segundos ?? 0)}, ${PALAVRA[it.correcao?.resultado] ?? 'em branco'}` })))
const mediaTempo = computed(() => {
  const l = itens.value.filter((i) => i.segundos)
  if (!l.length) return null
  const seg = Math.round(l.reduce((s, i) => s + i.segundos, 0) / l.length)
  return { valor: Math.round(seg / 6) / 10, seg, texto: `média ${minutosDe(seg)}` }
})
const fraseTempo = computed(() => {
  const l = itens.value
  if (!l.length || !mediaTempo.value) return 'Sem tempo registrado.'
  const k = l.reduce((m, it, j) => ((it.segundos ?? 0) > (l[m].segundos ?? 0) ? j : m), 0)
  return `Média de ${minutosDe(mediaTempo.value.seg)} por questão. A mais demorada foi a ${k + 1} (${minutosDe(l[k].segundos)}), de ${assuntos.value[l[k].assuntoId]?.materia ?? 'sem matéria'}.`
})
const legendaTempo = computed(() => partes.value)

// ---------- Cartão conferido e correções ----------
const soErradas = ref(false)
const lista = ref(null)
const listaCorrecoes = computed(() => correcoes.value.map((c) => ({
  ...c,
  numero: c.ordem + 1,
  resultado: c.resultado === 'errada' ? 'incorreta' : c.resultado,
  assunto: assuntos.value[c.assuntoId] ? `${assuntos.value[c.assuntoId].materia}, ${assuntos.value[c.assuntoId].nome}` : '',
})))
// As erradas e as em branco viram um estudo com correção a cada questão.
const apiEstudo = useRevisoes()
const treinando = ref(false)
const erroTreino = ref('')
async function treinar() {
  treinando.value = true
  erroTreino.value = ''
  try {
    const r = await apiEstudo.criar({ refazer: id })
    await navigateTo(`/revisar/${r.id}`)
  }
  catch (e) {
    erroTreino.value = e.message
    treinando.value = false
  }
}
function abrirCorrecao(k) {
  const c = correcoes.value[k]
  if (c) lista.value?.abrir(c.id)
}
</script>

<template>
  <div v-if="data" class="pb-12">
    <CabecalhoPagina titulo="Resultado da prova" :descricao="descricao" :voltar="{ para: '/prova', texto: 'Prova' }" />
    <p v-if="prova.porTempo" class="mt-4 flex items-center gap-2 text-[14px] font-semibold text-aviso" role="status"><TriangleAlert :size="16" :stroke-width="2.2" aria-hidden="true" />O tempo acabou e a prova foi entregue com o que estava marcado.</p>

    <section v-if="avisoDominio" class="entra mt-5 flex flex-wrap items-center gap-4 rounded-[18px] border px-5 py-4" :class="avisoDominio.ok ? 'border-ok bg-ok-suave' : 'border-aviso bg-aviso-suave'" style="--i: 0" role="status">
      <Trophy v-if="avisoDominio.ok" :size="26" :stroke-width="2" class="shrink-0 text-ok" aria-hidden="true" />
      <Target v-else :size="26" :stroke-width="2" class="shrink-0 text-aviso" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="m-0 text-[17px] font-bold">{{ avisoDominio.titulo }}</p>
        <p class="m-0 mt-0.5 text-[14.5px]">{{ avisoDominio.texto }}</p>
      </div>
      <NuxtLink v-if="dominio.assuntoId" :to="`/assuntos/${dominio.assuntoId}`" class="botao-secundario shrink-0 no-underline">Ver o assunto</NuxtLink>
    </section>

    <div class="mt-6 grid items-stretch gap-4 lg:grid-cols-[1.6fr_1fr]">
      <!-- A nota -->
      <section class="cartao entra flex flex-col" style="--i: 0" aria-labelledby="titulo-nota">
        <div class="flex items-start gap-4 sm:gap-6">
          <GuiaPersonagem :humor="humor" :tamanho="92" class="hidden shrink-0 sm:block" />
          <div class="min-w-0 flex-1">
            <h2 id="titulo-nota" class="m-0 text-[13.5px] font-semibold text-texto-2">Nota</h2>
            <p class="m-0 mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="numero-grande"><NumeroAnimado :valor="nota.porcentagem" sufixo="%" /></span>
              <span class="text-[15px] text-texto-2"><Fracao :valor="nota.certas" :total="nota.total" /> certas</span>
            </p>
            <p v-if="nota.desconto" class="m-0 mt-1.5 text-[13.5px] text-texto-2">Nota líquida {{ String(nota.liquida).replace('.', ',') }}: {{ nota.certas }} certas menos {{ nota.erradas }} erradas. Em branco não desconta.</p>
            <p v-if="diferenca !== null" class="m-0 mt-2 flex flex-wrap items-center gap-2 text-[13.5px] text-texto-2">
              <span class="selo" :data-tipo="diferenca > 0 ? 'ok' : diferenca < 0 ? 'erro' : undefined">
                <ArrowUp v-if="diferenca > 0" :size="13" :stroke-width="2.6" aria-hidden="true" /><ArrowDown v-else-if="diferenca < 0" :size="13" :stroke-width="2.6" aria-hidden="true" />{{ diferenca > 0 ? `+${diferenca}` : diferenca < 0 ? diferenca : 'Igual' }}
              </span>
              que a prova {{ formatoDe(prova.formato).nome }} anterior ({{ anterior.porcentagem }}%, {{ fmtCurto.format(new Date(anterior.entregueEm)) }})
            </p>
            <p v-else-if="!dominio" class="m-0 mt-2 text-[13.5px] text-texto-2">A comparação aparece na segunda prova do mesmo formato.</p>
            <p class="m-0 mt-3 flex items-center gap-3 text-[15.5px] font-semibold"><GuiaPersonagem :humor="humor" :tamanho="44" class="shrink-0 sm:hidden" />{{ frase }}</p>
          </div>
        </div>
        <div class="mt-auto pt-5">
          <div class="flex h-3 gap-[2px]" role="img" :aria-label="partes.map((p) => `${p.n} ${p.nome}`).join(', ')">
            <span v-for="(p, i) in partes" :key="p.chave" class="barra-parte rounded-[3px]" :class="p.cor" :style="{ flex: p.n, animationDelay: `${i * 90 + 250}ms` }" />
          </div>
          <ul class="m-0 mt-2.5 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[13.5px]">
            <li v-for="p in partes" :key="p.chave" class="flex items-center gap-1.5"><component :is="p.icone" :size="15" :stroke-width="2.2" :class="p.texto" aria-hidden="true" /><b>{{ p.n }}</b> {{ p.nome }}</li>
          </ul>
        </div>
        <div v-if="serie.length > 1" class="mt-5 flex items-end justify-end gap-3 border-t border-borda pt-4">
          <span class="text-right text-[12.5px] leading-tight text-texto-2">Suas últimas {{ serie.length }} provas<br><span class="text-texto-3">esta prova é o último ponto</span></span>
          <Minigrafico :valores="serie" :largura="150" :altura="40" />
        </div>
      </section>

      <!-- Pontos -->
      <section class="cartao entra flex flex-col" style="--i: 1" aria-labelledby="titulo-pontos">
        <h2 id="titulo-pontos" class="m-0 text-[13.5px] font-semibold text-texto-2">Pontos ganhos</h2>
        <p class="numero-medio m-0 mt-1 text-energia-texto">+<NumeroAnimado :valor="data.pontos?.total ?? 0" /></p>
        <dl class="m-0 mt-3">
          <div v-for="(p, i) in data.pontos?.detalhe ?? []" :key="i" class="flex justify-between gap-3 border-t border-borda py-2 text-[13.5px]">
            <dt class="text-texto-2">{{ p.texto }}</dt><dd class="m-0 font-semibold tabular-nums">{{ p.pontos > 0 ? '+' : '' }}{{ p.pontos }}</dd>
          </div>
        </dl>
        <div v-if="data.nivel" class="mt-auto border-t border-borda pt-3">
          <p class="m-0 flex items-center justify-between gap-2 text-[13.5px]">
            <b class="flex items-center gap-2">Nível {{ data.nivel.depois }}<span v-if="data.nivel.depois > data.nivel.antes" class="selo" data-tipo="energia"><ArrowUp :size="12" :stroke-width="2.6" aria-hidden="true" />subiu</span></b>
            <span class="tabular-nums text-texto-2">faltam {{ Math.max(0, data.nivel.proximo - data.nivel.pontos) }} para o {{ data.nivel.depois + 1 }}</span>
          </p>
          <div class="barra fina mt-2" role="img" :aria-label="`${data.nivel.pontos} pontos no total`"><i :style="{ width: `${Math.min(100, (data.nivel.pontos / Math.max(1, data.nivel.proximo)) * 100)}%` }" /></div>
        </div>
      </section>
    </div>

    <!-- Próximo passo -->
    <section class="cartao-destaque entra mt-4 flex flex-wrap items-center justify-between gap-4" style="--i: 2" aria-labelledby="titulo-proximo">
      <div class="min-w-0">
        <h2 id="titulo-proximo" class="m-0 text-[16px] font-semibold">{{ nErros ? 'Treine as que não acertou agora, com a correção fresca.' : 'Nenhuma errada. Que tal uma prova mais difícil?' }}</h2>
        <p class="m-0 mt-1 text-[14px] text-texto-2">As erradas e as em branco viram um estudo com correção a cada questão. As revisões delas já foram marcadas.</p>
        <p v-if="erroTreino" class="erro-campo treme mt-2" role="alert"><TriangleAlert :size="16" :stroke-width="2.2" aria-hidden="true" />{{ erroTreino }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="nErros" type="button" class="botao gap-2" :aria-busy="treinando" :disabled="treinando" @click="treinar">
          <span v-if="treinando" class="rodando" aria-hidden="true" /><RotateCcw v-else :size="16" :stroke-width="2.2" aria-hidden="true" />{{ nErros === 1 ? 'Treinar a que faltou' : `Treinar as ${nErros}` }}
        </button>
        <NuxtLink v-if="!dominio" :to="`/prova/nova?repetir=${id}`" class="gap-2 no-underline" :class="nErros ? 'botao-secundario' : 'botao'"><Copy :size="16" :stroke-width="2.2" aria-hidden="true" />Outra prova igual</NuxtLink>
        <NuxtLink to="/inicio" class="botao-fantasma gap-2 no-underline"><House :size="16" :stroke-width="2.2" aria-hidden="true" />Voltar ao Início</NuxtLink>
      </div>
    </section>

    <!-- Gráficos -->
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <section v-revelar class="cartao" aria-labelledby="titulo-materias">
        <h2 id="titulo-materias" class="titulo-cartao m-0">Por matéria</h2>
        <GraficoAcerto class="mt-3" :linhas="linhasMaterias" :descricao="resumoLinhas(linhasMaterias)" larguraRotulo="9rem" />
        <p v-if="fraseMaterias" class="m-0 mt-3 text-[13.5px] text-texto-2">{{ fraseMaterias }}</p>
      </section>
      <div class="grid content-start gap-4">
        <section v-revelar="1" class="cartao" aria-labelledby="titulo-tipos">
          <h2 id="titulo-tipos" class="titulo-cartao m-0">Por tipo de questão</h2>
          <GraficoAcerto class="mt-3" :linhas="linhasTipos" :descricao="resumoLinhas(linhasTipos)" :legenda="false" larguraRotulo="11rem" />
        </section>
        <section v-if="linhasNiveis.length > 1" v-revelar="2" class="cartao" aria-labelledby="titulo-niveis">
          <h2 id="titulo-niveis" class="titulo-cartao m-0">Por nível</h2>
          <GraficoAcerto class="mt-3" :linhas="linhasNiveis" :descricao="resumoLinhas(linhasNiveis)" :legenda="false" larguraRotulo="7.5rem" />
        </section>
      </div>
    </div>
    <section v-revelar class="cartao mt-4" aria-labelledby="titulo-tempo">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-tempo" class="titulo-cartao m-0 flex items-center gap-2"><Clock :size="17" :stroke-width="2.2" class="text-texto-2" aria-hidden="true" />Tempo em cada questão</h2>
        <ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12.5px] text-texto-2" aria-hidden="true">
          <li v-for="p in legendaTempo" :key="p.chave" class="flex items-center gap-1.5"><component :is="p.icone" :size="13" :stroke-width="2.4" :class="p.texto" />{{ p.nome }}</li>
        </ul>
      </div>
      <p class="m-0 mt-1 text-[13px] text-texto-2">Em minutos. Só informação: o tempo não muda a nota.</p>
      <GraficoBarras class="mt-4" :dados="dadosTempo" :altura="130" :media="mediaTempo" :mostrar-rotulos="itens.length <= 30" :descricao="fraseTempo" />
      <p class="m-0 mt-3 text-[13.5px] text-texto-2">{{ fraseTempo }}</p>
    </section>

    <!-- Cartão-resposta conferido -->
    <section v-revelar class="cartao mt-4" aria-labelledby="titulo-conferido">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titulo-conferido" class="titulo-cartao m-0">Cartão-resposta conferido</h2>
          <p class="m-0 mt-0.5 text-[13.5px] text-texto-2">Bolinha cheia: a sua. Com anel: a certa. Toque numa linha para ver a correção.</p>
        </div>
        <div role="radiogroup" aria-label="Mostrar" class="flex gap-2">
          <button type="button" class="pilula" role="radio" :aria-checked="!soErradas" @click="soErradas = false">Todas</button>
          <button type="button" class="pilula" role="radio" :aria-checked="soErradas" @click="soErradas = true">Só as que errei</button>
        </div>
      </div>
      <ProvaCartaoResposta class="mt-3" :itens="itens" conferido colunas :so="soErradas ? 'erradas' : ''" @ir="abrirCorrecao" />
    </section>

    <!-- Correções -->
    <section class="mt-8" aria-labelledby="titulo-questoes">
      <h2 id="titulo-questoes" class="titulo-secao m-0">Questões e correções</h2>
      <p class="m-0 mt-0.5 text-[14px] text-texto-2">Toque numa linha do cartão-resposta ou abra uma questão da lista para ver a sua resposta, a certa e a explicação.</p>
      <ResultadoCorrecoes ref="lista" class="mt-2" :correcoes="listaCorrecoes" :mapa="false" palavra-parcial="Meio certa" />
    </section>
  </div>
</template>

<style scoped>
.barra-parte {
  transform-origin: left center;
  animation: cresce-x 0.8s var(--ease-saida) backwards;
}
@media (prefers-reduced-motion: reduce) {
  .barra-parte {
    animation: none;
  }
}
:global(:root.menos-movimento) .barra-parte {
  animation: none;
}
</style>
