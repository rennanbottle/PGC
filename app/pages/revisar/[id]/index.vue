<script setup>
// Estudo em modo foco: uma questão por vez, em blocos de Revisão e Prática que vão em sequência. Barra de
// progresso por bloco, cronômetro (do bloco ou por questão), dicas em degraus, marcar para voltar, "marcar como
// incerta", mapa do bloco e formulário ao lado. Cada resposta vai para o servidor, que corrige e guarda.
// Entre um bloco e outro aparece a passagem: o que terminou (sem nota, se a correção for depois) e o que vem.
// Sair pergunta antes: continuar, pausar e sair, ou encerrar. Teclado: 1 a 9 escolhem, Enter confirma,
// D abre dica, M marca, setas mudam de questão.
import { ArrowLeft, ArrowRight, Check, CircleAlert, Clock, Flag, Keyboard, LayoutGrid, Lightbulb, LogOut, Pause, Play, RotateCcw, Sigma, Square, Target } from '@lucide/vue'
import { TIPOS_BLOCO } from '#shared/regras/conjuntos.js'
import { nomeDoNivel } from '#shared/regras/questoes.js'
import { formulaValida } from '#shared/regras/matematica.js'

definePageMeta({ layout: 'foco' })
const route = useRoute()
const id = String(route.params.id)
const api = useRevisoes()
const { data, error } = await useFetch(`/api/revisoes/${id}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage ?? 'Não deu para abrir o estudo.', fatal: true })
if (data.value?.revisao?.status === 'concluida') await navigateTo(`/revisar/${id}/resultado`, { replace: true })
useHead({ title: () => `${data.value?.revisao?.titulo?.split(',')[0] ?? 'Estudo'} | PGC` })

const revisao = computed(() => data.value?.revisao ?? {})
const blocos = computed(() => revisao.value.blocos ?? [])
const itens = ref(data.value?.itens ?? [])
const assuntos = computed(() => data.value?.assuntos ?? {})
const formulario = computed(() => data.value?.formulario ?? [])
// Uma questão sem resposta enviada pode voltar com o rascunho guardado na pausa (não foi corrigido).
const respostas = reactive({})
const incertas = reactive({})
const revelar = reactive({})
function lerItens(lista) {
  for (const i of lista) {
    if (!(i.id in respostas)) respostas[i.id] = i.resposta ?? i.rascunho?.resposta ?? {}
    if (!(i.id in incertas)) incertas[i.id] = !!(i.incerta || i.rascunho?.incerta)
    if (!revelar[i.id]) revelar[i.id] = i.revelar ?? null
  }
}
lerItens(itens.value)

// ---------- Blocos ----------
const doBloco = (k) => itens.value.filter((i) => (i.bloco ?? 0) === k)
const blocoCompleto = (k) => {
  const l = doBloco(k)
  return !!blocos.value[k]?.esgotado || (l.length > 0 && l.every((i) => i.respondida))
}
// Próximo bloco que ainda tem o que fazer (montado e com questão aberta, ou ainda não montado).
function proximoBlocoDepois(k) {
  for (let j = k + 1; j < blocos.value.length; j++) {
    const b = blocos.value[j]
    if (b.pulado) continue
    if (!b.preparado || !blocoCompleto(j)) return j
  }
  return null
}
function blocoInicial() {
  for (let k = 0; k < blocos.value.length; k++) {
    if (blocos.value[k].pulado) continue
    if (!blocos.value[k].preparado || !blocoCompleto(k)) return k
  }
  return Math.max(0, blocos.value.length - 1)
}
const blocoVisto = ref(blocoInicial())
// "entre": a passagem para o bloco seguinte. Abre quando o bloco visto termina e ainda há outro.
const entre = ref(false)
if (blocos.value[blocoVisto.value] && !blocos.value[blocoVisto.value].preparado) {
  let j = blocoVisto.value - 1
  while (j >= 0 && blocos.value[j].pulado) j--
  if (j >= 0) {
    entre.value = true
    blocoVisto.value = j
  }
}

const itensDoBloco = computed(() => doBloco(blocoVisto.value))
const inicioDoBloco = computed(() => itens.value.findIndex((i) => (i.bloco ?? 0) === blocoVisto.value))
const primeiraAbertaDoBloco = () => {
  const k = itens.value.findIndex((i) => (i.bloco ?? 0) === blocoVisto.value && !i.respondida)
  return k >= 0 ? k : Math.max(0, inicioDoBloco.value)
}
const salvoAtual = revisao.value.atual ?? 0
const atual = ref((itens.value[salvoAtual]?.bloco ?? 0) === blocoVisto.value && !itens.value[salvoAtual]?.respondida ? salvoAtual : primeiraAbertaDoBloco())
const item = computed(() => itens.value[atual.value])
const cfg = computed(() => blocos.value[item.value?.bloco ?? blocoVisto.value]?.config ?? {})
const respondidas = computed(() => itens.value.filter((i) => i.respondida).length)
const totalPlanejado = computed(() => blocos.value.reduce((s, b) => s + (b.pulado ? 0 : b.preparado ? doBloco(blocos.value.indexOf(b)).length : b.quantidade ?? 0), 0) || itens.value.length)
const marcadasNoBloco = computed(() => itensDoBloco.value.filter((i) => i.marcada).length)
const respondidasNoBloco = computed(() => itensDoBloco.value.filter((i) => i.respondida).length)
const mostraCorrecao = computed(() => !!item.value?.correcao)
const travada = computed(() => !!item.value?.respondida || !!blocos.value[item.value?.bloco ?? 0]?.esgotado)
const variosBlocos = computed(() => blocos.value.filter((b) => !b.pulado).length > 1)
const proximo = computed(() => proximoBlocoDepois(blocoVisto.value))
const ultimoBloco = computed(() => proximo.value === null)
const tudoRespondido = computed(() => blocoCompleto(blocoVisto.value) && ultimoBloco.value)

// Faixas da barra de progresso: uma por bloco (os ainda não montados aparecem com o tamanho planejado).
const faixas = computed(() => blocos.value.map((b, k) => ({ k, b })).filter(({ b }) => !b.pulado).map(({ k, b }) => {
  const l = doBloco(k)
  const n = b.preparado ? l.length : b.quantidade ?? 0
  return { k, tipo: b.tipo ?? 'revisao', nome: b.nome, segmentos: b.preparado ? l.map((it) => ({ it })) : Array.from({ length: n }, () => ({ it: null })) }
}))

// ---------- Tempo ----------
const agora = ref(Date.now())
let inicioItem = Date.now()
let relogio = null
onMounted(() => {
  relogio = setInterval(() => {
    agora.value = Date.now()
    verificarTempo()
  }, 1000)
})
onBeforeUnmount(() => clearInterval(relogio))
watch(atual, (k) => {
  inicioItem = Date.now()
  api.estado(id, { acao: 'atual', ordem: k }).catch(() => {})
})
const segundosDoItem = () => Math.round((Date.now() - inicioItem) / 1000)
const tempoDoBloco = computed(() => itensDoBloco.value.reduce((s, i) => s + (i.segundos ?? 0), 0))
const crono = computed(() => {
  const c = cfg.value.cronometro
  if (!c || c.modo === 'sem' || entre.value || blocos.value[blocoVisto.value]?.esgotado) return null
  const noItem = item.value?.respondida ? 0 : Math.max(0, Math.round((agora.value - inicioItem) / 1000))
  // Tempo que a questão aberta já tinha antes de uma pausa: o cronômetro continua de onde parou.
  const antes = item.value?.respondida ? 0 : item.value?.segundos ?? 0
  const resta = c.modo === 'sessao' ? c.minutos * 60 - tempoDoBloco.value - noItem : c.segundos - antes - noItem
  return Math.max(0, resta)
})
const relogioTexto = computed(() => (crono.value === null ? '' : `${String(Math.floor(crono.value / 60)).padStart(2, '0')}:${String(crono.value % 60).padStart(2, '0')}`))
// Conferido a cada segundo (e não só quando o número muda): se o tempo zerar enquanto uma resposta está sendo
// enviada, a próxima volta do relógio trata.
let tentativasTempo = 0
function verificarTempo() {
  if (crono.value !== 0 || ocupado.value || entre.value) return
  if (cfg.value.cronometro?.modo === 'sessao') {
    if (tentativasTempo < 3) tempoDoBlocoAcabou()
  }
  else if (!travada.value) confirmar(true)
}

// ---------- Responder ----------
const ocupado = ref(false)
const erro = ref('')
const salvo = ref(false)
function preenchida(it) {
  const r = respostas[it.id] ?? {}
  switch (it.tipo) {
    case 'multipla_resposta': return (r.marcadas ?? []).length > 0
    case 'verdadeiro_falso': case 'certo_errado': return r.valor === true || r.valor === false
    case 'assercao_razao': return !!r.opcao
    case 'lacuna_digitada': return (r.textos ?? []).some((t) => String(t ?? '').trim())
    case 'lacuna_opcoes': return (r.escolhas ?? []).some((t) => t !== undefined && t !== null)
    case 'associar': return Object.values(r.ligacoes ?? {}).some((v) => v !== '')
    case 'ordenar': return true
    case 'classificar': return Object.keys(r.grupos ?? {}).length > 0
    case 'numerica': return String(r.valor ?? '').trim() !== '' || (r.valores ?? []).some((v) => String(v ?? '').trim() !== '')
    case 'encontrar_erro': return r.linha !== undefined
    case 'cartao': return revelar[it.id] ? !!r.autoavaliacao : String(r.texto ?? '').trim() !== ''
    case 'resposta_curta': case 'explicar': return revelar[it.id] ? true : String(r.texto ?? '').trim() !== ''
    default: return r.escolha !== undefined
  }
}
const rotuloBotao = computed(() => {
  if (!item.value) return ''
  if (mostraCorrecao.value || travada.value) {
    if (!blocoCompleto(blocoVisto.value)) return 'Próxima'
    return ultimoBloco.value ? 'Ver resultado' : 'Continuar'
  }
  if (item.value.tipo === 'cartao' && !revelar[item.value.id]) return 'Virar o cartão'
  if (['resposta_curta', 'explicar'].includes(item.value.tipo) && !revelar[item.value.id]) return 'Ver a resposta esperada'
  return 'Confirmar'
})
function marcarSalvo() {
  salvo.value = true
}
// Recarrega do servidor (correção do bloco liberada, bloco novo montado) sem perder o que está na tela.
async function recarregar() {
  const novo = await api.carregar(id)
  data.value = novo
  itens.value = novo.itens
  lerItens(novo.itens)
}
async function confirmar(porTempo = false) {
  const it = item.value
  if (!it || ocupado.value) return
  if (travada.value) return proxima()
  if (!porTempo && !preenchida(it)) {
    erro.value = 'Responda antes de confirmar, ou marque para voltar depois.'
    return
  }
  erro.value = ''
  ocupado.value = true
  try {
    let resposta = respostas[it.id] ?? {}
    if (['resposta_curta', 'explicar'].includes(it.tipo) && revelar[it.id] && !Array.isArray(resposta.pontos)) resposta = { ...resposta, pontos: (revelar[it.id].pontos ?? []).map(() => false) }
    const seg = segundosDoItem()
    const r = await api.responder(id, { itemId: it.id, resposta, incerta: incertas[it.id], segundos: seg })
    inicioItem = Date.now()
    if (r.pendente) {
      revelar[it.id] = r.revelar
      it.pendente = true
    }
    else {
      const k = itens.value.findIndex((i) => i.id === it.id)
      if (k >= 0) itens.value[k] = { ...r.item, resposta }
      if (r.blocoCompleto) await recarregar()
      if (r.item.correcao?.resultado === 'incorreta') api.estado(id, { acao: 'leu', itemId: it.id }).catch(() => {})
      if (r.blocoCompleto) {
        const j = itens.value.findIndex((i) => i.id === it.id)
        if (j >= 0) atual.value = j
      }
      else if (!r.item.correcao) proxima()
      else if (cfg.value.avancar && r.item.correcao.resultado === 'correta') {
        const daQuestao = it.id
        clearTimeout(avanco)
        avanco = setTimeout(() => {
          if (item.value?.id === daQuestao && !entre.value) proxima()
        }, 1400)
      }
    }
    marcarSalvo()
  }
  catch (e) {
    erro.value = e.message
  }
  ocupado.value = false
}
let avanco = null
function proxima() {
  clearTimeout(avanco)
  if (blocoCompleto(blocoVisto.value)) {
    if (ultimoBloco.value) return finalizar()
    entre.value = true
    return
  }
  const lista = itensDoBloco.value
  const pos = lista.findIndex((i) => i.id === item.value?.id)
  for (let k = 1; k <= lista.length; k++) {
    const alvo = lista[(pos + k) % lista.length]
    if (!alvo.respondida) {
      atual.value = itens.value.indexOf(alvo)
      return
    }
  }
}
function ir(k) {
  if (ocupado.value) return
  const alvo = itensDoBloco.value[k]
  if (alvo) atual.value = itens.value.indexOf(alvo)
}
function irRelativo(passo) {
  const lista = itensDoBloco.value
  const pos = lista.findIndex((i) => i.id === item.value?.id)
  ir(pos + passo)
}

async function abrirDica() {
  const it = item.value
  if (!it || travada.value || it.dicasUsadas >= it.dicasPermitidas || ocupado.value) return
  ocupado.value = true
  try {
    const r = await api.dica(id, it.id)
    it.dicas = r.dicas
    it.dicasUsadas = r.dicasUsadas
    marcarSalvo()
  }
  catch (e) {
    erro.value = e.message
  }
  ocupado.value = false
}
async function alternarMarca() {
  const it = item.value
  if (!it) return
  it.marcada = !it.marcada
  api.estado(id, { acao: 'marcar', itemId: it.id, valor: it.marcada }).then(marcarSalvo).catch((e) => (erro.value = e.message))
}

// ---------- Passagem entre blocos ----------
const fimDoBloco = computed(() => {
  const l = itensDoBloco.value
  const seg = l.reduce((s, i) => s + (i.segundos ?? 0), 0)
  return {
    respondidas: l.filter((i) => i.respondida).length,
    total: l.length,
    incertas: l.filter((i) => i.respondida && incertas[i.id]).length,
    tempo: seg >= 60 ? `${Math.floor(seg / 60)} min${seg % 60 ? ` ${seg % 60} s` : ''}` : `${seg} s`,
    correcao: blocos.value[blocoVisto.value]?.config?.correcao ?? 'cada',
    esgotado: !!blocos.value[blocoVisto.value]?.esgotado,
  }
})
const blocoSeguinte = computed(() => (proximo.value === null ? null : { k: proximo.value, ...blocos.value[proximo.value] }))
const linhasSeguinte = computed(() => {
  const b = blocoSeguinte.value
  if (!b) return []
  const c = b.config ?? {}
  const nomes = (b.assuntos ?? []).map((a) => assuntos.value[a]?.nome).filter(Boolean)
  const d = c.dificuldade ?? {}
  const nivel = d.modo === 'fixa' ? `no ${nomeDoNivel(d.nivel)}` : d.modo === 'curva' ? `do ${nomeDoNivel(Math.min(d.de, d.ate))} ao ${nomeDoNivel(Math.max(d.de, d.ate))}` : 'em níveis variados'
  const qual = c.origem === 'erros_conjunto' ? 'que você errou até aqui (se forem poucas, erradas dos últimos 14 dias)' : b.tipo === 'pratica' ? 'que você ainda não respondeu' : 'que você já respondeu, vencidas primeiro'
  const n = b.preparado ? doBloco(b.k).length : c.quantidade
  return [
    ['Assuntos', c.origem === 'erros_conjunto' ? 'os dos blocos anteriores' : nomes.length > 4 ? `${nomes.slice(0, 4).join(', ')} e mais ${nomes.length - 4}` : nomes.join(', ').replace(/, ([^,]*)$/, ' e $1') || 'os do conjunto'],
    ['Questões', `${c.origem === 'erros_conjunto' ? 'até ' : ''}${n} ${qual}, ${nivel}`],
    ['Correção', { cada: 'a cada questão', bloco: 'no fim do bloco', fim: 'no fim do estudo' }[c.correcao] ?? 'a cada questão'],
    ['Dicas', c.dicas ? 'conforme o nível' : 'desligadas'],
    ['Fórmulas', c.formulario === false ? 'escondidas' : 'ao lado da questão'],
    ['Cronômetro', c.cronometro?.modo === 'sessao' ? `${c.cronometro.minutos} min para o bloco` : c.cronometro?.modo === 'questao' ? `${c.cronometro.segundos} s por questão` : 'sem'],
  ]
})
const depoisDoSeguinte = computed(() => {
  if (!blocoSeguinte.value) return ''
  const j = proximoBlocoDepois(blocoSeguinte.value.k)
  if (j === null) return 'É o último bloco.'
  const b = blocos.value[j]
  return `Depois dele, ${b.preparado ? doBloco(j).length : b.config?.quantidade ?? b.quantidade} questões de ${TIPOS_BLOCO[b.tipo ?? 'revisao'].nome}${b.config?.origem === 'erros_conjunto' ? ' com as que você errar até lá' : ''}.`
})
function verCorrecaoDoBloco() {
  entre.value = false
  atual.value = Math.max(0, inicioDoBloco.value)
}
async function comecarProximo(esgotou = false) {
  const b = blocoSeguinte.value
  if (!b || ocupado.value) return
  ocupado.value = true
  erro.value = ''
  try {
    const aberta = item.value && !item.value.respondida
    const r = await api.proximoBloco(id, b.k, esgotou ? { esgotou: true, itemId: aberta ? item.value.id : undefined, segundos: aberta ? segundosDoItem() : 0 } : {})
    await recarregar()
    if (r.fim) {
      ocupado.value = false
      return finalizar()
    }
    blocoVisto.value = r.bloco
    entre.value = false
    atual.value = primeiraAbertaDoBloco()
    inicioItem = Date.now()
  }
  catch (e) {
    erro.value = e.message
  }
  ocupado.value = false
}
// Cronômetro do bloco chegou a zero: se houver outro bloco, a passagem abre (as que ficaram sem resposta ficam em
// branco); se for o último, o estudo termina.
async function tempoDoBlocoAcabou() {
  if (ultimoBloco.value) return encerrar(true)
  ocupado.value = true
  try {
    const b = blocoSeguinte.value
    const aberta = item.value && !item.value.respondida
    let r = null
    try {
      r = await api.estado(id, { acao: 'bloco', bloco: b.k, esgotou: true, itemId: aberta ? item.value.id : undefined, segundos: aberta ? segundosDoItem() : 0 })
    }
    catch (e) {
      // Fica no bloco; o relógio tenta de novo (até 3 vezes) e depois deixa a mensagem.
      tentativasTempo += 1
      erro.value = tentativasTempo >= 3 ? `${e.message} Use Sair para pausar ou encerrar.` : e.message
      return
    }
    tentativasTempo = 0
    await recarregar()
    if (r?.fim) {
      ocupado.value = false
      return finalizar()
    }
    entre.value = true
  }
  finally {
    ocupado.value = false
  }
}

// ---------- Terminar e sair ----------
const liberado = ref(false)
const janelaSair = ref(null)
const janelaApoio = ref(null)
let destino = '/revisar'
let finalizando = false
async function finalizar() {
  if (finalizando) return
  finalizando = true
  ocupado.value = true
  try {
    await api.concluir(id, false)
    liberado.value = true
    await navigateTo(`/revisar/${id}/resultado`)
  }
  catch (e) {
    erro.value = e.message
    finalizando = false
  }
  ocupado.value = false
}
async function encerrar(porTempo = false) {
  ocupado.value = true
  try {
    await api.concluir(id, true)
    liberado.value = true
    janelaSair.value?.fechar()
    await navigateTo(`/revisar/${id}/resultado${porTempo ? '?tempo=1' : ''}`)
  }
  catch (e) {
    erro.value = e.message
  }
  ocupado.value = false
}
// Pausa guarda o rascunho das questões ainda não enviadas e o tempo da questão aberta. Rascunho não é corrigido.
function rascunhos() {
  const r = {}
  for (const it of itens.value) {
    if (it.respondida || it.pendente) continue
    const resposta = respostas[it.id] ?? {}
    if (Object.keys(resposta).length || incertas[it.id]) r[it.id] = { resposta, incerta: !!incertas[it.id] }
  }
  return r
}
async function pausar() {
  try {
    const aberta = !entre.value && item.value && !item.value.respondida && !item.value.pendente
    await api.estado(id, { acao: 'pausar', rascunhos: rascunhos(), itemId: aberta ? item.value.id : undefined, segundos: aberta ? segundosDoItem() : 0 })
    refreshNuxtData(['estudo-resumo', 'revisoes-lista'])
  }
  catch {}
  liberado.value = true
  janelaSair.value?.fechar()
  await navigateTo(destino)
}
onBeforeRouteLeave((to) => {
  if (liberado.value) return true
  destino = to.fullPath
  janelaSair.value?.abrir()
  return false
})
function antesDeFechar(e) {
  if (liberado.value) return
  e.preventDefault()
  e.returnValue = ''
}

// ---------- Teclado ----------
const questao = ref(null)
function tecla(e) {
  const alvo = e.target
  if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) {
    if (e.key === 'Enter' && alvo.tagName === 'INPUT') {
      e.preventDefault()
      confirmar()
    }
    return
  }
  if (document.querySelector('dialog[open]')) return
  if (entre.value) {
    if (e.key === 'Enter') {
      e.preventDefault()
      comecarProximo()
    }
    return
  }
  if (/^[1-9]$/.test(e.key) && !travada.value) questao.value?.escolher(Number(e.key) - 1)
  else if (e.key === 'Enter') {
    e.preventDefault()
    confirmar()
  }
  else if (e.key.toLowerCase() === 'd') abrirDica()
  else if (e.key.toLowerCase() === 'm') alternarMarca()
  else if (e.key === 'ArrowRight') irRelativo(1)
  else if (e.key === 'ArrowLeft') irRelativo(-1)
}
onMounted(() => {
  window.addEventListener('keydown', tecla)
  window.addEventListener('beforeunload', antesDeFechar)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', tecla)
  window.removeEventListener('beforeunload', antesDeFechar)
})

// Fórmulas aprovadas na conferência, sem as que saíram quebradas da leitura do PDF ("=- 2a b").
const formulasDoAssunto = computed(() => {
  const boas = formulario.value.filter((f) => formulaValida(f.formula))
  const doAtual = boas.filter((f) => f.assuntoId === item.value?.assuntoId)
  return doAtual.length ? doAtual : boas
})
// Quantas opções as teclas 1 a 9 alcançam na questão aberta (para mostrar o atalho certo).
const nOpcoes = computed(() => {
  const q = item.value?.questao ?? {}
  if (q.alternativas?.length) return q.alternativas.length
  if (['verdadeiro_falso', 'certo_errado'].includes(q.tipo)) return 2
  return q.opcoes?.length ?? q.linhas?.length ?? 0
})
// Progresso de cada faixa: respondidas do bloco sobre o tamanho planejado.
const feitoNaFaixa = (f) => f.segmentos.filter((sg) => sg.it?.respondida).length
const posNoBloco = computed(() => itensDoBloco.value.findIndex((i) => i.id === item.value?.id))
</script>

<template>
  <div v-if="item" class="pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-14">
    <!-- Barra do modo foco: título, progresso fino com a contagem, cronômetro, salvo e sair -->
    <header class="sticky top-0 z-10 border-b border-borda bg-folha">
      <div class="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-8">
        <span class="hidden min-w-0 max-w-[230px] lg:block">
          <b class="block truncate text-[14.5px]">{{ revisao.titulo?.split(',')[0] }}</b>
          <span class="block truncate text-[12.5px] text-texto-2">{{ revisao.titulo?.split(',').slice(1).join(',').trim() }}</span>
        </span>
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div class="flex min-w-0 flex-1 items-start gap-1.5" role="progressbar" :aria-valuenow="respondidas" aria-valuemin="0" :aria-valuemax="totalPlanejado" :aria-label="`Respondidas: ${respondidas} de ${totalPlanejado}`">
            <span v-for="f in faixas" :key="f.k" class="flex min-w-0 flex-col gap-1" :style="{ flex: Math.max(1, f.segmentos.length) }">
              <span class="barra fina" :class="f.k === blocoVisto && 'atual'"><i :style="{ width: `${(feitoNaFaixa(f) / Math.max(1, f.segmentos.length)) * 100}%` }" /></span>
              <span v-if="variosBlocos" class="hidden items-center gap-1 truncate text-[11.5px] sm:flex" :class="f.k === blocoVisto ? 'font-semibold text-tinta' : 'text-texto-3'">
                <Target v-if="f.tipo === 'pratica'" :size="12" :stroke-width="2.2" aria-hidden="true" /><RotateCcw v-else :size="12" :stroke-width="2.2" aria-hidden="true" />{{ TIPOS_BLOCO[f.tipo].nome }}
              </span>
            </span>
          </div>
          <b class="shrink-0 text-[15px]"><Fracao :valor="respondidas" :total="totalPlanejado" /></b>
        </div>
        <span v-if="crono !== null" class="flex shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[14px] font-semibold tabular-nums" :class="crono <= 60 ? 'bg-aviso-suave text-aviso' : 'bg-folha-2'" role="timer" :aria-label="`Tempo restante ${relogioTexto}`">
          <Clock :size="15" :stroke-width="2" aria-hidden="true" />{{ relogioTexto }}
        </span>
        <span class="hidden w-14 text-[12.5px] text-texto-3 sm:block" role="status">
          <Transition name="desliza"><span v-if="salvo" :key="respondidas" class="flex items-center gap-1"><Check :size="13" :stroke-width="2.4" aria-hidden="true" />Salvo</span></Transition>
        </span>
        <button type="button" class="botao-secundario botao-p shrink-0 gap-1.5" @click="janelaSair?.abrir()"><LogOut :size="15" :stroke-width="2" aria-hidden="true" />Sair</button>
      </div>
    </header>

    <!-- Passagem entre blocos -->
    <div v-if="entre" class="mx-auto max-w-[660px] px-4 py-10 sm:px-8 sm:py-14">
      <div class="entra flex items-center gap-4" style="--i: 0">
        <GuiaPersonagem humor="feliz" :tamanho="64" />
        <div class="min-w-0">
          <p class="selo" data-tipo="ok"><Check :size="13" :stroke-width="2.6" aria-hidden="true" />Bloco {{ faixas.findIndex((f) => f.k === blocoVisto) + 1 }} terminado</p>
          <p class="m-0 mt-2 text-[15.5px]">
            {{ TIPOS_BLOCO[blocos[blocoVisto]?.tipo ?? 'revisao'].nome }}, {{ blocos[blocoVisto]?.nome }}: <b><Fracao :valor="fimDoBloco.respondidas" :total="fimDoBloco.total" sem-animacao /> respondidas</b> em {{ fimDoBloco.tempo }}<template v-if="fimDoBloco.incertas">, {{ fimDoBloco.incertas }} {{ fimDoBloco.incertas === 1 ? 'marcada como incerta' : 'marcadas como incertas' }}</template>.
          </p>
        </div>
      </div>
      <p class="entra m-0 mt-3 text-[14px] text-texto-2" style="--i: 1">
        <template v-if="fimDoBloco.esgotado">O tempo do bloco acabou; as que ficaram sem resposta contam como em branco. </template>
        <template v-if="fimDoBloco.correcao === 'fim'">A correção deste bloco aparece no fim, como você escolheu.</template>
        <template v-else-if="fimDoBloco.correcao === 'bloco'">A correção deste bloco está pronta. <button type="button" class="link cursor-pointer border-0 bg-transparent p-0 text-[14px]" @click="verCorrecaoDoBloco">Ver a correção</button></template>
        <template v-else>Você já viu a correção de cada questão. <button type="button" class="link cursor-pointer border-0 bg-transparent p-0 text-[14px]" @click="verCorrecaoDoBloco">Rever</button></template>
      </p>
      <p v-if="erro" class="erro-campo treme" role="alert"><CircleAlert :size="16" :stroke-width="2.2" aria-hidden="true" />{{ erro }}</p>
      <section v-if="blocoSeguinte" class="cartao entra mt-8" style="--i: 2" aria-labelledby="titulo-seguinte">
        <p class="m-0 flex items-center gap-2 text-[13.5px] font-semibold text-texto-2">
          <Target v-if="blocoSeguinte.tipo === 'pratica'" :size="16" :stroke-width="2.1" aria-hidden="true" /><RotateCcw v-else :size="16" :stroke-width="2.1" aria-hidden="true" />
          {{ TIPOS_BLOCO[blocoSeguinte.tipo ?? 'revisao'].nome }}, bloco <Fracao :valor="faixas.findIndex((f) => f.k === blocoSeguinte.k) + 1" :total="faixas.length" sem-animacao />
        </p>
        <h1 id="titulo-seguinte" class="titulo-pagina m-0 mt-2">{{ blocoSeguinte.nome }}</h1>
        <dl class="m-0 mt-4">
          <div v-for="[a, v] in linhasSeguinte" :key="a" class="grid gap-x-4 border-t border-borda py-2 text-[14.5px] sm:grid-cols-[120px_1fr]"><dt class="text-texto-2">{{ a }}</dt><dd class="m-0">{{ v }}</dd></div>
        </dl>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" class="botao botao-g" :aria-busy="ocupado" :disabled="ocupado" aria-keyshortcuts="Enter" @click="comecarProximo()">
            <Play :size="17" :stroke-width="2.2" aria-hidden="true" />{{ ocupado ? 'Montando' : `Começar o bloco ${faixas.findIndex((f) => f.k === blocoSeguinte.k) + 1}` }}<kbd class="tecla no-botao">Enter</kbd>
          </button>
          <button type="button" class="botao-secundario botao-g" @click="pausar"><Pause :size="17" :stroke-width="2.2" aria-hidden="true" />Pausar e sair</button>
        </div>
        <p class="m-0 mt-3 text-[13px] text-texto-2">{{ depoisDoSeguinte }}</p>
      </section>
    </div>

    <div v-else class="mx-auto grid max-w-[1180px] items-start gap-10 px-4 pt-6 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_250px]">
      <div class="mx-auto w-full min-w-0 max-w-[780px]">
        <SessaoQuestao :key="item.id" ref="questao" v-model="respostas[item.id]" :item="item" :numero="posNoBloco + 1" :assunto="assuntos[item.assuntoId]" :revelar="revelar[item.id]" :travada="travada" />
        <p v-if="erro" :key="erro" class="erro-campo treme mt-4" role="alert"><CircleAlert :size="16" :stroke-width="2.2" aria-hidden="true" />{{ erro }}</p>

        <label v-if="!travada" class="linha-opcao mt-4 w-fit items-center py-2 pr-3 text-[14.5px]">
          <input v-model="incertas[item.id]" type="checkbox" class="marcar">Não tenho certeza desta
        </label>

        <!-- Ações (computador) -->
        <div class="mt-5 hidden flex-wrap items-center gap-2.5 border-t border-borda pt-5 lg:flex">
          <template v-if="!travada">
            <button v-if="item.dicasPermitidas" type="button" class="botao-secundario gap-2" :disabled="item.dicasUsadas >= item.dicasPermitidas || ocupado" aria-keyshortcuts="D" data-dica="Cada dica tira 25% dos pontos desta questão" @click="abrirDica">
              <Lightbulb :size="16" :stroke-width="2" aria-hidden="true" />{{ item.dicasUsadas ? 'Outra dica' : 'Dica' }}
              <span class="text-[12.5px] font-normal text-texto-3"><Fracao :valor="item.dicasUsadas" :total="item.dicasPermitidas" sem-animacao /></span>
            </button>
            <button type="button" class="botao-secundario gap-2" :class="item.marcada && 'marcada'" :aria-pressed="item.marcada" aria-keyshortcuts="M" @click="alternarMarca">
              <Flag :size="16" :stroke-width="2" aria-hidden="true" />{{ item.marcada ? 'Marcada para voltar' : 'Marcar para voltar' }}
            </button>
          </template>
          <button type="button" class="botao ml-auto min-w-[180px] gap-2" :aria-busy="ocupado" :disabled="ocupado" aria-keyshortcuts="Enter" @click="confirmar()">
            <span v-if="ocupado" class="rodando" aria-hidden="true" />{{ rotuloBotao }}<kbd class="tecla no-botao">Enter</kbd>
          </button>
        </div>
      </div>

      <aside class="sticky top-[88px] hidden flex-col gap-5 lg:flex" aria-label="Mapa e apoio">
        <section>
          <h2 class="m-0 mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-texto-2"><LayoutGrid :size="15" :stroke-width="2" aria-hidden="true" />Questões do bloco</h2>
          <SessaoMapa :itens="itensDoBloco" :atual="posNoBloco" @ir="ir" />
        </section>
        <section v-if="cfg.formulario !== false && formulasDoAssunto.length" class="border-t border-borda pt-4">
          <h2 class="m-0 flex items-center gap-2 text-[13px] font-semibold text-texto-2"><Sigma :size="15" :stroke-width="2" aria-hidden="true" />Fórmulas</h2>
          <ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-[15.5px]">
            <li v-for="(f, i) in formulasDoAssunto" :key="i"><TextoRico :texto="`$${f.formula}$`" tag="span" /></li>
          </ul>
        </section>
        <section class="border-t border-borda pt-4" aria-labelledby="titulo-atalhos">
          <h2 id="titulo-atalhos" class="m-0 flex items-center gap-2 text-[13px] font-semibold text-texto-2"><Keyboard :size="15" :stroke-width="2" aria-hidden="true" />Atalhos</h2>
          <dl class="m-0 mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[13px] text-texto-2">
            <template v-if="nOpcoes && !travada"><dt class="flex gap-1"><kbd class="tecla">1</kbd><kbd class="tecla">{{ Math.min(9, nOpcoes) }}</kbd></dt><dd class="m-0">escolhem a opção</dd></template>
            <dt><kbd class="tecla">Enter</kbd></dt><dd class="m-0">{{ travada ? 'vai para a próxima' : 'confirma' }}</dd>
            <template v-if="item.dicasPermitidas && !travada"><dt><kbd class="tecla">D</kbd></dt><dd class="m-0">abre uma dica</dd></template>
            <dt><kbd class="tecla">M</kbd></dt><dd class="m-0">marca para voltar</dd>
            <dt class="flex gap-1"><kbd class="tecla"><ArrowLeft :size="12" :stroke-width="2.4" aria-label="seta para a esquerda" /></kbd><kbd class="tecla"><ArrowRight :size="12" :stroke-width="2.4" aria-label="seta para a direita" /></kbd></dt><dd class="m-0">mudam de questão</dd>
          </dl>
        </section>
      </aside>
    </div>

    <!-- Ações (celular): presas embaixo; a página tem espaço no fim para nada ficar coberto -->
    <div v-if="!entre" class="fixed inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t border-borda bg-folha px-3 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] lg:hidden">
      <template v-if="!travada">
        <button v-if="item.dicasPermitidas" type="button" class="acao-celular" :disabled="item.dicasUsadas >= item.dicasPermitidas || ocupado" @click="abrirDica"><Lightbulb :size="18" :stroke-width="2" aria-hidden="true" />Dica</button>
        <button type="button" class="acao-celular" :class="item.marcada && 'marcada'" :aria-pressed="item.marcada" @click="alternarMarca"><Flag :size="18" :stroke-width="2" aria-hidden="true" />Marcar</button>
      </template>
      <button type="button" class="acao-celular" aria-haspopup="dialog" @click="janelaApoio?.abrir()"><LayoutGrid :size="18" :stroke-width="2" aria-hidden="true" />Mapa</button>
      <button type="button" class="botao h-12 flex-1 px-3" :aria-busy="ocupado" :disabled="ocupado" @click="confirmar()">{{ rotuloBotao }}</button>
    </div>

    <JanelaBase ref="janelaApoio" titulo="Questões do bloco">
      <SessaoMapa :itens="itensDoBloco" :atual="posNoBloco" @ir="(k) => { ir(k); janelaApoio?.fechar() }" />
      <ul v-if="formulasDoAssunto.length && cfg.formulario !== false" class="m-0 mt-2 flex list-none flex-col gap-2 border-t border-borda p-0 pt-3 text-[15.5px]">
        <li v-for="(f, i) in formulasDoAssunto" :key="i"><TextoRico :texto="`$${f.formula}$`" tag="span" /></li>
      </ul>
    </JanelaBase>

    <JanelaBase ref="janelaSair" titulo="Sair do estudo?">
      <p class="m-0 text-[14.5px] text-texto-2">Respondidas até agora: <b class="text-tinta"><Fracao :valor="respondidas" :total="totalPlanejado" sem-animacao /></b>. Nada se perde em nenhum dos caminhos.</p>
      <div class="mt-1 flex flex-col gap-2">
        <button type="button" class="cartao-opcao flex items-start gap-3 px-4 py-3 text-left" @click="janelaSair?.fechar()">
          <Play :size="18" :stroke-width="2" class="mt-0.5 shrink-0 text-acento" aria-hidden="true" />
          <span><b class="block text-[15px]">Continuar</b><span class="text-[13.5px] text-texto-2">{{ entre ? 'Volta para a passagem de bloco.' : `Volta para a questão ${posNoBloco + 1}.` }}</span></span>
        </button>
        <button type="button" class="cartao-opcao flex items-start gap-3 px-4 py-3 text-left" @click="pausar">
          <Pause :size="18" :stroke-width="2" class="mt-0.5 shrink-0" aria-hidden="true" />
          <span><b class="block text-[15px]">Pausar e sair</b><span class="text-[13.5px] text-texto-2">Guarda as respostas, o que já está escrito e o tempo. Em Estudar, o botão Continuar volta para cá.</span></span>
        </button>
        <button type="button" class="cartao-opcao flex items-start gap-3 px-4 py-3 text-left" :disabled="ocupado" @click="encerrar()">
          <Square :size="17" :stroke-width="2" class="mt-0.5 shrink-0" aria-hidden="true" />
          <span><b class="block text-[15px]">Encerrar agora</b><span class="text-[13.5px] text-texto-2">{{ respondidas === 1 ? 'A resposta conta' : `As ${respondidas} respostas contam` }} e {{ totalPlanejado - respondidas === 1 ? 'a restante fica' : `as ${totalPlanejado - respondidas} restantes ficam` }} em branco. Abre o resultado.</span></span>
        </button>
      </div>
    </JanelaBase>
  </div>
</template>

<style scoped>
/* Tecla desenhada (atalhos): a borda de baixo mais grossa lembra uma tecla de verdade. */
.tecla {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--borda-campo);
  border-bottom-width: 2px;
  border-radius: 6px;
  background: var(--folha);
  color: var(--texto-2);
  font-family: var(--font-sans);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1;
}
.tecla.no-botao {
  margin-left: 4px;
  border-color: color-mix(in oklab, currentColor 35%, transparent);
  background: transparent;
  color: inherit;
  opacity: 0.85;
}
.barra.atual {
  background: color-mix(in oklab, var(--acento) 16%, var(--folha-3));
}
.botao-secundario.marcada {
  border-color: var(--acento);
  color: var(--acento);
}
.acao-celular {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 58px;
  height: 48px;
  border: 1px solid var(--borda-campo);
  border-radius: 12px;
  background: var(--folha);
  color: var(--tinta);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s var(--ease-saida), border-color 0.15s;
}
.acao-celular:active {
  transform: scale(0.95);
}
.acao-celular:disabled {
  opacity: 0.4;
}
.acao-celular.marcada {
  border-color: var(--acento);
  color: var(--acento);
}
@media (prefers-reduced-motion: reduce) {
  .acao-celular {
    transition: none;
  }
}
:global(:root.menos-movimento) .acao-celular {
  transition: none;
}
</style>
