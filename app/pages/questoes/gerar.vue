<script setup>
// Gerar questões: do que estudar, quem escreve, como ficam, o pedido opcional e, no jeito "Outra IA", os passos
// para levar o pedido a outra IA. O resumo fica fixo ao lado (no celular, numa folha que sobe de baixo).
// A cada mudança o servidor devolve a prévia (técnicas sem IA, plano do misto, pedido completo para outra IA).
// Nada é gravado até o botão.
// Links: ?materia=<id>&assunto=<id>&texto=<id> (também valem ?assuntos=a,b, ?material=<id> e ?modo=local|ia|misto|externa).
import { BookOpen, FileText, MessagesSquare, Pencil, Plus, SlidersHorizontal, Sparkles } from '@lucide/vue'
import { ESTILO, corpoGerar, maxQuantidade, niveisDoPedido, tempoEstimado, tiposDoPedido, tiposPadrao } from '#shared/regras/gerar.js'
import { EXEMPLOS_TIPO, IDS_TIPOS_IA, conferirRespostaColada, contextoDaConferencia, exemploDaQuestao } from '#shared/regras/ia.js'
import { OPCOES_ASSERCAO, nomeDoTipo } from '#shared/regras/questoes.js'

useHead({ title: 'Gerar questões | PGC' })
const route = useRoute()
const ia = useIa()
const { avisar } = useAvisos()
const apiMaterias = useMaterias()
const apiMateriais = useMateriais()
const { data: cota } = useCotaIa()
await Promise.all([apiMaterias.pronto, apiMateriais.pronto])
const materias = computed(() => (apiMaterias.data.value ?? []).filter((m) => !m.arquivada_em))
const materiais = computed(() => apiMateriais.data.value ?? [])

// ---------- Estado da tela (com o que veio no link) ----------
const q = route.query
const uuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
const textoDoLink = materiais.value.find((m) => m.id === (q.texto ?? q.material))
const materiaInicial = (uuid(q.materia) && materias.value.some((m) => m.id === q.materia) && q.materia)
  || (textoDoLink && materias.value.some((m) => m.id === textoDoLink.materia_id) && textoDoLink.materia_id)
  || materias.value[0]?.id
  || ''
const daMateriaInicial = materias.value.find((m) => m.id === materiaInicial)
const assuntosDoLink = [...(typeof q.assunto === 'string' ? [q.assunto] : []), ...(typeof q.assuntos === 'string' ? q.assuntos.split(',') : [])]
  .filter((a) => uuid(a) && (daMateriaInicial?.assuntos ?? []).some((x) => x.id === a))
const modoDoLink = String(q.modo ?? '')
const estado = reactive({
  // Semente da tabela do gabarito em código (Outra IA): muda a cada vez que a página abre.
  semente: Math.random().toString(36).slice(2, 12).padEnd(8, '0'),
  materiaId: materiaInicial,
  assuntoIds: [...new Set(assuntosDoLink)].slice(0, 20),
  textos: textoDoLink && textoDoLink.materia_id === materiaInicial && textoDoLink.paginasConferidas > 0 ? [textoDoLink.id] : [],
  modo: ['local', 'externa'].includes(modoDoLink) ? modoDoLink : 'ia',
  aproveitarTexto: modoDoLink === 'misto',
  quantidade: 10,
  dificuldade: { modo: 'uma', nivel: 2, contas: { 1: 2, 2: 5, 3: 3 } },
  estilo: 'livre',
  tipos: tiposPadrao(daMateriaInicial?.area),
  tecnicas: [],
  instrucoes: '',
})
if (estado.modo === 'local' && !estado.textos.length) estado.modo = 'ia'

const materia = computed(() => materias.value.find((m) => m.id === estado.materiaId) ?? null)
const tocouTipos = ref(false)
watch(() => estado.materiaId, () => {
  estado.assuntoIds = []
  estado.textos = []
  if (!tocouTipos.value) estado.tipos = tiposPadrao(materia.value?.area)
})
const modo = computed(() => corpoGerar(estado).modo)
const maximo = computed(() => maxQuantidade(modo.value))
watch(maximo, (m) => {
  if (estado.quantidade > m) estado.quantidade = m
})
watch(() => estado.textos.length, (n) => {
  if (!n && estado.modo === 'local') estado.modo = 'ia'
})
const semCota = computed(() => (cota.value?.usadas ?? 0) >= (cota.value?.limite ?? 30))
watch(semCota, (sem) => {
  if (sem && estado.modo === 'ia') estado.modo = estado.textos.length ? 'local' : 'externa'
}, { immediate: true })

// ---------- Prévia (servidor) ----------
const previa = ref(null)
const carregando = ref(false)
const erroPrevia = ref('')
const tiposIa = computed(() => IDS_TIPOS_IA.filter((t) => estado.tipos.includes(t)))
const completo = computed(() => !!estado.materiaId && (modo.value === 'local' ? estado.textos.length > 0 : tiposIa.value.length > 0))
const chavePrevia = computed(() => JSON.stringify({ ...corpoGerar(estado), tecnicas: [], instrucoes: modo.value === 'externa' ? estado.instrucoes.trim() : '' }))
let temporizador = null
let ultimo = 0
async function atualizarPrevia() {
  const n = ++ultimo
  if (!completo.value) {
    previa.value = null
    erroPrevia.value = ''
    carregando.value = false
    return
  }
  carregando.value = true
  try {
    const r = await ia.previaDaPagina(corpoGerar(estado))
    if (n !== ultimo) return
    previa.value = r
    erroPrevia.value = ''
  }
  catch (e) {
    if (n !== ultimo) return
    previa.value = null
    erroPrevia.value = e.message
  }
  if (n === ultimo) carregando.value = false
}
watch(chavePrevia, () => {
  clearTimeout(temporizador)
  carregando.value = completo.value
  temporizador = setTimeout(atualizarPrevia, 450)
})
onMounted(atualizarPrevia)
onBeforeUnmount(() => clearTimeout(temporizador))
// Sem IA: os jeitos que dão questão já vêm marcados (mantendo o que a pessoa desmarcou, se ainda existir).
watch(() => previa.value?.tecnicas, (lista) => {
  if (!lista) return
  const com = lista.filter((t) => t.quantidade > 0).map((t) => t.id)
  const mantidas = estado.tecnicas.filter((t) => com.includes(t))
  estado.tecnicas = mantidas.length ? mantidas : com
})

// ---------- Números do resumo ----------
const tecnicasMarcadas = computed(() => (previa.value?.tecnicas ?? []).filter((t) => estado.tecnicas.includes(t.id) && t.quantidade > 0))
const disponiveisLocal = computed(() => tecnicasMarcadas.value.reduce((s, t) => s + t.quantidade, 0))
const total = computed(() => (modo.value === 'local' ? Math.min(estado.quantidade, disponiveisLocal.value) : estado.quantidade))
const porTipo = computed(() => {
  if (modo.value === 'local') {
    const fila = tecnicasMarcadas.value.map((t) => ({ tipo: t.id, nome: t.nome, n: 0, max: t.quantidade }))
    let falta = total.value
    while (falta > 0 && fila.some((x) => x.n < x.max)) {
      for (const x of fila) {
        if (falta > 0 && x.n < x.max) {
          x.n++
          falta--
        }
      }
    }
    return fila.filter((x) => x.n > 0)
  }
  return tiposDoPedido(tiposIa.value, estado.quantidade).map((x) => ({ ...x, nome: nomeDoTipo(x.tipo) }))
})
const nomesAssuntos = computed(() => (materia.value?.assuntos ?? []).filter((a) => estado.assuntoIds.includes(a.id)).map((a) => a.nome))
const textosMarcados = computed(() => estado.textos.map((id) => materiais.value.find((m) => m.id === id)).filter(Boolean))
const gastaCota = computed(() => modo.value === 'ia' || (modo.value === 'misto' && (previa.value?.plano?.ia ?? 1) > 0))

function respostaCerta(x) {
  const c = x.conteudo
  if (c.alternativas) return c.alternativas.filter((a) => a.correta).map((a) => a.texto).join(' e ')
  if (x.tipo === 'verdadeiro_falso') return c.verdadeira ? 'Verdadeiro' : 'Falso'
  if (x.tipo === 'certo_errado') return c.certo ? 'Certo' : 'Errado'
  if (x.tipo === 'numerica') return `${c.unidade === 'R$' ? 'R$ ' : ''}${String(c.resposta).replace('.', ',')}${c.unidade && c.unidade !== 'R$' ? ` ${c.unidade}` : ''}`
  if (x.tipo === 'lacuna_digitada') return c.lacunas[0]?.respostas?.[0] ?? ''
  if (x.tipo === 'encontrar_erro') return `O passo ${c.errada + 1} está errado.`
  if (x.tipo === 'assercao_razao') return OPCOES_ASSERCAO.find((o) => o.id === c.resposta)?.texto ?? ''
  return ''
}

const autor = computed(() => {
  if (modo.value === 'local') return { nome: 'Do texto, sem IA', icone: FileText, linha: 'Não usa IA e não gasta a cota.', cota: null }
  if (modo.value === 'externa') return { nome: 'Outra IA que você usa', icone: MessagesSquare, linha: 'Você leva o pedido. Não gasta a cota.', cota: null }
  const usadas = cota.value?.usadas ?? 0
  const limite = cota.value?.limite ?? 30
  const depois = Math.min(limite, usadas + (gastaCota.value ? 1 : 0))
  const plano = previa.value?.plano
  let linha = 'A IA escreve, e o PGC confere cada uma.'
  if (modo.value === 'misto') {
    linha = !plano ? 'Primeiro o que sai do texto; a IA escreve o resto.'
      : plano.ia ? `${plano.semIa} ${plano.semIa === 1 ? 'sai' : 'saem'} do texto; a IA escreve ${plano.ia}.`
        : `O texto dá conta de todas: a cota não é usada.`
  }
  return {
    nome: 'IA do PGC',
    icone: Sparkles,
    linha,
    cota: { depois, limite, texto: gastaCota.value ? `Esta geração usa 1. Depois dela, sobram ${limite - depois}.` : `Esta não usa a cota. Sobram ${limite - usadas}.` },
  }
})

const erro = ref('')
const avisos = computed(() => {
  const a = []
  if (erro.value) a.push({ tipo: 'erro', texto: erro.value })
  if (erroPrevia.value) a.push({ tipo: 'erro', texto: erroPrevia.value })
  if (modo.value !== 'local' && !tiposIa.value.length) a.push({ tipo: 'erro', texto: 'Marque pelo menos um tipo de questão.' })
  if ((modo.value === 'ia' || modo.value === 'misto') && semCota.value && gastaCota.value) a.push({ tipo: 'erro', texto: `As ${cota.value?.limite ?? 30} gerações de hoje acabaram. Use outra IA ou tire do texto, sem IA.` })
  const fechado = textosMarcados.value.find((t) => t.ia_permitida === 'nenhuma')
  if (fechado && modo.value !== 'local') a.push({ tipo: modo.value === 'externa' ? 'aviso' : 'erro', texto: `"${fechado.titulo}" está marcado para não ir a nenhuma IA.${modo.value === 'externa' ? ' Colar em outra IA é escolha sua.' : ' Desmarque o texto ou use "Do texto, sem IA".'}` })
  if (!estado.textos.length && modo.value !== 'local') a.push({ tipo: 'aviso', texto: 'Sem texto de base, a IA escreve do que sabe. Se uma questão sair com problema, tire-a dos estudos na correção dela.' })
  if (modo.value === 'local' && previa.value?.tecnicas && disponiveisLocal.value < estado.quantidade) a.push({ tipo: 'info', texto: disponiveisLocal.value ? `O texto dá ${disponiveisLocal.value} com os jeitos marcados.` : 'Os jeitos marcados não tiram nenhuma questão deste texto.' })
  if (modo.value !== 'local' && tiposIa.value.length > estado.quantidade) a.push({ tipo: 'info', texto: `Com ${estado.quantidade} ${estado.quantidade === 1 ? 'questão' : 'questões'}, nem todos os ${tiposIa.value.length} tipos entram.` })
  if (previa.value?.pedido?.semLigacao) a.push({ tipo: 'info', texto: 'Nenhum trecho do texto está ligado a esses assuntos: vale o texto todo.' })
  return a
})

// ---------- Outra IA ----------
const resposta = ref('')
const copiado = ref(false)
const jaCopiou = ref(false)
const salvando = ref(false)
const erroColar = ref(null)
watch(resposta, () => (erroColar.value = null))
const assuntosDaConferencia = computed(() => {
  const todos = (materia.value?.assuntos ?? []).filter((a) => !a.arquivado_em)
  const marcados = todos.filter((a) => estado.assuntoIds.includes(a.id))
  return marcados.length ? marcados : todos
})
const contexto = computed(() => contextoDaConferencia({ tipos: estado.tipos, dificuldade: estado.dificuldade, quantidade: estado.quantidade, estilo: estado.estilo, assuntos: assuntosDaConferencia.value, semente: estado.semente }))
const conferencia = computed(() => (modo.value === 'externa' && resposta.value.trim() ? conferirRespostaColada(resposta.value, contexto.value, estado.quantidade) : null))
const prontas = computed(() => (conferencia.value?.ok ? conferencia.value.aprovadas.length : 0))
const avisoTreino = computed(() => (textosMarcados.value.some((t) => t.ia_permitida === 'sem_treino')
  ? 'O texto está marcado para ir só a serviços que não treinam com ele. A outra IA pode treinar: colar é escolha sua.'
  : ''))
let tempoCopia = null
async function copiarPedido() {
  const texto = previa.value?.pedido?.texto
  if (!texto) return
  try {
    await copiarTexto(texto)
    copiado.value = true
    jaCopiou.value = true
    clearTimeout(tempoCopia)
    tempoCopia = setTimeout(() => (copiado.value = false), 2200)
    avisar({ texto: 'Pedido copiado.', tipo: 'ok' })
  }
  catch {
    avisar({ texto: 'Não deu para copiar. Clique no pedido, selecione tudo (Ctrl + A) e copie (Ctrl + C).', tipo: 'erro' })
  }
}
async function salvarColada() {
  salvando.value = true
  erroColar.value = null
  try {
    const r = await ia.gerarDaPagina(corpoGerar(estado), 'colar', resposta.value)
    if (r.status === 'concluida') return navigateTo(`/questoes/geradas/${r.geracaoId}`)
    erroColar.value = { motivo: r.motivo, problemas: r.problemas ?? [] }
  }
  catch (e) {
    erroColar.value = { motivo: e.message }
  }
  finally {
    salvando.value = false
  }
}

// ---------- Gerar ----------
const gerando = ref(false)
const segundos = ref(0)
const falha = ref(null)
const semIa = useState('gerar-sem-ia', () => null)
let relogio = null
async function terminar(r) {
  if (r.status === 'concluida') {
    if (r.geracaoId) return navigateTo(`/questoes/geradas/${r.geracaoId}`)
    semIa.value = { ids: r.ids ?? [], materiaId: estado.materiaId, assuntoIds: [...estado.assuntoIds], textos: textosMarcados.value.map((t) => t.titulo) }
    return navigateTo('/questoes/geradas/sem-ia')
  }
  if (r.status === 'falhou' && r.pedido) {
    falha.value = r
    return
  }
  erro.value = r.motivo ?? 'Não deu para gerar agora. Tente de novo.'
  avisar({ texto: erro.value, tipo: 'erro' })
}
async function gerar() {
  erro.value = ''
  janela.value?.fechar()
  gerando.value = true
  segundos.value = 0
  relogio = setInterval(() => segundos.value++, 1000)
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
  try {
    await terminar(await ia.gerarDaPagina(corpoGerar(estado), 'gerar'))
  }
  catch (e) {
    erro.value = e.message
    avisar({ texto: e.message, tipo: 'erro' })
  }
  finally {
    clearInterval(relogio)
    gerando.value = false
  }
}
onBeforeUnmount(() => {
  clearInterval(relogio)
  clearTimeout(tempoCopia)
})

// ---------- Botão principal ----------
const botao = computed(() => (modo.value === 'externa' ? (prontas.value ? 'salvar' : 'copiar') : modo.value === 'local' ? 'local' : 'ia'))
const plural = (n) => `${n} ${n === 1 ? 'questão' : 'questões'}`
const rotulo = computed(() => {
  if (botao.value === 'salvar') return salvando.value ? 'Salvando' : `Salvar ${plural(prontas.value)}`
  if (botao.value === 'copiar') return copiado.value ? 'Copiado' : 'Copiar pedido'
  if (gerando.value) return 'Gerando'
  return total.value ? `Gerar ${plural(total.value)}` : 'Gerar questões'
})
const bloqueado = computed(() => {
  if (botao.value === 'salvar') return false
  if (!completo.value || erroPrevia.value || !previa.value) return true
  if (botao.value === 'copiar') return !previa.value.pedido?.texto
  if (botao.value === 'local') return !total.value
  if (previa.value.iaBloqueada?.length) return true
  return semCota.value && gastaCota.value
})
const dica = computed(() => {
  if (botao.value === 'salvar') return 'O PGC confere de novo ao salvar.'
  if (botao.value === 'copiar') return jaCopiou.value ? 'Agora cole na outra IA e traga a resposta.' : 'Copie, cole na outra IA e traga a resposta aqui.'
  if (botao.value === 'local') return 'Sai na hora. Depois você confere uma por uma.'
  return 'Depois você confere uma por uma.'
})
function acao() {
  if (botao.value === 'salvar') return salvarColada()
  if (botao.value === 'copiar') return copiarPedido()
  return gerar()
}

const exemplo = computed(() => {
  if (modo.value === 'local') return null
  const t = porTipo.value.find((x) => EXEMPLOS_TIPO[x.tipo])?.tipo
  if (!t) return null
  const e = exemploDaQuestao(t, { alternativas: ESTILO[estado.estilo]?.alternativas })
  return { tipo: t, nome: nomeDoTipo(t), enunciado: e.enunciado, resposta: respostaCerta(e) }
})
const resumo = computed(() => ({
  total: total.value,
  materia: materia.value,
  assuntos: nomesAssuntos.value.length ? nomesAssuntos.value.join(', ') : 'a matéria toda',
  textos: textosMarcados.value.map((t) => t.titulo),
  niveis: modo.value === 'local' ? null : niveisDoPedido(estado.dificuldade, estado.quantidade),
  porTipo: porTipo.value,
  notaTipos: modo.value === 'misto' ? 'parte sai do texto' : '',
  autor: autor.value,
  tempo: tempoEstimado(modo.value, total.value),
  exemplo: exemplo.value,
  avisos: avisos.value,
  dica: dica.value,
}))

// ---------- Celular ----------
const janela = ref(null)
const telaGrande = ref(true)
onMounted(() => {
  const mq = window.matchMedia('(min-width: 1024px)')
  telaGrande.value = mq.matches
  mq.addEventListener?.('change', (e) => (telaGrande.value = e.matches))
})
</script>

<template>
  <div class="pb-16 lg:pb-0">
    <CabecalhoPagina
      titulo="Gerar questões"
      descricao="Escolha do que estudar, quem escreve e como as questões ficam. Nada é salvo até você gerar."
      :voltar="{ para: '/questoes', texto: 'Questões' }"
    />

    <Vazio v-if="!materias.length" class="mt-6" titulo="Crie uma matéria primeiro" texto="As questões saem de uma matéria e dos assuntos dela. Depois é só voltar aqui." humor="acenando">
      <template #acoes>
        <NuxtLink to="/materias?nova=1" class="botao no-underline"><Plus :size="17" :stroke-width="2.4" aria-hidden="true" />Criar matéria</NuxtLink>
      </template>
    </Vazio>

    <GerarProgresso v-else-if="gerando && (modo === 'ia' || modo === 'misto')" class="mt-6" :segundos="segundos" :quantidade="total" :modo="modo" :com-texto="estado.textos.length > 0" />

    <GerarFalhou v-else-if="falha" class="mt-6" :falha="falha" :contexto="contexto" :quantidade="estado.quantidade" @tentar="falha = null" />

    <div v-else class="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
      <div class="cartao entra min-w-0 p-0" style="--i: 0">
        <GerarSecao :icone="BookOpen" titulo="Do que estudar" guia="gerar-base">
          <GerarBase :estado="estado" :materias="materias" :materiais="materiais" />
        </GerarSecao>
        <hr class="divisoria">
        <GerarSecao :icone="Pencil" titulo="Quem escreve" guia="gerar-autor">
          <GerarAutor :estado="estado" :tem-texto="estado.textos.length > 0" :cota="cota" />
        </GerarSecao>
        <hr class="divisoria">
        <GerarSecao :icone="SlidersHorizontal" titulo="Como ficam" guia="gerar-formato">
          <GerarFormato :estado="estado" :modo="modo" :maximo="maximo" :tecnicas="previa?.tecnicas ?? null" :carregando="carregando" @tocou-tipos="tocouTipos = true" />
        </GerarSecao>
        <template v-if="modo !== 'local'">
          <hr class="divisoria">
          <GerarPedido :estado="estado" :area="materia?.area ?? ''" />
        </template>
        <Transition name="abre">
          <div v-if="modo === 'externa'">
            <hr class="divisoria">
            <GerarSecao :icone="MessagesSquare" titulo="Leve o pedido para a outra IA" descricao="Copie, cole na IA que você usa e traga a resposta. O PGC confere cada questão.">
              <GerarPassosOutraIa
                v-model:resposta="resposta"
                :pedido="previa?.pedido?.texto ?? ''"
                :carregando="carregando"
                :conferencia="conferencia"
                :copiado="copiado"
                :ja-copiou="jaCopiou"
                :salvando="salvando"
                :erro-servidor="erroColar"
                :aviso="avisoTreino"
                @copiar="copiarPedido"
                @salvar="salvarColada"
              />
            </GerarSecao>
          </div>
        </Transition>
      </div>

      <aside class="entra hidden lg:sticky lg:top-6 lg:block" style="--i: 1" aria-label="Resumo" :data-guia="telaGrande ? 'gerar-resumo' : undefined">
        <GerarResumo :r="resumo" :rotulo="rotulo" :botao="botao" :bloqueado="bloqueado" :ocupado="gerando || salvando" :copiado="copiado" @acao="acao" />
      </aside>
    </div>

    <!-- Celular: o total e o botão ficam sempre à mão, acima da barra de baixo. -->
    <div
      v-if="materias.length && !gerando && !falha"
      class="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom))] z-10 flex items-center gap-3 border-t border-borda bg-folha py-2.5 pl-4 pr-[92px] lg:hidden"
      :data-guia="telaGrande ? undefined : 'gerar-resumo'"
    >
      <span class="min-w-0 flex-1">
        <span class="flex items-baseline gap-1.5">
          <b class="font-titulo text-[24px] leading-none tabular-nums">{{ total }}</b>
          <span class="text-[14px] font-semibold">{{ total === 1 ? 'questão' : 'questões' }}</span>
        </span>
        <span class="block truncate text-[12.5px] text-texto-2">{{ autor.nome }}<template v-if="autor.cota">, cota <Fracao :valor="autor.cota.depois" :total="autor.cota.limite" sem-animacao /></template></span>
      </span>
      <button type="button" class="botao h-11 shrink-0" @click="janela?.abrir()">{{ modo === 'externa' ? 'Ver resumo' : 'Conferir e gerar' }}</button>
    </div>
    <JanelaBase ref="janela" titulo="Resumo" descricao="Confira antes de gerar.">
      <GerarResumo na-janela :r="resumo" :rotulo="rotulo" :botao="botao" :bloqueado="bloqueado" :ocupado="gerando || salvando" :copiado="copiado" @acao="acao" />
    </JanelaBase>
  </div>
</template>
