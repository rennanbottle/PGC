<script setup>
// Resultado de um estudo: o acerto em destaque (com o guia pelo resultado, a comparação com os últimos estudos e o
// minigráfico), os pontos contando com o detalhe e o nível, o próximo passo, os gráficos (acerto por tipo, por nível
// e por bloco, tempo de cada questão), o comentário da IA (só aqui, no fim), cada assunto antes e depois e as
// questões com o mapa e a correção que abre.
import { ArrowDown, ArrowUp, Award, Circle, CircleAlert, CircleCheck, CircleX, Clock, House, Repeat2, RotateCcw, Sparkles } from '@lucide/vue'
import { TIPOS_BLOCO } from '#shared/regras/conjuntos.js'
import { nomeDoNivel, nomeDoTipo } from '#shared/regras/questoes.js'
import { ESTADOS } from '#shared/regras/dominio.js'

const route = useRoute()
const id = String(route.params.id)
const api = useRevisoes()
const { data, error } = await useFetch(`/api/revisoes/${id}/resultado`)
if (error.value?.statusCode === 409) await navigateTo(`/revisar/${id}`, { replace: true })
else if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage ?? 'Não deu para abrir o resultado.', fatal: true })
const r0 = data.value?.revisao
const variosBlocos = (r0?.blocos ?? []).filter((b) => !b.pulado).length > 1
useHead({ title: variosBlocos ? 'Resultado do estudo | PGC' : 'Resultado | PGC' })

const r = computed(() => data.value?.revisao ?? {})
const res = computed(() => r.value.resultado ?? {})
const correcoes = computed(() => data.value?.correcoes ?? [])
const respondidas = computed(() => r.value.respondidas ?? 0)
const acerto = computed(() => res.value.acerto ?? 0)
const quando = computed(() => (r.value.concluidaEm ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(r.value.concluidaEm)) : ''))
const minutos = computed(() => Math.max(1, Math.round((r.value.segundos ?? 0) / 60)))
const descricao = computed(() => {
  let t = `${r.value.titulo ?? 'Estudo'}. ${quando.value ? `${quando.value}, ` : ''}em ${minutos.value} min.`
  if (r.value.encerradaAntes) t += ` Encerrado com ${(r.value.total ?? 0) - respondidas.value} em branco.`
  if (route.query.tempo) t += ' O tempo acabou.'
  return t
})

// O guia reage ao acerto.
const humor = computed(() => (acerto.value >= 80 ? 'comemorativo' : acerto.value >= 60 ? 'orgulhoso' : 'encorajador'))
const frase = computed(() => {
  if (!respondidas.value) return 'Nenhuma resposta enviada. Comece de novo quando puder.'
  if (acerto.value >= 80) return 'Ótimo resultado. Quase tudo certo.'
  if (acerto.value >= 60) return 'Bom resultado. Rever as erradas agora ajuda a fixar.'
  return 'Vale ler as correções com calma e refazer as erradas.'
})

// Comparação: com as execuções anteriores do mesmo conjunto, quando houver; senão, com os últimos estudos
// (o acerto_ultimas do resumo_estudo, guardado no momento em que este estudo terminou).
const doConjunto = computed(() => data.value?.doConjunto ?? null)
const comparacao = computed(() => {
  const lista = doConjunto.value?.acertos ?? []
  if (lista.length >= 2) {
    const antes = lista.slice(0, -1)
    return { media: Math.round(antes.reduce((s, n) => s + n, 0) / antes.length), texto: antes.length === 1 ? 'que a vez anterior deste estudo' : `que a média das ${antes.length} vezes anteriores deste conjunto`, serie: lista, legenda: `Este conjunto, ${lista.length} vezes` }
  }
  if (res.value.mediaAnterior === null || res.value.mediaAnterior === undefined) return null
  const serie = res.value.ultimas ?? []
  return { media: res.value.mediaAnterior, texto: 'que a média dos últimos estudos', serie, legenda: `Seus últimos ${serie.length} estudos` }
})
const diferenca = computed(() => (comparacao.value ? acerto.value - comparacao.value.media : null))

const acertoDe = (g) => (g.total ? Math.round((100 * (g.certas + 0.5 * (g.parciais ?? 0))) / g.total) : 0)
const tempo = (seg) => {
  const s = Math.round(seg ?? 0)
  return s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}` : `${s} s`
}
const partes = computed(() => [
  { chave: 'certas', n: r.value.certas ?? 0, nome: 'certas', cor: 'bg-ok-vivo', icone: CircleCheck, texto: 'text-ok' },
  { chave: 'parciais', n: r.value.parciais ?? 0, nome: 'parciais', cor: 'bg-aviso-vivo', icone: CircleAlert, texto: 'text-aviso' },
  { chave: 'erradas', n: r.value.erradas ?? 0, nome: 'erradas', cor: 'bg-erro-vivo', icone: CircleX, texto: 'text-erro' },
  { chave: 'branco', n: Math.max(0, (r.value.total ?? 0) - respondidas.value), nome: 'em branco', cor: 'bg-folha-3', icone: Circle, texto: 'text-texto-2' },
].filter((p) => p.n > 0))

// Gráficos: acerto por tipo, por nível e por bloco (barras deitadas com certas, parciais e erradas) e o tempo de
// cada questão (na cor do resultado, com a média tracejada).
const porBloco = computed(() => (res.value.porBloco ?? []).map((b, k) => ({ ...b, k })).filter((b) => !b.pulado))
const comBranco = (g) => ({ ...g, branco: g.branco ?? Math.max(0, g.total - g.certas - (g.parciais ?? 0) - (g.erradas ?? 0)) })
const linhasBlocos = computed(() => porBloco.value.map((b, i) => comBranco({ ...b, rotulo: `${i + 1}. ${TIPOS_BLOCO[b.tipo]?.nome ?? 'Revisão'}`, nome: b.nome })))
const linhasTipos = computed(() => (res.value.porTipo ?? []).filter((g) => g.total > 0).map((g) => comBranco({ ...g, rotulo: nomeDoTipo(g.chave), nome: nomeDoTipo(g.chave) })))
const linhasNiveis = computed(() => (res.value.porNivel ?? []).filter((g) => g.total > 0 && g.chave !== 'sem').map((g) => comBranco({ ...g, rotulo: nomeDoNivel(g.chave), nome: `Nível ${nomeDoNivel(g.chave).toLowerCase()}` })))
const resumoLinhas = (linhas) => linhas.map((l) => `${l.nome ?? l.rotulo}: ${acertoDe(l)}%, ${l.certas} de ${l.total} certas`).join('. ')
const COR_RESULTADO = { correta: 'var(--ok-vivo)', parcial: 'var(--aviso-vivo)', incorreta: 'var(--erro-vivo)' }
const PALAVRA = { correta: 'certa', parcial: 'parcial', incorreta: 'errada' }
const dadosTempo = computed(() => correcoes.value.map((c, i) => ({
  rotulo: String(i + 1),
  valor: Math.round((c.segundos ?? 0) / 6) / 10,
  cor: COR_RESULTADO[c.resultado] ?? 'var(--folha-3)',
  dica: `Questão ${i + 1}: ${tempo(c.segundos ?? 0)}, ${PALAVRA[c.resultado] ?? 'em branco'}`,
})))
const mediaTempo = computed(() => {
  const l = correcoes.value.filter((c) => c.segundos)
  if (!l.length) return null
  const seg = Math.round(l.reduce((s, c) => s + c.segundos, 0) / l.length)
  return { valor: Math.round(seg / 6) / 10, seg, texto: `média ${tempo(seg)}` }
})
const fraseTempo = computed(() => {
  const l = correcoes.value
  if (!l.length || !mediaTempo.value) return 'Sem tempo registrado.'
  const k = l.reduce((m, c, j) => ((c.segundos ?? 0) > (l[m].segundos ?? 0) ? j : m), 0)
  const erradas = l.filter((c) => c.resultado === 'incorreta' && c.segundos)
  const certas = l.filter((c) => c.resultado === 'correta' && c.segundos)
  const media = (lista) => Math.round(lista.reduce((s, c) => s + c.segundos, 0) / lista.length)
  let t = `Média de ${tempo(mediaTempo.value.seg)} por questão. A mais demorada foi a ${k + 1}, com ${tempo(l[k].segundos)}.`
  if (erradas.length >= 2 && certas.length >= 2) {
    const me = media(erradas)
    const mc = media(certas)
    if (me > mc * 1.3) t += ` Nas erradas você ficou mais tempo (${tempo(me)}) que nas certas (${tempo(mc)}).`
    else if (me * 1.3 < mc) t += ` As erradas foram respondidas mais rápido (${tempo(me)}) que as certas (${tempo(mc)}). Vale ler com mais calma.`
  }
  return t
})
const fraco = computed(() => {
  const todos = [...linhasTipos.value, ...linhasNiveis.value.map((l) => ({ ...l, nome: l.nome.toLowerCase() }))].filter((l) => l.total >= 2)
  if (!todos.length) return ''
  const pior = todos.reduce((m, l) => (acertoDe(l) < acertoDe(m) ? l : m))
  return acertoDe(pior) < 60 ? `Onde mais errou: ${pior.nome}, com ${acertoDe(pior)}% de acerto.` : 'Nenhum tipo ficou abaixo de 60% de acerto.'
})

// Comentário da IA: pedido uma vez, na primeira vez que o resultado abre. Se falhar, dá para pedir de novo.
const comentario = ref(r0?.comentario ?? null)
const pedindo = ref(false)
const falhaComentario = ref('')
async function pedirComentario() {
  pedindo.value = true
  falhaComentario.value = ''
  try {
    const c = await api.comentario(id)
    if (c.status === 'pronto') comentario.value = c.comentario
    else falhaComentario.value = c.motivo ?? 'A IA não respondeu agora.'
    refreshNuxtData('ia-cota')
  }
  catch (e) {
    falhaComentario.value = e.message
  }
  pedindo.value = false
}
onMounted(() => {
  if (!comentario.value && respondidas.value >= 3) pedirComentario()
})

// Próximos passos.
const erro = ref('')
const refazendo = ref(false)
const nErros = computed(() => (r.value.erradas ?? 0) + (r.value.parciais ?? 0))
async function refazer() {
  refazendo.value = true
  erro.value = ''
  try {
    const n = await api.criar({ refazer: id })
    await navigateTo(`/revisar/${n.id}`)
  }
  catch (e) {
    erro.value = e.message
  }
  refazendo.value = false
}
const assuntosErrados = computed(() => [...new Set(correcoes.value.filter((c) => c.resultado !== 'correta' && c.assuntoId).map((c) => c.assuntoId))])
const materiaErrada = computed(() => (res.value.assuntos ?? []).find((a) => assuntosErrados.value.includes(a.id))?.materiaId)
const estudarDeNovo = computed(() => {
  const lista = res.value.assuntos ?? []
  const materia = lista.find((a) => a.materiaId)?.materiaId
  if (!materia) return '/revisar/nova'
  const ids = lista.filter((a) => a.materiaId === materia).map((a) => a.id)
  return `/revisar/nova?materia=${materia}&assuntos=${ids.join(',')}`
})
const proximo = computed(() => [...(res.value.assuntos ?? [])].filter((a) => a.proxima).sort((a, b) => a.proxima.localeCompare(b.proxima)))
const proximaData = (d) => (d ? new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)) : '')
const textoProximo = computed(() => proximo.value.slice(0, 3).map((a) => `${a.nome} volta ${proximaData(a.proxima)}`).join(', ').replace(/, ([^,]*)$/, ' e $1'))

// Assuntos: proficiência antes e depois, na escala de 300 a 800.
const posicao = (v) => `${Math.max(0, Math.min(100, ((v - 300) / 500) * 100))}%`

// Lista de questões, no formato do componente de correções.
const nomeAssunto = (aid) => (res.value.assuntos ?? []).find((a) => a.id === aid)?.nome ?? ''
const listaCorrecoes = computed(() => correcoes.value.map((c, i) => ({ ...c, numero: i + 1, resultado: c.resultado ?? 'em_branco', assunto: nomeAssunto(c.assuntoId) })))
const opcoesBloco = computed(() => (variosBlocos ? porBloco.value.map((b, i) => ({ valor: b.k, texto: `${i + 1}. ${TIPOS_BLOCO[b.tipo]?.nome ?? 'Revisão'}`, descricao: b.nome })) : []))

// Assuntos: o ponto sai do "antes" e anda até o "agora" quando a parte aparece na tela.
const MARCAS = [300, 400, 500, 600, 700, 800]
const andou = ref(false)
const secaoAssuntos = ref(null)
onMounted(() => {
  const el = secaoAssuntos.value
  if (!el || !('IntersectionObserver' in window)) {
    andou.value = true
    return
  }
  const o = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    o.disconnect()
    setTimeout(() => { andou.value = true }, 350)
  }, { threshold: 0.3 })
  o.observe(el)
})
</script>

<template>
  <div v-if="data" class="pb-12">
    <CabecalhoPagina :titulo="variosBlocos ? 'Resultado do estudo' : 'Resultado'" :descricao="descricao" :voltar="{ para: '/revisar', texto: 'Estudar' }" />
    <p v-if="erro" class="erro-campo treme" role="alert"><CircleAlert :size="16" :stroke-width="2.2" aria-hidden="true" />{{ erro }}</p>

    <div class="mt-6 grid items-stretch gap-4 lg:grid-cols-[1.6fr_1fr]">
      <!-- O principal: o acerto -->
      <section class="cartao entra flex flex-col" style="--i: 0" aria-labelledby="titulo-acerto">
        <div class="flex items-start gap-4 sm:gap-6">
          <GuiaPersonagem :humor="humor" :tamanho="92" class="hidden shrink-0 sm:block" />
          <div class="min-w-0 flex-1">
            <h2 id="titulo-acerto" class="m-0 text-[13.5px] font-semibold text-texto-2">Acerto neste estudo</h2>
            <p class="m-0 mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="numero-grande"><NumeroAnimado :valor="acerto" sufixo="%" /></span>
              <span class="text-[15px] text-texto-2"><Fracao :valor="r.certas ?? 0" :total="respondidas" /> certas</span>
            </p>
            <p v-if="diferenca !== null" class="m-0 mt-2 flex flex-wrap items-center gap-2 text-[13.5px] text-texto-2">
              <span class="selo" :data-tipo="diferenca > 0 ? 'ok' : undefined">
                <ArrowUp v-if="diferenca > 0" :size="13" :stroke-width="2.6" aria-hidden="true" /><ArrowDown v-else-if="diferenca < 0" :size="13" :stroke-width="2.6" aria-hidden="true" />{{ diferenca > 0 ? `+${diferenca}` : diferenca < 0 ? diferenca : 'Igual' }}
              </span>
              {{ comparacao.texto }} ({{ comparacao.media }}%)
            </p>
            <p v-else class="m-0 mt-2 text-[13.5px] text-texto-2">A comparação aparece a partir do segundo estudo.</p>
            <p class="m-0 mt-3 flex items-center gap-3 text-[15.5px] font-semibold">
              <GuiaPersonagem :humor="humor" :tamanho="44" class="shrink-0 sm:hidden" />{{ frase }}
            </p>
          </div>
        </div>

        <div class="mt-auto pt-5">
          <div class="flex h-3 gap-[2px]" role="img" :aria-label="partes.map((p) => `${p.n} ${p.nome}`).join(', ')">
            <span v-for="(p, i) in partes" :key="p.chave" class="barra-parte rounded-[3px]" :class="p.cor" :style="{ flex: p.n, animationDelay: `${i * 90 + 250}ms` }" />
          </div>
        <ul class="m-0 mt-2.5 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[13.5px]">
          <li v-for="p in partes" :key="p.chave" class="flex items-center gap-1.5"><component :is="p.icone" :size="15" :stroke-width="2.2" :class="p.texto" aria-hidden="true" /><b>{{ p.n }}</b> {{ p.nome }}</li>
          <li v-if="r.incertas" class="text-texto-2">{{ r.incertas }} {{ r.incertas === 1 ? 'certa marcada como incerta' : 'certas marcadas como incertas' }}</li>
        </ul>
        </div>

        <div v-if="(comparacao?.serie ?? []).length > 1 || (res.destaques ?? []).length" class="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-borda pt-4">
          <ul v-if="(res.destaques ?? []).length" class="m-0 flex min-w-0 list-none flex-col gap-1.5 p-0 text-[14px]">
            <li v-for="(d, i) in res.destaques" :key="i" class="flex items-center gap-2"><Award :size="16" :stroke-width="2" class="shrink-0 text-acento" aria-hidden="true" />{{ d }}</li>
          </ul>
          <div v-if="(comparacao?.serie ?? []).length > 1" class="ml-auto flex items-end gap-3">
            <span class="text-right text-[12.5px] leading-tight text-texto-2">{{ comparacao.legenda }}<br><span class="text-texto-3">este é o último ponto</span></span>
            <Minigrafico :valores="comparacao.serie" :largura="150" :altura="40" />
          </div>
        </div>
      </section>

      <!-- Pontos -->
      <section class="cartao entra flex flex-col" style="--i: 1" aria-labelledby="titulo-pontos">
        <h2 id="titulo-pontos" class="m-0 text-[13.5px] font-semibold text-texto-2">Pontos ganhos</h2>
        <p class="numero-medio m-0 mt-1 text-energia-texto">+<NumeroAnimado :valor="r.pontos ?? 0" /></p>
        <dl class="m-0 mt-3">
          <div v-for="(p, i) in r.pontosDetalhe" :key="i" class="flex justify-between gap-3 border-t border-borda py-2 text-[13.5px]">
            <dt class="text-texto-2">{{ p.texto }}</dt><dd class="m-0 font-semibold tabular-nums">{{ p.pontos > 0 ? '+' : '' }}{{ p.pontos }}</dd>
          </div>
        </dl>
        <div v-if="res.nivel" class="mt-auto border-t border-borda pt-3">
          <p class="m-0 flex items-center justify-between gap-2 text-[13.5px]">
            <b class="flex items-center gap-2">Nível {{ res.nivel.depois }}<span v-if="res.nivel.depois > res.nivel.antes" class="selo" data-tipo="energia"><ArrowUp :size="12" :stroke-width="2.6" aria-hidden="true" />subiu</span></b>
            <span class="tabular-nums text-texto-2">faltam {{ Math.max(0, res.nivel.proximo - res.nivel.pontos) }} para o {{ res.nivel.depois + 1 }}</span>
          </p>
          <div class="barra fina mt-2" role="img" :aria-label="`${res.nivel.pontos} pontos no total`"><i :style="{ width: `${Math.min(100, (res.nivel.pontos / Math.max(1, res.nivel.proximo)) * 100)}%` }" /></div>
        </div>
      </section>
    </div>

    <!-- Próximo passo -->
    <section class="cartao-destaque entra mt-4 flex flex-wrap items-center justify-between gap-4" style="--i: 2" aria-labelledby="titulo-proximo">
      <div class="min-w-0">
        <h2 id="titulo-proximo" class="m-0 text-[16px] font-semibold">{{ nErros ? 'Refaça as erradas agora, enquanto a correção está fresca.' : 'Tudo certo por hoje.' }}</h2>
        <p v-if="textoProximo" class="m-0 mt-1 text-[14px] text-texto-2">{{ textoProximo }}.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="nErros" type="button" class="botao gap-2" :aria-busy="refazendo" :disabled="refazendo" @click="refazer">
          <span v-if="refazendo" class="rodando" aria-hidden="true" /><RotateCcw v-else :size="16" :stroke-width="2.2" aria-hidden="true" />{{ nErros === 1 ? 'Refazer a errada' : `Refazer as ${nErros} erradas` }}
        </button>
        <NuxtLink :to="estudarDeNovo" class="gap-2 no-underline" :class="nErros ? 'botao-secundario' : 'botao'"><Repeat2 :size="16" :stroke-width="2.2" aria-hidden="true" />Estudar de novo</NuxtLink>
        <NuxtLink to="/inicio" class="botao-fantasma gap-2 no-underline"><House :size="16" :stroke-width="2.2" aria-hidden="true" />Voltar ao Início</NuxtLink>
      </div>
    </section>

    <!-- Como foi: gráficos -->
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <section v-revelar class="cartao" aria-labelledby="titulo-tipos">
        <h2 id="titulo-tipos" class="titulo-cartao m-0">Acerto por tipo de questão</h2>
        <GraficoAcerto class="mt-3" :linhas="linhasTipos" :descricao="resumoLinhas(linhasTipos)" larguraRotulo="11rem" />
        <p v-if="fraco" class="m-0 mt-3 text-[13.5px] text-texto-2">{{ fraco }}</p>
      </section>
      <div class="grid content-start gap-4">
        <section v-if="linhasNiveis.length" v-revelar="1" class="cartao" aria-labelledby="titulo-niveis">
          <h2 id="titulo-niveis" class="titulo-cartao m-0">Acerto por nível</h2>
          <GraficoAcerto class="mt-3" :linhas="linhasNiveis" :descricao="resumoLinhas(linhasNiveis)" :legenda="false" larguraRotulo="7.5rem" />
        </section>
        <section v-if="variosBlocos" v-revelar="2" class="cartao" aria-labelledby="titulo-blocos">
          <h2 id="titulo-blocos" class="titulo-cartao m-0">Acerto por bloco</h2>
          <GraficoAcerto class="mt-3" :linhas="linhasBlocos" :descricao="resumoLinhas(linhasBlocos)" :legenda="false" larguraRotulo="9rem" />
        </section>
      </div>
    </div>
    <section v-if="correcoes.length > 1" v-revelar class="cartao mt-4" aria-labelledby="titulo-tempo">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-tempo" class="titulo-cartao m-0 flex items-center gap-2"><Clock :size="17" :stroke-width="2.2" class="text-texto-2" aria-hidden="true" />Tempo em cada questão</h2>
        <ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12.5px] text-texto-2" aria-hidden="true">
          <li v-for="p in partes" :key="p.chave" class="flex items-center gap-1.5"><component :is="p.icone" :size="13" :stroke-width="2.4" :class="p.texto" />{{ p.nome }}</li>
        </ul>
      </div>
      <p class="m-0 mt-1 text-[13px] text-texto-2">Em minutos. Passe o mouse numa barra para ver a questão.</p>
      <GraficoBarras class="mt-4" :dados="dadosTempo" :altura="130" :media="mediaTempo" :mostrar-rotulos="correcoes.length <= 30" :descricao="fraseTempo" />
      <p class="m-0 mt-3 text-[13.5px] text-texto-2">{{ fraseTempo }}</p>
    </section>

    <!-- Comentário da IA -->
    <section v-if="respondidas >= 3" v-revelar class="cartao mt-4" aria-labelledby="titulo-comentario">
      <div class="flex flex-wrap items-center gap-2">
        <Sparkles :size="17" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
        <h2 id="titulo-comentario" class="titulo-cartao m-0">Comentário sobre as suas respostas</h2>
        <span class="marca-ia" data-ia="true">usa IA</span>
      </div>
      <TextoRico v-if="comentario" :texto="comentario.texto" tag="p" class="m-0 mt-3 max-w-[760px] text-[16.5px] leading-[1.6]" />
      <p v-else-if="pedindo" class="m-0 mt-3 text-[14.5px] text-texto-2" role="status">Escrevendo o comentário. Leva de 5 a 20 segundos; o resto da página já está pronto.</p>
      <p v-else-if="falhaComentario" class="m-0 mt-3 text-[14.5px]" role="status">{{ falhaComentario }} <button type="button" class="link cursor-pointer border-0 bg-transparent p-0 text-[14.5px]" @click="pedirComentario">Tentar de novo</button></p>
      <p v-if="comentario" class="m-0 mt-3 text-[12.5px] text-texto-3">Escrito pela IA a partir das suas respostas. Os números desta página são calculados pelo PGC. Conta 1 uso de IA.</p>
    </section>

    <!-- Assuntos antes e depois -->
    <section v-if="(res.assuntos ?? []).length" ref="secaoAssuntos" v-revelar class="cartao mt-4" aria-labelledby="titulo-assuntos">
      <h2 id="titulo-assuntos" class="titulo-cartao m-0">Assuntos, antes e depois</h2>
      <p class="m-0 mt-1 text-[13px] text-texto-2">Quanto você domina cada assunto, de 300 a 800. Círculo vazio: antes. Cheio: agora. Abaixo de 400, o assunto está com dificuldade.</p>
      <div class="mt-3 hidden gap-x-4 text-[11.5px] font-semibold text-texto-3 md:grid md:grid-cols-[minmax(0,200px)_60px_1fr_150px_170px]" aria-hidden="true">
        <span /><span />
        <span class="relative h-4"><span v-for="t in MARCAS" :key="t" class="absolute -translate-x-1/2 tabular-nums" :style="{ left: posicao(t) }">{{ t }}</span></span>
      </div>
      <ul class="m-0 mt-1 list-none p-0">
        <li v-for="a in res.assuntos" :key="a.id" class="grid items-center gap-x-4 gap-y-1 border-t border-borda py-3 text-[14px] md:grid-cols-[minmax(0,200px)_60px_1fr_150px_170px]">
          <b class="truncate">{{ a.nome }}</b>
          <span class="text-texto-2"><Fracao :valor="a.certas" :total="a.total" sem-animacao /></span>
          <span class="relative hidden h-6 md:block" aria-hidden="true">
            <span class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-folha-3" />
            <span class="absolute left-0 top-1/2 h-1.5 w-[20%] -translate-y-1/2 rounded-l-full bg-erro-suave" />
            <span v-for="t in MARCAS.slice(1, -1)" :key="t" class="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-borda-forte" :style="{ left: posicao(t) }" />
            <template v-if="a.antes !== null && a.depois !== null">
              <span class="anda absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-acento" :style="andou ? { left: posicao(Math.min(a.antes, a.depois)), width: `calc(${posicao(Math.max(a.antes, a.depois))} - ${posicao(Math.min(a.antes, a.depois))})` } : { left: posicao(a.antes), width: '0%' }" />
              <span class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-acento bg-folha" :style="{ left: posicao(a.antes) }" />
            </template>
            <span v-if="a.depois !== null" class="anda absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-acento ring-[3px] ring-folha" :style="{ left: posicao(andou || a.antes === null ? a.depois : a.antes) }" />
          </span>
          <span class="tabular-nums"><template v-if="a.antes !== null">{{ a.antes }} para </template><b>{{ a.depois ?? 'sem dado' }}</b><span v-if="a.antes !== null && a.depois !== null" class="font-semibold" :class="a.depois - a.antes > 0 ? 'text-ok' : a.depois - a.antes < 0 ? 'text-erro' : 'text-texto-2'"> ({{ a.depois - a.antes >= 0 ? '+' : '' }}{{ a.depois - a.antes }})</span></span>
          <span><span v-if="a.marco" class="selo" data-tipo="ok"><CircleCheck :size="13" :stroke-width="2.4" aria-hidden="true" />{{ ESTADOS[a.estadoDepois] ?? a.estadoDepois }}</span><span v-else class="text-texto-2">{{ ESTADOS[a.estadoDepois] ?? a.estadoDepois }}</span></span>
        </li>
      </ul>
    </section>

    <!-- Questões -->
    <section class="mt-9" aria-labelledby="titulo-questoes">
      <h2 id="titulo-questoes" class="titulo-secao m-0">Questões e correções</h2>
      <p class="m-0 mt-0.5 text-[14px] text-texto-2">Toque num número do mapa ou abra uma questão da lista para ver a sua resposta, a certa e a explicação.</p>
      <ResultadoCorrecoes class="mt-4" :correcoes="listaCorrecoes" :blocos="opcoesBloco" />
      <NuxtLink v-if="materiaErrada" :to="`/questoes/gerar?materia=${materiaErrada}&assunto=${assuntosErrados[0]}`" class="link mt-4 inline-flex items-center gap-2 text-[14px]">
        <Sparkles :size="15" :stroke-width="2" aria-hidden="true" />Gerar questões parecidas com as erradas<span class="marca-ia" data-ia="true">usa IA</span>
      </NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.barra-parte {
  transform-origin: left center;
  animation: cresce-x 0.8s var(--ease-saida) backwards;
}
.anda {
  transition: left 1.1s var(--ease-saida), width 1.1s var(--ease-saida);
}
@media (prefers-reduced-motion: reduce) {
  .barra-parte,
  .anda {
    transition: none;
    animation: none;
  }
}
:global(:root.menos-movimento) .barra-parte,
:global(:root.menos-movimento) .anda {
  transition: none;
  animation: none;
}
</style>
